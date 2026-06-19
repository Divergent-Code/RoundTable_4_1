import { create } from 'zustand';

// Socket Context now handles connectivity.
// This Zustand store acts entirely as a reactive data sink.


export interface Interactable {
    id: string;
    name: string;
    type: string;
    state: string;
    locked: boolean;
    key_id: string;
    position?: Coordinates;
    target_location_id?: string;
}

export interface Location {
    id: string;
    name: string;
    description: string;
    source_id?: string;
    walkable_hexes?: Coordinates[];
    interactables?: Interactable[];
    party_locations?: { party_id: string, position: Coordinates }[];
}

export interface Coordinates {
    q: number;
    r: number;
    s: number;
}

export interface Entity {
    id: string;
    name: string;
    is_ai: boolean;
    hp_current: number;
    hp_max: number;
    ac: number;
    initiative: number;
    speed: number;
    position: Coordinates;
    inventory: string[];
    conditions: { name: string; duration: number; source_id?: string }[];
}

// Reconciling with API Character
export interface Player extends Entity {
    role: string;
    control_mode: string; // 'human' | 'ai' | 'disabled'
    race: string;
    level: number;
    xp: number;
    user_id?: string;
    campaign_id?: string;
    backstory?: string;
    sheet_data: Record<string, unknown>;
}

export interface Enemy extends Entity {
    type: string;
    identified?: boolean;
    hostile?: boolean;
    ally?: boolean;
    data?: Record<string, unknown>;
}

export interface NPC extends Entity {
    role: string;
    identified?: boolean;
    hostile?: boolean;
    friendly?: boolean;
    ally?: boolean;
    data?: Record<string, unknown>;
}

export interface LogEntry {
    tick: number;
    actor_id: string;
    action: string;
    target_id?: string;
    result: string;
    timestamp: string;
}

export interface GameState {
    session_id: string;
    turn_index: number;
    phase: 'combat' | 'exploration' | 'social';
    active_entity_id: string | null;
    location: Location;
    discovered_locations?: Location[];
    party: Player[]; // Mapping Player to Character for frontend ease
    enemies: Enemy[];
    npcs: NPC[];
    turn_order: string[];
    combat_log: LogEntry[];
    vessels?: { id: string; name: string; position: Coordinates; contents: string[]; currency: Record<string, number> }[];
}


interface SocketState {
    isConnected: boolean;
    connectionError: string | null;
    messages: ChatMessage[];
    gameState: GameState | null;
    debugLogs: DebugLogItem[];
    lastPing: number | null;
    aiStats: AIStats;
    isTyping: boolean;

    // Setters for context provider
    setConnected: (connected: boolean) => void;
    setConnectionError: (error: string | null) => void;
    setMessages: (messages: ChatMessage[]) => void;
    addMessage: (msg: ChatMessage) => void;
    setGameState: (state: GameState | null) => void;
    setDebugLogs: (logs: DebugLogItem[]) => void;
    addDebugLog: (log: DebugLogItem) => void;
    setPing: (ping: number | null) => void;
    setAiTyping: (isTyping: boolean) => void;
    setAiStats: (stats: AIStats) => void;

    // Targeted Sync Actions
    entityMoved: (entityId: string, q: number, r: number, s: number) => void;
    entityHpChanged: (entityId: string, hpCurrent: number, hpMax: number) => void;
    entityConditionApplied: (entityId: string, condition: any) => void;
    entityConditionRemoved: (entityId: string, conditionName: string) => void;
    turnChanged: (turnIndex: number, activeEntityId: string | null, phase: 'combat' | 'exploration' | 'social', turnOrder: string[], hasMoved: boolean, hasActed: boolean) => void;
    vesselAdded: (vessel: any) => void;
    vesselRemoved: (vesselId: string) => void;
    locationChanged: (location: any) => void;
    combatLogAdded: (logs: any[]) => void;
    entityAdded: (entity: any) => void;
    entityRemoved: (entityId: string) => void;

    // UI Helpers that don't need socket
    setInitialStats: (totalTokens: number, inputTokens: number, outputTokens: number, queryCount: number, imageCount: number) => void;
}

export interface ChatMessage {
    sender_id: string;
    sender_name: string;
    content: string;
    timestamp: string;
    is_system?: boolean;
    message_type?: string;
}

