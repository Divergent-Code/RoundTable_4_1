import { describe, it, expect, beforeEach } from 'vitest'
import { useSocketStore, GameState, Player, Enemy, NPC } from '../lib/socket'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const basePlayer = (): Player => ({
  id: 'player-1',
  name: 'Gimli',
  is_ai: false,
  hp_current: 20,
  hp_max: 20,
  ac: 16,
  initiative: 5,
  speed: 30,
  position: { q: 0, r: 0, s: 0 },
  inventory: [],
  conditions: [],
  role: 'Fighter',
  control_mode: 'human',
  race: 'Dwarf',
  level: 3,
  xp: 900,
  sheet_data: {},
})

const baseEnemy = (): Enemy => ({
  id: 'goblin-1',
  name: 'Goblin',
  is_ai: true,
  hp_current: 10,
  hp_max: 10,
  ac: 12,
  initiative: 2,
  speed: 30,
  position: { q: 3, r: -1, s: -2 },
  inventory: [],
  conditions: [],
  type: 'Goblin',
  hostile: true,
})

const baseNpc = (): NPC => ({
  id: 'npc-1',
  name: 'Innkeeper',
  is_ai: true,
  hp_current: 8,
  hp_max: 8,
  ac: 10,
  initiative: 0,
  speed: 30,
  position: { q: 5, r: 0, s: -5 },
  inventory: [],
  conditions: [],
  role: 'Innkeeper',
  friendly: true,
})

