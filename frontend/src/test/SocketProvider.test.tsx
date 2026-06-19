import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { SocketProvider, useSocketContext } from '../lib/SocketProvider'
import { useSocketStore } from '../lib/socket'
import { io } from 'socket.io-client'

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const socketInstance = {
    connected: false,
    auth: {},
    query: {},
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    io: {
      on: vi.fn(),
    },
  }
  return {
    io: vi.fn().mockReturnValue(socketInstance),
    Socket: vi.fn(),
  }
})

// Mock authStore
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn().mockImplementation((selector) => {
    const state = {
      token: 'test-token',
      user: { uid: 'user-123' },
    }
    return selector(state)
  }),
}))

describe('SocketProvider', () => {
  let mockSocket: any
  let listeners: Record<string, ((...args: any[]) => void)[]> = {}
  let ioListeners: Record<string, ((...args: any[]) => void)[]> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    listeners = {}
    ioListeners = {}

    // Grab the mocked socket instance
    mockSocket = vi.mocked(io).mock.results[0]?.value || (io as any)()

    mockSocket.on.mockImplementation((event: string, cb: (...args: any[]) => void) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(cb)
    })

    mockSocket.once.mockImplementation((event: string, cb: (...args: any[]) => void) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(cb)
    })

    mockSocket.off.mockImplementation((event: string, cb: (...args: any[]) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((l) => l !== cb)
      }
    })

    mockSocket.io.on.mockImplementation((event: string, cb: (...args: any[]) => void) => {
      if (!ioListeners[event]) ioListeners[event] = []
      ioListeners[event].push(cb)
    })

    // Reset Zustand store state
    useSocketStore.getState().setGameState(null)
    useSocketStore.getState().setConnected(false)
    useSocketStore.getState().setMessages([])
  })

  afterEach(() => {
    // Clear connection promise and disconnect
    const { result } = renderHook(() => useSocketContext(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>,
    })
    act(() => {
      result.current.disconnect()
    })
  })

  const triggerEvent = (event: string, ...args: any[]) => {
    if (listeners[event]) {
      listeners[event].forEach((cb) => cb(...args))
    }
  }

  const triggerIOEvent = (event: string, ...args: any[]) => {
    if (ioListeners[event]) {
      ioListeners[event].forEach((cb) => cb(...args))
    }
  }

  it('establishes a connection and joins the campaign', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    )
    const { result } = renderHook(() => useSocketContext(), { wrapper })

    let connectPromise: Promise<void>
    act(() => {
      connectPromise = result.current.connect('campaign-abc')
    })

    // Simulate connection event
    act(() => {
      triggerEvent('connect')
    })

    await act(async () => {
      await connectPromise
    })

    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        auth: { token: 'test-token' },
        query: { campaignId: 'campaign-abc' },
        transports: ['websocket'],
      })
    )

    expect(mockSocket.emit).toHaveBeenCalledWith('join_campaign', {
      user_id: 'user-123',
      campaign_id: 'campaign-abc',
    })
    expect(useSocketStore.getState().isConnected).toBe(true)
  })

  it('updates game state when receiving full game_state_update', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    )
    const { result } = renderHook(() => useSocketContext(), { wrapper })

    act(() => {
      result.current.connect('campaign-abc')
      triggerEvent('connect')
    })

    const mockState: any = {
      session_id: 'campaign-abc',
      turn_index: 0,
      phase: 'exploration',
      active_entity_id: null,
      party: [],
      enemies: [],
      npcs: [],
      turn_order: [],
      combat_log: [],
    }

    act(() => {
      triggerEvent('game_state_update', mockState)
    })

    expect(useSocketStore.getState().gameState).toEqual(mockState)
  })

  it('updates entity position via entity_moved delta event', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    )
    const { result } = renderHook(() => useSocketContext(), { wrapper })

    act(() => {
      result.current.connect('campaign-abc')
      triggerEvent('connect')
    })

    // Set up a base state with one party member
    const baseState: any = {
      session_id: 'campaign-abc',
      turn_index: 0,
      phase: 'exploration',
      active_entity_id: null,
      party: [{ id: 'player-1', name: 'Gimli', position: { q: 0, r: 0, s: 0 }, hp_current: 20, hp_max: 20, ac: 16, initiative: 0, speed: 30, inventory: [], conditions: [], is_ai: false }],
      enemies: [],
      npcs: [],
      turn_order: [],
      combat_log: [],
    }

    act(() => {
      useSocketStore.getState().setGameState(baseState)
    })

    // Trigger the granular entity_moved event
    act(() => {
      triggerEvent('entity_moved', { entity_id: 'player-1', q: 2, r: -1, s: -1 })
    })

    const updatedState = useSocketStore.getState().gameState
    expect(updatedState?.party[0].position).toEqual({ q: 2, r: -1, s: -1 })
  })

  it('updates entity HP via hp_changed delta event', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    )
    const { result } = renderHook(() => useSocketContext(), { wrapper })

    act(() => {
      result.current.connect('campaign-abc')
      triggerEvent('connect')
    })

    const baseState: any = {
      session_id: 'campaign-abc',
      turn_index: 0,
      phase: 'combat',
      active_entity_id: null,
      party: [],
      enemies: [{ id: 'goblin-1', name: 'Goblin', hp_current: 10, hp_max: 10, ac: 12, initiative: 0, speed: 30, position: { q: 1, r: 0, s: -1 }, inventory: [], conditions: [], is_ai: true, type: 'Goblin', hostile: true }],
      npcs: [],
      turn_order: [],
      combat_log: [],
    }

    act(() => {
      useSocketStore.getState().setGameState(baseState)
    })

    act(() => {
      triggerEvent('hp_changed', { entity_id: 'goblin-1', hp_current: 3, hp_max: 10 })
    })

    const updatedState = useSocketStore.getState().gameState
    expect(updatedState?.enemies[0].hp_current).toBe(3)
    expect(updatedState?.enemies[0].hp_max).toBe(10)
  })

  it('advances turn via turn_changed delta event', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    )
    const { result } = renderHook(() => useSocketContext(), { wrapper })

    act(() => {
      result.current.connect('campaign-abc')
      triggerEvent('connect')
    })

    const baseState: any = {
      session_id: 'campaign-abc',
      turn_index: 0,
      phase: 'combat',
      active_entity_id: 'player-1',
      party: [],
      enemies: [],
      npcs: [],
      turn_order: ['player-1', 'goblin-1'],
      combat_log: [],
    }

    act(() => {
      useSocketStore.getState().setGameState(baseState)
    })

    act(() => {
      triggerEvent('turn_changed', {
        turn_index: 1,
        active_entity_id: 'goblin-1',
        phase: 'combat',
        turn_order: ['player-1', 'goblin-1'],
        has_moved_this_turn: false,
        has_acted_this_turn: false,
      })
    })

    const updatedState = useSocketStore.getState().gameState
    expect(updatedState?.turn_index).toBe(1)
    expect(updatedState?.active_entity_id).toBe('goblin-1')
  })

  it('requests full state on socket reconnection event', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    )
    const { result } = renderHook(() => useSocketContext(), { wrapper })

    act(() => {
      result.current.connect('campaign-abc')
      triggerEvent('connect')
    })

    act(() => {
      triggerIOEvent('reconnect')
    })

    expect(mockSocket.emit).toHaveBeenCalledWith('join_campaign', {
      user_id: 'user-123',
      campaign_id: 'campaign-abc',
    })
  })
})