export interface DebugLogItem {
    type: 'llm_start' | 'llm_end' | 'tool_start' | 'tool_end';
    content: string;
    agent_name?: string;
    full_content: unknown;
    timestamp: string;
}

export interface AIStats {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    queryCount: number;
    imageCount: number;
    lastRequest?: {
        tokens: number;
        model: string;
        agent: string;
    };
    lastImageRequest?: {
        model: string;
    };
}

export const useSocketStore = create<SocketState>((set) => ({
    isConnected: false,
    connectionError: null,
    messages: [],
    gameState: null,
    debugLogs: [],
    lastPing: null,
    aiStats: {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        queryCount: 0,
        imageCount: 0
    },
    isTyping: false,

    setConnected: (connected) => set({ isConnected: connected }),
    setConnectionError: (error) => set({ connectionError: error }),
    setMessages: (messages) => set({ messages }),
    addMessage: (msg: ChatMessage) => set((state) => {
        // Deduplicate messages based on timestamp and content + sender
        const exists = state.messages.some(m =>
            m.timestamp === msg.timestamp &&
            m.content === msg.content &&
            m.sender_id === msg.sender_id
        );
        if (exists) return state;
        return {
            messages: [...state.messages, msg],
            isTyping: false // Failsafe
        };
    }),

    setGameState: (state) => set({ gameState: state }),
    setDebugLogs: (logs) => set({ debugLogs: logs }),
    addDebugLog: (log: DebugLogItem) => set((state) => {
        let typing = state.isTyping;
        if (log.type === 'llm_start') typing = true;
        if (log.type === 'llm_end') typing = false;

        return {
            debugLogs: [...state.debugLogs, log],
            isTyping: typing
        };
    }),
    setPing: (ping) => set({ lastPing: ping }),
    setAiTyping: (isTyping) => set({ isTyping }),

    setAiStats: (data: any) => set((state) => {
        if (data.type === 'update' && typeof data.total_tokens === 'number') {
            return {
                aiStats: {
                    totalTokens: data.total_tokens,
                    inputTokens: data.input_tokens || 0,
                    outputTokens: data.output_tokens || 0,
                    queryCount: data.query_count || (state.aiStats.queryCount + 1),
                    imageCount: data.image_count || state.aiStats.imageCount,
                    lastRequest: data.last_request ? {
                        tokens: data.last_request.tokens,
                        model: data.last_request.model,
                        agent: data.last_request.agent
                    } : state.aiStats.lastRequest,
                    lastImageRequest: data.last_image_request ? {
                        model: data.last_image_request.model
                    } : state.aiStats.lastImageRequest
                }
            };
        } else if (data.type === 'usage') {
            const isImage = data.is_image === true;
            return {
                aiStats: {
                    totalTokens: state.aiStats.totalTokens + (data.total_tokens || 0),
                    inputTokens: state.aiStats.inputTokens + (data.input_tokens || 0),
                    outputTokens: state.aiStats.outputTokens + (data.output_tokens || 0),
                    queryCount: state.aiStats.queryCount + (isImage ? 0 : 1),
                    imageCount: state.aiStats.imageCount + (isImage ? 1 : 0),
                    lastRequest: !isImage ? {
                        tokens: data.total_tokens || 0,
                        model: data.model || 'unknown',
                        agent: data.agent_name || 'unknown'
                    } : state.aiStats.lastRequest,
                    lastImageRequest: isImage ? {
                        model: data.model || 'unknown'
                    } : state.aiStats.lastImageRequest
                }
            };
        }
        return state;
    }),

    setInitialStats: (totalTokens, inputTokens, outputTokens, queryCount) => {
        set((state) => ({
            aiStats: {
                ...state.aiStats,
                totalTokens,
                inputTokens,
                outputTokens,
                queryCount
            }
        }));
    },

    entityMoved: (entityId, q, r, s) => set((state) => {
        if (!state.gameState) return state;
        const updateEntity = <T extends Entity>(list: T[]): T[] =>
            list.map(e => e.id === entityId ? { ...e, position: { q, r, s } } : e);
        return {
            gameState: {
                ...state.gameState,
                party: updateEntity(state.gameState.party),
                enemies: updateEntity(state.gameState.enemies),
                npcs: updateEntity(state.gameState.npcs)
            }
        };
    }),

    entityHpChanged: (entityId, hpCurrent, hpMax) => set((state) => {
        if (!state.gameState) return state;
        const updateEntity = <T extends Entity>(list: T[]): T[] =>
            list.map(e => e.id === entityId ? { ...e, hp_current: hpCurrent, hp_max: hpMax } : e);
        return {
            gameState: {
                ...state.gameState,
                party: updateEntity(state.gameState.party),
                enemies: updateEntity(state.gameState.enemies),
                npcs: updateEntity(state.gameState.npcs)
            }
        };
    }),

    entityConditionApplied: (entityId, condition) => set((state) => {
        if (!state.gameState) return state;
        const updateEntity = <T extends Entity>(list: T[]): T[] =>
            list.map(e => {
                if (e.id !== entityId) return e;
                const exists = e.conditions.some(c => c.name === condition.name);
                const newConds = exists 
                    ? e.conditions.map(c => c.name === condition.name ? condition : c)
                    : [...e.conditions, condition];
                return { ...e, conditions: newConds };
            });
        return {
            gameState: {
                ...state.gameState,
                party: updateEntity(state.gameState.party),
                enemies: updateEntity(state.gameState.enemies),
                npcs: updateEntity(state.gameState.npcs)
            }
        };
    }),

    entityConditionRemoved: (entityId, conditionName) => set((state) => {
        if (!state.gameState) return state;
        const updateEntity = <T extends Entity>(list: T[]): T[] =>
            list.map(e => e.id === entityId 
                ? { ...e, conditions: e.conditions.filter(c => c.name !== conditionName) } 
                : e
            );
        return {
            gameState: {
                ...state.gameState,
                party: updateEntity(state.gameState.party),
                enemies: updateEntity(state.gameState.enemies),
                npcs: updateEntity(state.gameState.npcs)
            }
        };
    }),

    turnChanged: (turnIndex, activeEntityId, phase, turnOrder, hasMoved, hasActed) => set((state) => {
        if (!state.gameState) return state;
        return {
            gameState: {
                ...state.gameState,
                turn_index: turnIndex,
                active_entity_id: activeEntityId,
                phase,
                turn_order: turnOrder,
                has_moved_this_turn: hasMoved,
                has_acted_this_turn: hasActed
            }
        };
    }),

    vesselAdded: (vessel) => set((state) => {
        if (!state.gameState) return state;
        const vessels = state.gameState.vessels || [];
        const exists = vessels.some(v => v.id === vessel.id);
        const newVessels = exists
            ? vessels.map(v => v.id === vessel.id ? vessel : v)
            : [...vessels, vessel];
        return {
            gameState: {
                ...state.gameState,
                vessels: newVessels
            }
        };
    }),

    vesselRemoved: (vesselId) => set((state) => {
        if (!state.gameState) return state;
        const vessels = state.gameState.vessels || [];
        return {
            gameState: {
                ...state.gameState,
                vessels: vessels.filter(v => v.id !== vesselId)
            }
        };
    }),

    locationChanged: (location) => set((state) => {
        if (!state.gameState) return state;
        return {
            gameState: {
                ...state.gameState,
                location
            }
        };
    }),

    combatLogAdded: (logs) => set((state) => {
        if (!state.gameState) return state;
        return {
            gameState: {
                ...state.gameState,
                combat_log: [...state.gameState.combat_log, ...logs]
            }
        };
    }),

    entityAdded: (entity) => set((state) => {
        if (!state.gameState) return state;
        const isPlayer = 'role' in entity && 'control_mode' in entity;
        const isEnemy = 'hostile' in entity && 'type' in entity;
        
        let party = state.gameState.party;
        let enemies = state.gameState.enemies;
        let npcs = state.gameState.npcs;
        
        if (isPlayer) {
            if (!party.some(p => p.id === entity.id)) party = [...party, entity];
        } else if (isEnemy) {
            if (!enemies.some(e => e.id === entity.id)) enemies = [...enemies, entity];
        } else {
            if (!npcs.some(n => n.id === entity.id)) npcs = [...npcs, entity];
        }
        
        return {
            gameState: {
                ...state.gameState,
                party,
                enemies,
                npcs
            }
        };
    }),

    entityRemoved: (entityId) => set((state) => {
        if (!state.gameState) return state;
        return {
            gameState: {
                ...state.gameState,
                party: state.gameState.party.filter(p => p.id !== entityId),
                enemies: state.gameState.enemies.filter(e => e.id !== entityId),
                npcs: state.gameState.npcs.filter(n => n.id !== entityId)
            }
        };
    })
}));
