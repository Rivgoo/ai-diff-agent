import { useEffect, useRef, useState } from 'react';
import { PayloadComposer } from './components/composer/PayloadComposer';
import { MessageBubble } from './components/chat/MessageBubble';
import { SettingsModal } from './components/settings/SettingsModal';
import { PipelineProgress } from './components/progress/PipelineProgress';
import { useAgentStore } from './store/agentStore';
import { useIPC } from './hooks/useIPC';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { IconSettings, IconTrash, IconDots, IconDownload } from '@tabler/icons-react';

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
                        <IconSettings size={16} />
                    </VSCodeButton>
                    <VSCodeButton appearance="icon" onClick={handleClearSession} title="Clear Chat History">
                        <IconTrash size={16} />
                    </VSCodeButton>
                    <div style={{ position: 'relative' }}>
                        <VSCodeButton appearance="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} title="More Options">
                            <IconDots size={16} />
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
                                    <IconDownload size={14} /> Get AI Instructions
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

            {/* Payload Composer */}
            <PayloadComposer />
        </div>
    );
};