const makeGameState = (overrides: Partial<GameState> = {}): GameState => ({
  session_id: 'test-campaign',
  turn_index: 0,
  phase: 'exploration',
  active_entity_id: null,
  location: { id: 'loc-1', name: 'Tavern', description: 'A cozy tavern.', walkable_hexes: [] },
  party: [basePlayer()],
  enemies: [baseEnemy()],
  npcs: [baseNpc()],
  turn_order: [],
  combat_log: [],
  ...overrides,
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSocketStore — delta actions', () => {
  beforeEach(() => {
    // Reset store to a clean game state before each test
    useSocketStore.getState().setGameState(makeGameState())
    useSocketStore.getState().setMessages([])
  })

  // ----- entityMoved -------------------------------------------------------

  it('entityMoved: updates position of a party member', () => {
    useSocketStore.getState().entityMoved('player-1', 2, -1, -1)
    const { gameState } = useSocketStore.getState()
    expect(gameState?.party[0].position).toEqual({ q: 2, r: -1, s: -1 })
  })

  it('entityMoved: updates position of an enemy', () => {
    useSocketStore.getState().entityMoved('goblin-1', -2, 1, 1)
    const { gameState } = useSocketStore.getState()
    expect(gameState?.enemies[0].position).toEqual({ q: -2, r: 1, s: 1 })
  })

  it('entityMoved: does not mutate other entities', () => {
    useSocketStore.getState().entityMoved('goblin-1', 0, 0, 0)
    const { gameState } = useSocketStore.getState()
    expect(gameState?.party[0].position).toEqual({ q: 0, r: 0, s: 0 }) // unchanged
    expect(gameState?.npcs[0].position).toEqual({ q: 5, r: 0, s: -5 }) // unchanged
  })

  // ----- entityHpChanged ---------------------------------------------------

  it('entityHpChanged: updates hp_current and hp_max of a party member', () => {
    useSocketStore.getState().entityHpChanged('player-1', 5, 20)
    const { gameState } = useSocketStore.getState()
    expect(gameState?.party[0].hp_current).toBe(5)
    expect(gameState?.party[0].hp_max).toBe(20)
  })

  it('entityHpChanged: updates an enemy correctly', () => {
    useSocketStore.getState().entityHpChanged('goblin-1', 0, 10)
    const { gameState } = useSocketStore.getState()
    expect(gameState?.enemies[0].hp_current).toBe(0)
  })

  // ----- entityConditionApplied / entityConditionRemoved ------------------

  it('entityConditionApplied: appends a new condition to a party member', () => {
    const condition = { name: 'Poisoned', duration: 3 }
    useSocketStore.getState().entityConditionApplied('player-1', condition)
    const { gameState } = useSocketStore.getState()
    expect(gameState?.party[0].conditions).toContainEqual(condition)
  })

  it('entityConditionApplied: updates an existing condition instead of duplicating', () => {
    const first = { name: 'Stunned', duration: 2 }
    const updated = { name: 'Stunned', duration: 1 }
    useSocketStore.getState().entityConditionApplied('player-1', first)
    useSocketStore.getState().entityConditionApplied('player-1', updated)
    const { gameState } = useSocketStore.getState()
    const conditions = gameState?.party[0].conditions ?? []
    expect(conditions.filter(c => c.name === 'Stunned')).toHaveLength(1)
    expect(conditions.find(c => c.name === 'Stunned')?.duration).toBe(1)
  })

  it('entityConditionRemoved: removes a named condition from a party member', () => {
    // Apply then remove
    useSocketStore.getState().entityConditionApplied('player-1', { name: 'Blinded', duration: 2 })
    useSocketStore.getState().entityConditionRemoved('player-1', 'Blinded')
    const { gameState } = useSocketStore.getState()
    expect(gameState?.party[0].conditions.find(c => c.name === 'Blinded')).toBeUndefined()
  })

  // ----- turnChanged -------------------------------------------------------

  it('turnChanged: advances turn_index and active_entity_id', () => {
    useSocketStore.getState().setGameState(makeGameState({
      phase: 'combat',
      turn_order: ['player-1', 'goblin-1'],
    }))

    useSocketStore.getState().turnChanged(1, 'goblin-1', 'combat', ['player-1', 'goblin-1'], false, false)

    const { gameState } = useSocketStore.getState()
    expect(gameState?.turn_index).toBe(1)
    expect(gameState?.active_entity_id).toBe('goblin-1')
    expect(gameState?.phase).toBe('combat')
  })

  // ----- vesselAdded / vesselRemoved ---------------------------------------

  it('vesselAdded: appends a new vessel to gameState.vessels', () => {
    const vessel = { id: 'chest-1', name: 'Goblin Corpse', position: { q: 1, r: 0, s: -1 }, contents: ['Dagger'], currency: {} }
    useSocketStore.getState().vesselAdded(vessel)
    const { gameState } = useSocketStore.getState()
    expect(gameState?.vessels).toContainEqual(vessel)
  })

  it('vesselAdded: updates an existing vessel if id already exists', () => {
    const original = { id: 'chest-1', name: 'Goblin Corpse', position: { q: 1, r: 0, s: -1 }, contents: ['Dagger'], currency: {} }
    const updated = { id: 'chest-1', name: 'Goblin Corpse', position: { q: 1, r: 0, s: -1 }, contents: ['Dagger', 'Gold Piece'], currency: { gp: 5 } }
    useSocketStore.getState().vesselAdded(original)
    useSocketStore.getState().vesselAdded(updated)
    const { gameState } = useSocketStore.getState()
    const vessels = gameState?.vessels ?? []
    expect(vessels.filter(v => v.id === 'chest-1')).toHaveLength(1)
    expect(vessels.find(v => v.id === 'chest-1')?.contents).toContain('Gold Piece')
  })

  it('vesselRemoved: removes a vessel by id', () => {
    const vessel = { id: 'chest-1', name: 'Chest', position: { q: 0, r: 0, s: 0 }, contents: [], currency: {} }
    useSocketStore.getState().vesselAdded(vessel)
    useSocketStore.getState().vesselRemoved('chest-1')
    const { gameState } = useSocketStore.getState()
    expect(gameState?.vessels?.find(v => v.id === 'chest-1')).toBeUndefined()
  })

  // ----- addMessage deduplication ------------------------------------------

  it('addMessage: does not add a duplicate message with identical timestamp, content, and sender', () => {
    const msg = {
      sender_id: 'dm',
      sender_name: 'Dungeon Master',
      content: 'The dragon roars.',
      timestamp: '12:00:01',
    }
    useSocketStore.getState().addMessage(msg)
    useSocketStore.getState().addMessage(msg)
    const { messages } = useSocketStore.getState()
    expect(messages).toHaveLength(1)
  })

  it('addMessage: allows messages that differ only by sender_id', () => {
    const base = { sender_name: 'Someone', content: 'Hello', timestamp: '12:00:01' }
    useSocketStore.getState().addMessage({ ...base, sender_id: 'player-1' })
    useSocketStore.getState().addMessage({ ...base, sender_id: 'player-2' })
    const { messages } = useSocketStore.getState()
    expect(messages).toHaveLength(2)
  })

  // ----- entityAdded / entityRemoved ---------------------------------------

  it('entityRemoved: removes an entity from the correct list', () => {
    useSocketStore.getState().entityRemoved('goblin-1')
    const { gameState } = useSocketStore.getState()
    expect(gameState?.enemies.find(e => e.id === 'goblin-1')).toBeUndefined()
    expect(gameState?.party).toHaveLength(1) // party untouched
  })
})
