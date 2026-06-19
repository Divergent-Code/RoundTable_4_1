import socketio
import logging
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import AsyncSessionLocal
from app.socket.decorators import socket_event_handler
from app.services.game_service import GameService
from app.services.lock_service import LockService
from app.services.state_service import StateService

logger = logging.getLogger(__name__)

@socket_event_handler
async def handle_move_entity(sid, data, sio, connected_users):
    if sid not in connected_users:
        return

    user_data = connected_users[sid]
    campaign_id = user_data['campaign_id']
    user_id = user_data['user_id']

    entity_id = data.get('entity_id')
    target_q = data.get('q')
    target_r = data.get('r')
    target_s = data.get('s')
    path = data.get('path', [])

    if entity_id is None or target_q is None or target_r is None or target_s is None:
        logger.warning(f"[Move] Missing data in move_entity from user {user_id}")
        return

    try:
        async with LockService.acquire(campaign_id):
            async with AsyncSessionLocal() as db:
                game_state = await GameService.get_game_state(campaign_id, db)
                if not game_state:
                    return

            # Find entity
            entity = None
            for p in game_state.party:
                if p.id == entity_id:
                    entity = p
                    break

            if not entity:
                logger.warning(f"[Move] Entity {entity_id} not found in party")
                return

            # Verification: Does user own this entity?
            # Out of combat, maybe let them move friendly NPCs too if ownership allows, but for now stick to user_id
            if hasattr(entity, 'user_id') and str(entity.user_id) != str(user_id):
                # We could broadcast an error to the user here
                return

            # Condition restrictions (Grappled, Restrained)
            from app.services.condition_service import has_speed_zero
            if has_speed_zero(entity):
                await sio.emit('system_message', {'content': f"🚫 {entity.name} cannot move (speed is 0)!"}, room=sid)
                return

            # Combat restrictions
            if game_state.phase == 'combat':
                if game_state.active_entity_id != entity.id:
                    await sio.emit('system_message', {'content': f"🚫 It is not your turn!"}, room=sid)
                    return
                if getattr(game_state, 'has_moved_this_turn', False):
                    await sio.emit('system_message', {'content': f"🚫 You have already moved this turn!"}, room=sid)
                    return
                game_state.has_moved_this_turn = True

            # Validate target hex is in walkable_hexes
            target_hex = next((h for h in game_state.location.walkable_hexes if h.q == target_q and h.r == target_r and h.s == target_s), None)
            if not target_hex:
                 logger.warning(f"[Move] Target hex not walkable {target_q},{target_r}")
                 return
                 
            # Validate no collision
            occupied = False
            for loop_entity in game_state.party + [e for e in game_state.enemies if e.hp_current > 0] + game_state.npcs:
                if loop_entity.id != entity.id and loop_entity.position is not None:
                    if loop_entity.position.q == target_q and loop_entity.position.r == target_r:
                        occupied = True
                        break
                    
            if occupied:
                 logger.warning(f"[Move] Target hex occupied {target_q},{target_r}")
                 return

            # Update position
            if entity.position is None:
                from app.models import Coordinates
                entity.position = Coordinates(q=target_q, r=target_r, s=target_s)
            else:
                entity.position.q = target_q
                entity.position.r = target_r
                entity.position.s = target_s

            if path:
                await sio.emit('entity_path_animation', {'entity_id': entity.id, 'path': path}, room=campaign_id)

            await GameService.save_game_state(campaign_id, game_state, db)
            
            # Broadcast the update
            await StateService.emit_state_update(campaign_id, game_state, sio)
            
            if game_state.phase == 'combat':
                from app.services.turn_manager import TurnManager
                from app.services.narrator_service import NarratorService
                
                if getattr(game_state, 'has_acted_this_turn', False):
                    await TurnManager.advance_turn(campaign_id, sio, db, current_game_state=game_state)
                    await db.commit()
                else:
                    # Narration prompt
                    narration_context = f"{entity.name} has moved into position."
                    await NarratorService.narrate(
                        campaign_id=campaign_id,
                        context=narration_context,
                        sio=sio,
                        db=db,
                        mode="combat_narration"
                    )
            else:
                # If out of combat, process AI following
                try:
                    await GameService.process_ai_following(campaign_id, entity_id, db, sio, game_state)
                except AttributeError:
                    logger.warning("[Move] process_ai_following not implemented yet")
            
            # Commit the movement and any AI following changes out of combat
            await db.commit()

    except TimeoutError:
        logger.warning(f"[Move] Lock acquisition timed out for user {user_id} in campaign {campaign_id}")
        # Not emitting an error to sid directly because we don't have an easy way unless we pass it individually, but wait, `sid` is available!
        await sio.emit('system_message', {'content': '🚫 Server is busy processing another request. Please try your movement again.'}, room=sid)
    except Exception as e:
        logger.error(f"[Move] Error handling move_entity: {e}", exc_info=True)

@socket_event_handler
async def handle_get_reachable_hexes(sid, data, sio, connected_users):
    if sid not in connected_users:
        return {"entity_id": None, "paths": {}}

    user_data = connected_users[sid]
    campaign_id = user_data['campaign_id']

    entity_id = data.get('entity_id')
    if not entity_id:
        return {"entity_id": None, "paths": {}}

    try:
        async with AsyncSessionLocal() as db:
            game_state = await StateService.get_game_state(campaign_id, db)
            if not game_state:
                return {"entity_id": entity_id, "paths": {}}

            # Find entity
            entity = None
            for p in game_state.party + game_state.enemies + game_state.npcs:
                if p.id == entity_id:
                    entity = p
                    break

            if not entity or getattr(entity, 'position', None) is None:
                return {"entity_id": entity_id, "paths": {}}

            # Calculate remaining moves
            max_move = int(getattr(entity, 'speed', 30) // 5)
            
            # Check condition restrictions (Grappled, Restrained)
            from app.services.condition_service import has_speed_zero
            if has_speed_zero(entity):
                max_move = 0

            # Identify obstacle hexes (all other living entities)
            obstacle_hexes = set()
            for loop_entity in game_state.party + [e for e in game_state.enemies if e.hp_current > 0] + game_state.npcs:
                if loop_entity.id != entity.id and loop_entity.position is not None:
                    obstacle_hexes.add((loop_entity.position.q, loop_entity.position.r, loop_entity.position.s))

            from app.services.pathfinding_service import PathfindingService
            start_hex = (entity.position.q, entity.position.r, entity.position.s)
            
            paths_dict = PathfindingService.find_reachable_hexes(
                start_hex,
                max_move,
                game_state.location.walkable_hexes,
                obstacle_hexes
            )

            # Format the output paths to JSON-serializable keys (e.g. "q,r,s")
            serializable_paths = {}
            for target_hex, path in paths_dict.items():
                if target_hex == start_hex:
                    continue
                # Cannot end turn on an ally's hex
                is_occupied = False
                for p in game_state.party:
                    if p.id != entity.id and p.position is not None:
                        if p.position.q == target_hex[0] and p.position.r == target_hex[1]:
                            is_occupied = True
                            break
                if not is_occupied:
                    key = f"{target_hex[0]},{target_hex[1]},{target_hex[2]}"
                    serializable_paths[key] = [{"q": h[0], "r": h[1], "s": h[2]} for h in path]

            return {"entity_id": entity_id, "paths": serializable_paths}
            
    except Exception as e:
        logger.error(f"[Reachable] Error in get_reachable_hexes: {e}", exc_info=True)
        return {"entity_id": entity_id, "paths": {}}
