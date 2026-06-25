import { useEffect, useRef } from 'react';
import { PayloadComposer } from './components/composer/PayloadComposer';
import { MessageBubble } from './components/chat/MessageBubble';
import { SettingsModal } from './components/settings/SettingsModal';
import { PipelineProgress } from './components/progress/PipelineProgress';
import { useAgentStore } from './store/agentStore';

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
        </div>
    </div>
);

export const App = () => {
    const messages = useAgentStore((state) => state.messages);
    const isTyping = useAgentStore((state) => state.isAgentTyping);
    const settings = useAgentStore((state) => state.settings);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (settings.autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping, settings.autoScroll]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--vscode-sideBar-background)', position: 'relative' }}>
            <SettingsModal />

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
