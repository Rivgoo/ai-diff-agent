import { useEffect, useRef } from 'react';
import { PayloadComposer } from './components/composer/PayloadComposer';
import { MessageBubble } from './components/chat/MessageBubble';
import { SettingsModal } from './components/settings/SettingsModal';
import { PipelineProgress } from './components/progress/PipelineProgress';
import { StickyBatchBar } from './components/review/StickyBatchBar';
import { useAgentStore } from './store/agentStore';
import { useIPC } from './hooks/useIPC';
import { IconRobot, IconDownload, IconCopy, IconCheck, IconFileCode } from '@tabler/icons-react';

const EmptyState = () => {
    const { sendEvent } = useIPC();
    const copied = useAgentStore((state) => state.isPromptCopied);

    const supportedTools = [
        { name: 'create_file', label: 'Create', color: 'var(--vscode-testing-iconPassed)' },
        { name: 'update_file', label: 'Update', color: 'var(--vscode-textLink-foreground)' },
        { name: 'delete_path', label: 'Delete', color: 'var(--vscode-testing-iconFailed)' },
        { name: 'move_path', label: 'Move', color: 'var(--vscode-editorWarning-foreground)' }
    ];

    return (
        <div style={{ 
            padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '12px', 
            color: 'var(--vscode-descriptionForeground)', fontFamily: 'var(--vscode-font-family)', boxSizing: 'border-box'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '6px' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px',
                    borderRadius: '50%', backgroundColor: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-textLink-foreground)', border: '1px solid var(--vscode-panel-border)'
                }}>
                    <IconRobot size={20} />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vscode-foreground)' }}>AI Diff Agent</div>
                <div style={{ fontSize: '11px', lineHeight: '1.35', padding: '0 4px' }}>
                    Automate structural edits and code updates safely with transactional human-in-the-loop review.
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--vscode-foreground)' }}>
                    Operations
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '2px 0' }}>
                    {supportedTools.map((tool) => (
                        <div key={tool.name} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px',
                            backgroundColor: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)',
                            borderRadius: '10px', fontSize: '10px', color: 'var(--vscode-foreground)'
                        }}>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: tool.color }} />
                            <code style={{ fontFamily: 'var(--vscode-editor-font-family)' }}>{tool.name}</code>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{
                display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px',
                backgroundColor: 'var(--vscode-welcomePage-tileBackground, var(--vscode-editor-background))',
                border: '1px solid var(--vscode-panel-border)', borderRadius: '6px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--vscode-foreground)' }}>
                    <IconFileCode size={16} style={{ color: 'var(--vscode-textLink-foreground)' }} />
                    <div style={{ fontSize: '11.5px', fontWeight: 600 }}>System Prompt Setup</div>
                </div>
                
                <div style={{ fontSize: '10.5px', lineHeight: '1.35' }}>
                    Instruct your LLM to format changes inside the custom XML-based DSL template.
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                    <button
                        onClick={() => sendEvent({ type: 'COPY_PROMPT' })}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            padding: '4px 6px', backgroundColor: 'var(--vscode-button-secondaryBackground)',
                            color: 'var(--vscode-button-secondaryForeground)', border: 'none', borderRadius: '4px',
                            cursor: 'pointer', fontSize: '10.5px', fontWeight: 600, flex: '1 1 100px', minHeight: '24px'
                        }}
                    >
                        {copied ? <><IconCheck size={12} style={{ color: 'var(--vscode-testing-iconPassed)' }} /> Copied!</> : <><IconCopy size={12} /> Copy Prompt</>}
                    </button>
                    <button
                        onClick={() => sendEvent({ type: 'DOWNLOAD_INSTRUCTIONS' })}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            padding: '4px 6px', backgroundColor: 'var(--vscode-button-background)',
                            color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: '4px',
                            cursor: 'pointer', fontSize: '10.5px', fontWeight: 600, flex: '1 1 100px', minHeight: '24px'
                        }}
                    >
                        <IconDownload size={12} /> Get Instructions
                    </button>
                </div>
            </div>
        </div>
    );
};

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
            <style>{`
                body { padding: 0 !important; margin: 0 !important; overflow: hidden !important; }
                #root { height: 100vh; width: 100%; margin: 0; padding: 0; }
            `}</style>
            
            <SettingsModal />
            <PipelineProgress />

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {messages.length === 0 ? <EmptyState /> : messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
            </div>

            <StickyBatchBar />
            <PayloadComposer />
        </div>
    );
};
