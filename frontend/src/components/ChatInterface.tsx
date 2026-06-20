import { useEffect, useState, useRef } from 'react';
import { useSocketStore } from '@/lib/socket';
import { useSocketContext } from '@/lib/SocketProvider';
import { useAuthStore } from '@/store/authStore';
import { Send, User, Bot, Loader2, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Character } from '@/lib/api';
import CommandSuggestions from './CommandSuggestions';
import { renderMessageContent, applyCommandSuggestion } from '@/lib/chatUtils';

interface ChatInterfaceProps {
    campaignId: string;
    characterId?: string;
}

export default function ChatInterface({ characterId }: ChatInterfaceProps) {
    const { profile, user } = useAuthStore();
    const messages = useSocketStore(state => state.messages);
    const { socket } = useSocketContext();
    const [inputValue, setInputValue] = useState('');
    const [targetMap, setTargetMap] = useState<Record<string, string>>({});
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDmTyping, setIsDmTyping] = useState(false);
    const [chatFontSize, setChatFontSize] = useState<'text-sm' | 'text-base' | 'text-lg'>('text-base');

    useEffect(() => {
        if (!socket) return;

        const handleCommandRejected = (data: { content: string, reason: string }) => {
            setInputValue(data.content);
            console.warn("Command rejected:", data.reason);
        };

        const handleTyping = (data: { sender_id: string, is_typing: boolean }) => {
            if (data.sender_id === 'dm') {
                setIsDmTyping(data.is_typing);
            }
        };

        socket.on('command_rejected', handleCommandRejected);
        socket.on('typing_indicator', handleTyping);

        return () => {
            socket.off('command_rejected', handleCommandRejected);
            socket.off('typing_indicator', handleTyping);
        };
    }, [socket]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim()) return;

        const party = (useSocketStore.getState().gameState?.party || []) as Character[];

        let senderName = profile?.username || 'Player';
        let senderId = profile?.id;

        if (characterId) {
            const char = party.find(p => p.id === characterId);
            if (char) {
                senderName = char.name;
                senderId = char.id;
            }
        } else {
            const userId = profile?.id || user?.uid;
            if (userId) {
                const myChar = party.find(p => p.user_id === userId);
                if (myChar) {
                    senderName = myChar.name;
                    senderId = myChar.id;
                }
            }
        }

        if (socket && inputValue.trim()) {
            const apiKey = localStorage.getItem('gemini_api_key');
            const model = localStorage.getItem('selected_model');

            let targetIdToSend = undefined;
            const parts = inputValue.trim().split(' ');
            if (parts.length > 1) {
                const maybeTargetText = parts.slice(1).join(' ').toLowerCase();
                if (targetMap[maybeTargetText]) {
                    targetIdToSend = targetMap[maybeTargetText];
                }
            }

            socket.emit('chat_message', {
                content: inputValue,
                sender_name: senderName,
                sender_id: senderId,
                target_id: targetIdToSend,
                api_key: apiKey,
                model_name: model
            });
        }

        setInputValue('');
        setTargetMap({});
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{
            backgroundColor: 'var(--rt-surface)',
            border: '1px solid var(--rt-border)',
            borderRadius: 'var(--rt-radius-lg)',
        }}>
            {/* ── Header ── */}
            <div className="flex justify-between items-center" style={{
                padding: 'var(--rt-space-3) var(--rt-space-4)',
                borderBottom: '1px solid var(--rt-border)',
                backgroundColor: 'var(--rt-surface-raised)',
            }}>
                <div className="flex items-center gap-3">
                    <h3 style={{
                        fontFamily: 'var(--rt-font-display)',
                        fontStyle: 'italic',
                        fontSize: 'var(--rt-text-lg)',
                        color: 'var(--rt-gold)',
                        margin: 0,
                        lineHeight: 1,
                    }}>
                        The Chronicle
                    </h3>

                    {isDmTyping && (
                        <div className="flex items-center gap-1.5" style={{
                            backgroundColor: 'color-mix(in srgb, var(--rt-gold) 10%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--rt-gold) 30%, transparent)',
                            borderRadius: '999px',
                            padding: '2px 8px',
                        }}>
                            <Loader2
                                className="w-3 h-3 animate-spin"
                                style={{ color: 'var(--rt-gold)' }}
                            />
                            <span className="rt-label" style={{ fontSize: '0.6rem', color: 'var(--rt-gold)' }}>
                                DM Narrating
                            </span>
                        </div>
                    )}
                </div>

                {showClearConfirm ? (
                    <div className="flex items-center gap-2">
                        <span className="rt-label" style={{ fontSize: '0.6rem', color: 'var(--rt-crimson)' }}>
                            Clear chronicle?
                        </span>
                        <button
                            onClick={() => { socket?.emit('clear_chat'); setShowClearConfirm(false); }}
                            className="rt-btn rt-btn-danger"
                            style={{ padding: '2px 10px', fontSize: 'var(--rt-text-xs)' }}
                        >
                            Yes
                        </button>
                        <button
                            onClick={() => setShowClearConfirm(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontFamily: 'var(--rt-font-mono)',
                                fontSize: 'var(--rt-text-xs)',
                                color: 'var(--rt-ink-faint)',
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <select
                            value={chatFontSize}
                            onChange={(e) => setChatFontSize(e.target.value as typeof chatFontSize)}
                            style={{
                                backgroundColor: 'var(--rt-surface)',
                                color: 'var(--rt-ink-on-dark-muted)',
                                border: '1px solid var(--rt-border)',
                                borderRadius: 'var(--rt-radius-sm)',
                                fontFamily: 'var(--rt-font-mono)',
                                fontSize: 'var(--rt-text-xs)',
                                padding: '2px 6px',
                                outline: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            <option value="text-sm">Small</option>
                            <option value="text-base">Medium</option>
                            <option value="text-lg">Large</option>
                        </select>
                        <button
                            onClick={() => setShowClearConfirm(true)}
                            className="rt-label"
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--rt-ink-faint)',
                                transition: 'color var(--rt-ease-fast)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--rt-ink-on-dark)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--rt-ink-faint)')}
                        >
                            Clear
                        </button>
                    </div>
                )}
            </div>

            {/* ── Messages ── */}
            <div className={cn("flex-1 overflow-y-auto", chatFontSize)} style={{
                padding: 'var(--rt-space-4)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--rt-space-4)',
            }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', marginTop: 'var(--rt-space-12)' }}>
                        <p style={{
                            fontFamily: 'var(--rt-font-display)',
                            fontStyle: 'italic',
                            color: 'var(--rt-ink-faint)',
                            fontSize: 'var(--rt-text-lg)',
                        }}>
                            The chronicle begins here…
                        </p>
                    </div>
                )}

                {messages.map((msg, idx) => {
                    const party = (useSocketStore.getState().gameState?.party || []) as Character[];
                    const isSystem = msg.is_system;
                    const isDM = msg.sender_id === 'dm';
                    const isMyCharacter = party.some(p => p.id === msg.sender_id && p.user_id === profile?.id);
                    const isMe = msg.sender_id === profile?.id || isMyCharacter;
                    const senderChar = party.find(p => p.id === msg.sender_id);
                    const isAI = senderChar?.is_ai || senderChar?.control_mode === 'ai';

                    /* ── System message ── */
                    if (isSystem) {
                        const isTurnAnnouncement = msg.content.includes("It is now") && msg.content.includes("turn!");
                        const displayContent = msg.content.replace(/\*\*/g, '');
                        return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'center', margin: 'var(--rt-space-2) 0' }}>
                                {isTurnAnnouncement ? (
                                    <span style={{
                                        fontFamily: 'var(--rt-font-mono)',
                                        fontSize: 'var(--rt-text-xs)',
                                        letterSpacing: '0.08em',
                                        textTransform: 'uppercase',
                                        color: 'var(--rt-gold)',
                                        backgroundColor: 'color-mix(in srgb, var(--rt-gold) 8%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--rt-gold) 25%, transparent)',
                                        borderRadius: '999px',
                                        padding: '3px 12px',
                                    }}>
                                        {displayContent}
                                    </span>
                                ) : (
                                    <span style={{
                                        fontFamily: 'var(--rt-font-mono)',
                                        fontSize: 'var(--rt-text-xs)',
                                        color: 'var(--rt-ink-faint)',
                                        letterSpacing: '0.06em',
                                    }}>
                                        — {displayContent} —
                                    </span>
                                )}
                            </div>
                        );
                    }

                    /* ── DM narration ── */
                    if (isDM) {
                        return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rt-space-1)' }}>
                                <div className="flex items-center gap-2">
                                    <div style={{
                                        width: 28, height: 28,
                                        borderRadius: '50%',
                                        backgroundColor: 'color-mix(in srgb, var(--rt-gold) 15%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--rt-gold) 40%, transparent)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Bot style={{ width: 14, height: 14, color: 'var(--rt-gold)' }} />
                                    </div>
                                    <span style={{
                                        fontFamily: 'var(--rt-font-mono)',
                                        fontSize: 'var(--rt-text-xs)',
                                        letterSpacing: '0.08em',
                                        textTransform: 'uppercase',
                                        color: 'var(--rt-gold)',
                                    }}>
                                        Dungeon Master
                                    </span>
                                    <span style={{
                                        fontFamily: 'var(--rt-font-mono)',
                                        fontSize: 'var(--rt-text-xs)',
                                        color: 'var(--rt-ink-faint)',
                                    }}>
                                        {msg.timestamp}
                                    </span>
                                </div>
                                <div style={{
                                    borderLeft: '3px solid var(--rt-gold-dim)',
                                    backgroundColor: 'color-mix(in srgb, var(--rt-gold) 5%, var(--rt-surface-raised))',
                                    padding: 'var(--rt-space-3) var(--rt-space-4)',
                                    borderRadius: '0 var(--rt-radius-md) var(--rt-radius-md) 0',
                                    fontFamily: 'var(--rt-font-display)',
                                    fontStyle: 'italic',
                                    color: 'var(--rt-ink-on-dark)',
                                    lineHeight: 1.75,
                                }}>
                                    {renderMessageContent(msg.content, msg.message_type, isDM)}
                                </div>
                            </div>
                        );
                    }

                    /* ── AI companion ── */
                    if (isAI) {
                        return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rt-space-1)' }}>
                                <div className="flex items-center gap-2">
                                    <div style={{
                                        width: 28, height: 28,
                                        borderRadius: '50%',
                                        backgroundColor: 'color-mix(in srgb, var(--rt-teal) 15%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--rt-teal) 30%, transparent)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Bot style={{ width: 14, height: 14, color: 'var(--rt-teal)' }} />
                                    </div>
                                    <span style={{
                                        fontFamily: 'var(--rt-font-mono)',
                                        fontSize: 'var(--rt-text-xs)',
                                        color: 'var(--rt-teal)',
                                        letterSpacing: '0.04em',
                                    }}>
                                        {msg.sender_name}
                                    </span>
                                    <span style={{ fontFamily: 'var(--rt-font-mono)', fontSize: 'var(--rt-text-xs)', color: 'var(--rt-ink-faint)' }}>
                                        {msg.timestamp}
                                    </span>
                                </div>
                                <div style={{
                                    borderLeft: '3px solid var(--rt-teal-dim)',
                                    backgroundColor: 'color-mix(in srgb, var(--rt-teal) 5%, var(--rt-surface-raised))',
                                    padding: 'var(--rt-space-3) var(--rt-space-4)',
                                    borderRadius: '0 var(--rt-radius-md) var(--rt-radius-md) 0',
                                    fontFamily: 'var(--rt-font-body)',
                                    color: 'var(--rt-ink-on-dark)',
                                    lineHeight: 1.65,
                                }}>
                                    {renderMessageContent(msg.content, msg.message_type, false)}
                                </div>
                            </div>
                        );
                    }

                    /* ── Human player (me) ── */
                    if (isMe) {
                        return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--rt-space-1)' }}>
                                <div className="flex items-center gap-2 flex-row-reverse">
                                    <div style={{
                                        width: 28, height: 28,
                                        borderRadius: '50%',
                                        backgroundColor: 'color-mix(in srgb, var(--rt-crimson) 20%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--rt-crimson) 40%, transparent)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <User style={{ width: 14, height: 14, color: 'var(--rt-crimson)' }} />
                                    </div>
                                    <span style={{
                                        fontFamily: 'var(--rt-font-mono)',
                                        fontSize: 'var(--rt-text-xs)',
                                        color: 'var(--rt-ink-on-dark-muted)',
                                        letterSpacing: '0.04em',
                                    }}>
                                        {msg.sender_name}
                                    </span>
                                    <span style={{ fontFamily: 'var(--rt-font-mono)', fontSize: 'var(--rt-text-xs)', color: 'var(--rt-ink-faint)' }}>
                                        {msg.timestamp}
                                    </span>
                                </div>
                                <div style={{
                                    borderRight: '3px solid var(--rt-crimson)',
                                    backgroundColor: 'color-mix(in srgb, var(--rt-crimson) 8%, var(--rt-surface-raised))',
                                    padding: 'var(--rt-space-3) var(--rt-space-4)',
                                    borderRadius: 'var(--rt-radius-md) 0 0 var(--rt-radius-md)',
                                    fontFamily: 'var(--rt-font-body)',
                                    color: 'var(--rt-ink-on-dark)',
                                    lineHeight: 1.65,
                                    maxWidth: '90%',
                                }}>
                                    {renderMessageContent(msg.content, msg.message_type, false)}
                                </div>
                            </div>
                        );
                    }

                    /* ── Other human player ── */
                    return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rt-space-1)' }}>
                            <div className="flex items-center gap-2">
                                <div style={{
                                    width: 28, height: 28,
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--rt-surface-raised)',
                                    border: '1px solid var(--rt-border-light)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <User style={{ width: 14, height: 14, color: 'var(--rt-ink-muted)' }} />
                                </div>
                                <span style={{
                                    fontFamily: 'var(--rt-font-mono)',
                                    fontSize: 'var(--rt-text-xs)',
                                    color: 'var(--rt-ink-on-dark-muted)',
                                    letterSpacing: '0.04em',
                                }}>
                                    {msg.sender_name}
                                </span>
                                <span style={{ fontFamily: 'var(--rt-font-mono)', fontSize: 'var(--rt-text-xs)', color: 'var(--rt-ink-faint)' }}>
                                    {msg.timestamp}
                                </span>
                            </div>
                            <div style={{
                                borderLeft: '3px solid var(--rt-border-light)',
                                backgroundColor: 'var(--rt-surface-raised)',
                                padding: 'var(--rt-space-3) var(--rt-space-4)',
                                borderRadius: '0 var(--rt-radius-md) var(--rt-radius-md) 0',
                                fontFamily: 'var(--rt-font-body)',
                                color: 'var(--rt-ink-on-dark)',
                                lineHeight: 1.65,
                            }}>
                                {renderMessageContent(msg.content, msg.message_type, false)}
                            </div>
                        </div>
                    );
                })}

                <div ref={bottomRef} />
            </div>

            {/* ── Input area ── */}
            <div style={{
                padding: 'var(--rt-space-3) var(--rt-space-4)',
                borderTop: '1px solid var(--rt-border)',
                backgroundColor: 'var(--rt-surface-raised)',
                position: 'relative',
            }}>
                <CommandSuggestions
                    inputValue={inputValue}
                    characterId={characterId}
                    userId={profile?.id || user?.uid}
                    onSelect={(selectedText, isArgument, targetId) => {
                        const newText = applyCommandSuggestion(inputValue, selectedText, isArgument);
                        if (targetId) {
                            setTargetMap(prev => ({ ...prev, [selectedText.toLowerCase()]: targetId }));
                        }
                        setInputValue(newText);
                        inputRef.current?.focus();
                    }}
                />

                {/* End Turn — visible during combat on player's turn */}
                {(() => {
                    const gs = useSocketStore.getState().gameState;
                    const userId = profile?.id || user?.uid;
                    const party = (gs?.party || []) as Character[];
                    const myChar = characterId
                        ? party.find(p => p.id === characterId)
                        : party.find(p => p.user_id === userId);
                    const isMyTurn = gs?.phase === 'combat' && myChar && gs?.active_entity_id === myChar.id;

                    return isMyTurn ? (
                        <button
                            onClick={() => {
                                if (socket) {
                                    socket.emit('chat_message', {
                                        content: '@endturn',
                                        sender_name: myChar.name,
                                        sender_id: myChar.id,
                                    });
                                }
                            }}
                            className="flex items-center justify-center gap-2 w-full"
                            style={{
                                marginBottom: 'var(--rt-space-2)',
                                padding: 'var(--rt-space-2) var(--rt-space-4)',
                                backgroundColor: 'color-mix(in srgb, var(--rt-gold) 10%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--rt-gold) 30%, transparent)',
                                borderRadius: 'var(--rt-radius-md)',
                                color: 'var(--rt-gold)',
                                fontFamily: 'var(--rt-font-mono)',
                                fontSize: 'var(--rt-text-sm)',
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                transition: 'background-color var(--rt-ease-std)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--rt-gold) 18%, transparent)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--rt-gold) 10%, transparent)'}
                        >
                            <SkipForward style={{ width: 14, height: 14 }} />
                            End Turn
                        </button>
                    ) : null;
                })()}

                <div style={{ position: 'relative' }}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isDmTyping ? "The DM is narrating…" : "What do you do? (Type @ for commands)"}
                        style={{
                            width: '100%',
                            backgroundColor: 'var(--rt-surface)',
                            border: '1px solid var(--rt-border)',
                            borderRadius: 'var(--rt-radius-md)',
                            padding: 'var(--rt-space-3) var(--rt-space-12) var(--rt-space-3) var(--rt-space-4)',
                            color: 'var(--rt-ink-on-dark)',
                            fontFamily: 'var(--rt-font-body)',
                            fontSize: 'var(--rt-text-base)',
                            outline: 'none',
                            transition: 'border-color var(--rt-ease-fast), box-shadow var(--rt-ease-fast)',
                        }}
                        onFocus={e => {
                            e.currentTarget.style.borderColor = 'var(--rt-gold-dim)';
                            e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--rt-gold) 15%, transparent)';
                        }}
                        onBlur={e => {
                            e.currentTarget.style.borderColor = 'var(--rt-border)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    />
                    <button
                        onClick={handleSend}
                        aria-label="Send message"
                        disabled={!inputValue.trim() || (isDmTyping && inputValue.startsWith('@'))}
                        className="rt-btn rt-btn-primary"
                        style={{
                            position: 'absolute',
                            right: 6,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            padding: '6px 10px',
                            fontSize: 'var(--rt-text-xs)',
                            opacity: (!inputValue.trim() || (isDmTyping && inputValue.startsWith('@'))) ? 0.4 : 1,
                            cursor: (!inputValue.trim() || (isDmTyping && inputValue.startsWith('@'))) ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <Send style={{ width: 14, height: 14 }} />
                    </button>
                </div>
            </div>
        </div>
    );
}
