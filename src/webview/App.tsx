import { useEffect, useRef, useState } from 'react';
import { ChatInput } from './components/ChatInput';
import { MessageBubble } from './components/chat/MessageBubble';
import { SettingsModal } from './components/settings/SettingsModal';
import { PipelineProgress } from './components/progress/PipelineProgress';
import { useAgentStore } from './store/agentStore';
import { useIPC } from './hooks/useIPC';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';

const SettingsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
        <path d="M9.1 1.006L8.9 1H7.1l-.2.006-.35.912-.136.082a5.55 5.55 0 00-.733.533l-.116.108-.94-.31-.137.054-.9.9-.054.137.31.94-.108.116a5.55 5.55 0 00-.533.733l-.082.136-.912.35L1 7.1v1.8l.006.2.912.35.082.136c.148.243.326.49.533.733l.108.116-.31.94.054.137.9.9.137-.054.94-.31.116.108c.243.207.49.385.733.533l.136.082.35.912.2.006h1.8l.2-.006.35-.912.136-.082c.243-.148.49-.326.733-.533l.116-.108.94.31.137.054.9-.9.054-.137-.31-.94.108-.116c.207-.243.385-.49.533-.733l.082-.136.912-.35.006-.2V7.1l-.006-.2-.912-.35-.082-.136a5.55 5.55 0 00-.533-.733l-.108-.116.31-.94-.054-.137-.9-.9-.137.054-.94.31-.116-.108a5.54 5.55 0 00-.733-.533l-.136-.082-.35-.912zM8 11a3 3 0 110-6 3 3 0 010 6z" />
    </svg>
);

const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
        <path fillRule="evenodd" clipRule="evenodd" d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2l1-1h4l1 1v1zm-1 0V2H6v1h3zM4 13h7V4H4v9zm2-8H5v7h1V5zm3 0H8v7h1V5z" />
    </svg>
);

const MoreIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
        <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
    </svg>
);

const DownloadIcon = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
        <path fillRule="evenodd" clipRule="evenodd" d="M8 1l.64.15 4 4-.71.7L9 3.01v8.43l-.5.5h-1l-.5-.5V3.01L4.07 5.86l-.71-.7 4-4L8 1zm-5 11h10v1H3v-1z" />
    </svg>
);

const EmptyState = () => (
    <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--vscode-descriptionForeground)' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vscode-foreground)' }}>
            AI Diff Agent
        </div>
        <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
            Paste an AI-generated XML payload in the input below. The agent will parse operations, stage changes inline in your editor, and let you review each one before committing.
        </div>
        <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ padding: '6px 8px', backgroundColor: 'var(--vscode-editor-background)', borderRadius: '4px', border: '1px solid var(--vscode-panel-border)', fontFamily: 'var(--vscode-editor-font-family)' }}>
                Supports: <code>create_file</code>, <code>update_file</code>, <code>delete_path</code>, <code>move_path</code>, <code>create_dir</code>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
                Use <strong>Get AI Instructions</strong> (⋯ menu) to download the prompt template for your LLM.
            </div>
        </div>
    </div>
);

export const App = () => {
    const { sendEvent } = useIPC();
    const messages = useAgentStore((state) => state.messages);
    const isTyping = useAgentStore((state) => state.isAgentTyping);
    const settings = useAgentStore((state) => state.settings);
    const toggleSettings = useAgentStore((state) => state.toggleSettings);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (settings.autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping, settings.autoScroll]);

    const handleClearSession = () => sendEvent({ type: 'CLEAR_SESSION' });
    const handleDownloadInstructions = () => {
        sendEvent({ type: 'DOWNLOAD_INSTRUCTIONS' });
        setIsMenuOpen(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--vscode-sideBar-background)', position: 'relative' }}>
            <SettingsModal />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 }}>
                <span style={{ fontWeight: 600, color: 'var(--vscode-foreground)', fontSize: '12px' }}>AI Diff Agent</span>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    <VSCodeButton appearance="icon" onClick={toggleSettings} title="Settings">
                        <SettingsIcon />
                    </VSCodeButton>
                    <VSCodeButton appearance="icon" onClick={handleClearSession} title="Clear Chat History">
                        <TrashIcon />
                    </VSCodeButton>
                    <div style={{ position: 'relative' }}>
                        <VSCodeButton appearance="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} title="More Options">
                            <MoreIcon />
                        </VSCodeButton>
                        {isMenuOpen && (
                            <div style={{
                                position: 'absolute', top: '28px', right: '0',
                                backgroundColor: 'var(--vscode-dropdown-background)',
                                border: '1px solid var(--vscode-dropdown-border)',
                                borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                zIndex: 1000, minWidth: '160px', display: 'flex',
                                flexDirection: 'column', padding: '4px 0'
                            }}>
                                <button
                                    onClick={handleDownloadInstructions}
                                    style={{
                                        background: 'none', border: 'none',
                                        color: 'var(--vscode-dropdown-foreground)',
                                        padding: '8px 12px', textAlign: 'left',
                                        cursor: 'pointer', fontSize: '11px', width: '100%',
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        fontFamily: 'var(--vscode-font-family)'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--vscode-list-activeSelectionBackground)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <DownloadIcon /> Get AI Instructions
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Pipeline progress bar */}
            <PipelineProgress />

            {/* Messages Area */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.length === 0 ? (
                    <EmptyState />
                ) : (
                    messages.map((msg) => (
                        <MessageBubble key={msg.id} message={msg} />
                    ))
                )}
                {isTyping && (
                    <div style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic', paddingLeft: '4px', fontSize: '12px' }}>
                        Applying payload...
                    </div>
                )}
            </div>

            <ChatInput />
        </div>
    );
};
