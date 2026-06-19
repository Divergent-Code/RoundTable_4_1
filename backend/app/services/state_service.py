import json
import logging
import threading
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, insert, delete, desc, bindparam
from db.schema import game_states, characters, monsters, npcs
from app.models import GameState, Player, Enemy, NPC, Vessel

logger = logging.getLogger(__name__)

class StateCache:
    """
    Thread-safe and centralized cache manager for campaign states.
    Allows easy future migration to Redis/Memcached.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._cache = {}

    def get(self, campaign_id: str):
        with self._lock:
            return self._cache.get(campaign_id)

    def set(self, campaign_id: str, state_dict: dict):
        with self._lock:
            self._cache[campaign_id] = state_dict

    def __setitem__(self, campaign_id: str, state_dict: dict):
        self.set(campaign_id, state_dict)

    def __getitem__(self, campaign_id: str):
        with self._lock:
            return self._cache[campaign_id]

    def pop(self, campaign_id: str, default=None):
        with self._lock:
            return self._cache.pop(campaign_id, default)

    def clear(self):
        with self._lock:
            self._cache.clear()

class StateService:
    """
    Handles all hydration, persistence, and querying of the GameState and its entities.
    Extracted from GameService to adhere to the Single Responsibility Principle.
    """
    _last_broadcasted_state = StateCache()

    @classmethod
    def clear_campaign_state(cls, campaign_id: str):
        cls._last_broadcasted_state.pop(campaign_id, None)

    @staticmethod
    async def emit_state_update(campaign_id: str, game_state: 'GameState', sio):
        new_state_dict = game_state.model_dump()
        old_state_dict = StateService._last_broadcasted_state.get(campaign_id)
        
        if not old_state_dict:
            await sio.emit('game_state_update', new_state_dict, room=campaign_id)
        else:
            # 1. Compare Turn Variables
            turn_keys = ["turn_index", "active_entity_id", "phase", "turn_order", "has_moved_this_turn", "has_acted_this_turn"]
            turn_changed = False
            for k in turn_keys:
                if old_state_dict.get(k) != new_state_dict.get(k):
                    turn_changed = True
                    break
            
            if turn_changed:
                await sio.emit('turn_changed', {
                    "turn_index": new_state_dict.get("turn_index", 0),
                    "active_entity_id": new_state_dict.get("active_entity_id"),
                    "phase": new_state_dict.get("phase", "exploration"),
                    "turn_order": new_state_dict.get("turn_order", []),
                    "has_moved_this_turn": new_state_dict.get("has_moved_this_turn", False),
                    "has_acted_this_turn": new_state_dict.get("has_acted_this_turn", False)
                }, room=campaign_id)

            # 2. Compare Entities
            old_entities = {}
            for list_key in ["party", "enemies", "npcs"]:
                for item in old_state_dict.get(list_key, []):
                    if isinstance(item, dict) and "id" in item:
                        old_entities[item["id"]] = item

            new_entities = {}
            for list_key in ["party", "enemies", "npcs"]:
                for item in new_state_dict.get(list_key, []):
                    if isinstance(item, dict) and "id" in item:
                        new_entities[item["id"]] = item

            # New entity added
            for new_id, new_ent in new_entities.items():
                if new_id not in old_entities:
                    await sio.emit('entity_added', {"entity": new_ent}, room=campaign_id)
                else:
                    old_ent = old_entities[new_id]
                    # Position
                    old_pos = old_ent.get("position") or {}
                    new_pos = new_ent.get("position") or {}
                    if old_pos.get("q") != new_pos.get("q") or old_pos.get("r") != new_pos.get("r") or old_pos.get("s") != new_pos.get("s"):
                        await sio.emit('entity_moved', {
                            "entity_id": new_id,
                            "q": new_pos.get("q", 0),
                            "r": new_pos.get("r", 0),
                            "s": new_pos.get("s", 0)
                        }, room=campaign_id)
                    # HP
                    if old_ent.get("hp_current") != new_ent.get("hp_current") or old_ent.get("hp_max") != new_ent.get("hp_max"):
                        await sio.emit('hp_changed', {
                            "entity_id": new_id,
                            "hp_current": new_ent.get("hp_current", 0),
                            "hp_max": new_ent.get("hp_max", 10)
                        }, room=campaign_id)
                    # Conditions
                    old_conds = {c["name"]: c for c in old_ent.get("conditions", []) if isinstance(c, dict) and "name" in c}
                    new_conds = {c["name"]: c for c in new_ent.get("conditions", []) if isinstance(c, dict) and "name" in c}
                    
                    for c_name, c_val in new_conds.items():
                        if c_name not in old_conds:
                            await sio.emit('condition_applied', {"entity_id": new_id, "condition": c_val}, room=campaign_id)
                        elif c_val.get("duration") != old_conds[c_name].get("duration"):
                            await sio.emit('condition_applied', {"entity_id": new_id, "condition": c_val}, room=campaign_id)
                    
                    for c_name in old_conds:
                        if c_name not in new_conds:
                            await sio.emit('condition_removed', {"entity_id": new_id, "condition_name": c_name}, room=campaign_id)

            # Entity removed
            for old_id, old_ent in old_entities.items():
                if old_id not in new_entities:
                    await sio.emit('entity_removed', {"entity_id": old_id}, room=campaign_id)

            # 3. Compare Vessels
            old_vessels = {v["id"]: v for v in old_state_dict.get("vessels", []) if isinstance(v, dict) and "id" in v}
            new_vessels = {v["id"]: v for v in new_state_dict.get("vessels", []) if isinstance(v, dict) and "id" in v}

            for vid, vval in new_vessels.items():
                if vid not in old_vessels:
                    await sio.emit('vessel_added', {"vessel": vval}, room=campaign_id)
                elif vval != old_vessels[vid]:
                    await sio.emit('vessel_added', {"vessel": vval}, room=campaign_id)

            for vid in old_vessels:
                if vid not in new_vessels:
                    await sio.emit('vessel_removed', {"vessel_id": vid}, room=campaign_id)

            # 4. Compare Location
            old_loc = old_state_dict.get("location") or {}
            new_loc = new_state_dict.get("location") or {}
            if old_loc.get("id") != new_loc.get("id") or len(old_loc.get("interactables", [])) != len(new_loc.get("interactables", [])):
                await sio.emit('location_changed', new_loc, room=campaign_id)
            else:
                old_inter = {i["id"]: i for i in old_loc.get("interactables", []) if isinstance(i, dict) and "id" in i}
                new_inter = {i["id"]: i for i in new_loc.get("interactables", []) if isinstance(i, dict) and "id" in i}
                if old_inter != new_inter:
                    await sio.emit('location_changed', new_loc, room=campaign_id)

            # 5. Compare Combat Log
            old_log = old_state_dict.get("combat_log") or []
            new_log = new_state_dict.get("combat_log") or []
            if len(new_log) > len(old_log):
                new_entries = new_log[len(old_log):]
                await sio.emit('combat_log_added', new_entries, room=campaign_id)

        StateService._last_broadcasted_state[campaign_id] = new_state_dict

    @staticmethod
    async def get_game_state(campaign_id: str, db: AsyncSession) -> GameState:
        query = (
            select(game_states.c.state_data)
            .where(game_states.c.campaign_id == campaign_id)
            .order_by(desc(game_states.c.updated_at), desc(game_states.c.id))
            .limit(1)
        )
        result = await db.execute(query)
        state_data_str = result.scalar()

        if not state_data_str:
            return None

        state_data = json.loads(state_data_str)

        # Hydrate Entities
        state_data['party'] = await StateService._hydrate_party(state_data.get('party'), db)
        state_data['enemies'] = await StateService._hydrate_enemies(state_data.get('enemies'), db)
        state_data['npcs'] = await StateService._hydrate_npcs(state_data.get('npcs'), db)

        # Hydrate Vessels (stored as dicts in JSON)
        vessel_data = state_data.get('vessels', [])
        state_data['vessels'] = [Vessel(**v) for v in vessel_data if isinstance(v, dict)]

        return GameState(**state_data)

    @staticmethod
    async def save_game_state(campaign_id: str, game_state: GameState, db: AsyncSession):
        from datetime import datetime, timezone

        # Auto-increment state version for client-side gap detection
        game_state.version += 1

        # 1. Update Entities in their specific tables
        await StateService._save_party(game_state.party, campaign_id, db)
        await StateService._save_enemies(game_state.enemies, campaign_id, db)
        await StateService._save_npcs(game_state.npcs, campaign_id, db)

        # 2. Save Lightweight GameState (Skeleton)
        state_dict = game_state.model_dump()
        state_dict['party'] = [p.id for p in game_state.party]
        state_dict['enemies'] = [e.id for e in game_state.enemies]
        state_dict['npcs'] = [n.id for n in game_state.npcs]

        stmt = insert(game_states).values(
            id=str(uuid4()),
            campaign_id=campaign_id,
            turn_index=game_state.turn_index,
            phase=game_state.phase,
            state_data=json.dumps(state_dict),
            updated_at=datetime.now(timezone.utc)
        )
        await db.execute(stmt)

        # 3. Prune old game states: keep only the 10 most recent states for this campaign
        select_stmt = (
            select(game_states.c.id)
            .where(game_states.c.campaign_id == campaign_id)
            .order_by(desc(game_states.c.updated_at), desc(game_states.c.id))
        )
        select_result = await db.execute(select_stmt)
        all_ids = [r[0] for r in select_result.fetchall()]
        if len(all_ids) > 10:
            ids_to_delete = all_ids[10:]
            delete_stmt = (
                delete(game_states)
                .where(game_states.c.id.in_(ids_to_delete))
            )
            await db.execute(delete_stmt)

    @staticmethod
    async def _hydrate_party(party_ids: list, db: AsyncSession) -> list['Player']:
        if not party_ids: return []

        clean_ids = [str(pid.get('id')) if isinstance(pid, dict) else str(pid) for pid in party_ids]
        if not clean_ids: return []

        q = select(characters).where(characters.c.id.in_(clean_ids))
        rows = (await db.execute(q)).fetchall()
        row_map = {r.id: r for r in rows}

        party_objs: list[Player] = []
        for pid in clean_ids:
            if pid in row_map:
                r = row_map[pid]
                try:
                    s_data = json.loads(r.sheet_data) if r.sheet_data else {}
                except json.JSONDecodeError:
                    s_data = {}

                # Preserve the original sheet structure so Pydantic doesn't wipe non-Entity attributes
                if 'sheet_data' not in s_data:
                    s_data['sheet_data'] = json.loads(r.sheet_data) if r.sheet_data else {}

                s_data.update({
                    'id': str(r.id),
                    'name': str(r.name) if r.name else "Unknown",
                    'role': str(r.role) if r.role else "Unknown",
                    'race': str(r.race) if r.race else "Human",
                    'user_id': str(r.user_id) if r.user_id else None, # Important for auth checks
                    'control_mode': str(s_data.get('control_mode') or (r.control_mode if hasattr(r, 'control_mode') and r.control_mode else "human"))
                })

                # Apply defaults for core Entity fields if missing from sheet_data
                if 'is_ai' not in s_data: s_data['is_ai'] = False
                if 'hp_max' not in s_data:
                    s_data['hp_max'] = int(s_data.get('stats', {}).get('hp_max', 10))
                if 'hp_current' not in s_data:
                    s_data['hp_current'] = int(s_data.get('hp_max', 10))
                if 'position' not in s_data:
                    s_data['position'] = {"q": 0, "r": 0, "s": 0}

                # Sanitize inventory to ensure Pydantic List[str] validation passes
                if 'inventory' in s_data:
                    clean_inv = []
                    for item in s_data['inventory']:
                        if isinstance(item, dict) and 'id' in item:
                            clean_inv.append(item['id'])
                        elif isinstance(item, str):
                            clean_inv.append(item)
                    s_data['inventory'] = clean_inv

                # Calculate actual AC based on stats and equipment
                from game_engine.character_sheet import CharacterSheet
                temp_sheet = CharacterSheet(s_data)
                s_data['ac'] = temp_sheet.get_ac()

                party_objs.append(Player(**s_data))
        return party_objs

    @staticmethod
    async def _hydrate_enemies(enemy_ids: list, db: AsyncSession) -> list['Enemy']:
        if not enemy_ids: return []

        clean_ids = [str(eid.get('id')) if isinstance(eid, dict) else str(eid) for eid in enemy_ids]
        if not clean_ids: return []

        q = select(monsters).where(monsters.c.id.in_(clean_ids))
        rows = (await db.execute(q)).fetchall()
        row_map = {r.id: r for r in rows}

        enemy_objs: list[Enemy] = []
        for eid in clean_ids:
            if eid in row_map:
                r = row_map[eid]
                try:
                    d = json.loads(r.data) if r.data else {}
                except json.JSONDecodeError:
                    d = {}

                # Base init with data blob
                init_d = {'data': d}
                # Overlay DB columns
                init_d.update({
                    'id': str(r.id),
                    'name': str(r.name) if r.name else "Unknown",
                    'type': str(r.type) if r.type else "Unknown"
                })
                # Overlay strict fields from data if present (for Pydantic)
                for field in ['hp_current', 'hp_max', 'is_ai', 'position', 'identified']:
                    if field in d: init_d[field] = d[field]

                # Apply defaults for core Base Entity fields if missing from d
                if 'is_ai' not in init_d: init_d['is_ai'] = True
                if 'hp_max' not in init_d:
                    init_d['hp_max'] = int(d.get('stats', {}).get('hp', 10))
                if 'hp_current' not in init_d:
                    init_d['hp_current'] = int(init_d.get('hp_max', 10))
                if 'position' not in init_d:
                    init_d['position'] = {"q": 0, "r": 0, "s": 0}
                if 'ac' not in init_d:
                    init_d['ac'] = int(d.get('stats', {}).get('ac', 10))

                enemy_objs.append(Enemy(**init_d))
        return enemy_objs

    @staticmethod
    async def _hydrate_npcs(npc_ids: list, db: AsyncSession) -> list['NPC']:
        if not npc_ids: return []

        clean_ids = [str(nid.get('id')) if isinstance(nid, dict) else str(nid) for nid in npc_ids]
        if not clean_ids: return []

        q = select(npcs).where(npcs.c.id.in_(clean_ids))
        rows = (await db.execute(q)).fetchall()
        row_map = {r.id: r for r in rows}

        npc_objs: list[NPC] = []
        for nid in clean_ids:
            if nid in row_map:
                r = row_map[nid]
                try:
                    d = json.loads(r.data) if r.data else {}
                except json.JSONDecodeError:
                    d = {}

                init_d = {'data': d}
                init_d.update({
                    'id': str(r.id),
                    'name': str(r.name) if r.name else "Unknown",
                    'role': str(r.role) if r.role else "Unknown"
                })

                for field in ['hp_current', 'hp_max', 'is_ai', 'position', 'identified']:
                    if field in d: init_d[field] = d[field]

                # Apply defaults for core Base Entity fields if missing
                if 'is_ai' not in init_d: init_d['is_ai'] = True
                if 'hp_max' not in init_d:
                    init_d['hp_max'] = int(d.get('stats', {}).get('hp', 10))
                if 'hp_current' not in init_d:
                    init_d['hp_current'] = int(init_d.get('hp_max', 10))
                if 'position' not in init_d:
                    init_d['position'] = {"q": 0, "r": 0, "s": 0}
                if 'ac' not in init_d:
                    init_d['ac'] = int(d.get('stats', {}).get('ac', 10))

                if not r.role and 'role' in d: init_d['role'] = str(d['role'])

                npc_objs.append(NPC(**init_d))
        return npc_objs

    @staticmethod
    async def _save_party(party: list, campaign_id: str, db: AsyncSession):
        if not party: return

        party_ids = [p.id for p in party]
        existing_pids = set((await db.scalars(select(characters.c.id).where(characters.c.id.in_(party_ids)))).all())

        updates, inserts = [], []
        for p in party:
            if not p.sheet_data: p.sheet_data = {}
            # Sync transient fields to the preserved sheet_data blob
            for field in ['hp_current', 'hp_max', 'is_ai', 'control_mode', 'inventory', 'currency']:
                if hasattr(p, field):
                    p.sheet_data[field] = getattr(p, field)
            if hasattr(p, 'position') and p.position:
                pos = getattr(p, 'position')
                p.sheet_data['position'] = pos.model_dump() if hasattr(pos, 'model_dump') else pos

            rec = {
                "b_id": p.id, "b_sheet_data": json.dumps(p.sheet_data)
            }
            if p.id in existing_pids:
                updates.append(rec)
            else:
                inserts.append({
                    "id": p.id,
                    "sheet_data": json.dumps(p.sheet_data),
                    "user_id": p.user_id if p.user_id else "system",
                    "campaign_id": campaign_id,
                    "name": p.name,
                    "role": p.role,
                    "control_mode": p.control_mode
                })

        if updates:
            await db.execute(update(characters).where(characters.c.id == bindparam('b_id')).values(sheet_data=bindparam('b_sheet_data')), updates)
        if inserts:
            await db.execute(insert(characters), inserts)

    @staticmethod
    async def _save_enemies(enemies: list, campaign_id: str, db: AsyncSession):
        if not enemies: return

        eids = [e.id for e in enemies]
        existing = set((await db.scalars(select(monsters.c.id).where(monsters.c.id.in_(eids)))).all())

        updates, inserts = [], []
        for e in enemies:
            e_data = e.model_dump()
            rec = {"b_id": e.id, "b_data": json.dumps(e_data)}

            if e.id in existing:
                updates.append(rec)
            else:
                inserts.append({
                    "id": e.id, "data": json.dumps(e_data), "campaign_id": campaign_id, "name": e.name, "type": e.type
                })

        if updates:
            await db.execute(update(monsters).where(monsters.c.id == bindparam('b_id')).values(data=bindparam('b_data')), updates)
        if inserts:
            await db.execute(insert(monsters), inserts)

    @staticmethod
    async def _save_npcs(npcs_list: list, campaign_id: str, db: AsyncSession):
        if not npcs_list: return

        nids = [n.id for n in npcs_list]
        existing = set((await db.scalars(select(npcs.c.id).where(npcs.c.id.in_(nids)))).all())

        updates, inserts = [], []
        for n in npcs_list:
            if not n.data: n.data = {}
            for field in ['hp_current', 'hp_max', 'identified', 'is_ai', 'hostile', 'friendly', 'ally']:
                 n.data[field] = getattr(n, field)
            n.data['position'] = n.position.model_dump()
            n.data['conditions'] = [c.model_dump() for c in n.conditions] if n.conditions else []

            rec = {"b_id": n.id, "b_data": json.dumps(n.data)}

            if n.id in existing:
                updates.append(rec)
            else:
                inserts.append({
                    "id": n.id, "data": json.dumps(n.data), "campaign_id": campaign_id, "name": n.name, "role": n.role
                })

        if updates:
            await db.execute(update(npcs).where(npcs.c.id == bindparam('b_id')).values(data=bindparam('b_data')), updates)
        if inserts:
            await db.execute(insert(npcs), inserts)


