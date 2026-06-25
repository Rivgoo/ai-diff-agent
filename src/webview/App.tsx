import { useEffect, useRef, useState } from 'react';
import { PayloadComposer } from './components/composer/PayloadComposer';
import { MessageBubble } from './components/chat/MessageBubble';
import { SettingsModal } from './components/settings/SettingsModal';
import { PipelineProgress } from './components/progress/PipelineProgress';
import { useAgentStore } from './store/agentStore';
import { useIPC } from './hooks/useIPC';
import { 
    IconRobot, 
    IconDownload, 
    IconCopy, 
    IconCheck, 
    IconFileCode, 
    IconTerminal,
    IconBook
} from '@tabler/icons-react';

const SHORT_XML_TEMPLATE = `<workspace_edit>
    <update_file path="src/index.ts">
        <change>
            <search>
const appVersion = "0.1.0";
            </search>
            <replace>
const appVersion = "0.2.0";
            </replace>
        </change>
    </update_file>
</workspace_edit>`;

const EmptyState = () => {
    const { sendEvent } = useIPC();
    const [copied, setCopied] = useState(false);

    const handleDownloadInstructions = () => {
        sendEvent({ type: 'DOWNLOAD_INSTRUCTIONS' });
    };

    const handleCopyExample = async () => {
        try {
            await navigator.clipboard.writeText(SHORT_XML_TEMPLATE);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const supportedTools = [
        { name: 'create_file', label: 'Create File', color: 'var(--vscode-testing-iconPassed)' },
        { name: 'update_file', label: 'Update File', color: 'var(--vscode-textLink-foreground)' },
        { name: 'delete_path', label: 'Delete Path', color: 'var(--vscode-testing-iconFailed)' },
        { name: 'move_path', label: 'Move/Rename', color: 'var(--vscode-editorWarning-foreground)' },
        { name: 'create_dir', label: 'Create Directory', color: 'var(--vscode-badge-background)' }
    ];

    return (
        <div style={{ 
            padding: '20px 14px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px', 
            color: 'var(--vscode-descriptionForeground)',
            fontFamily: 'var(--vscode-font-family)',
            maxWidth: '100%',
            boxSizing: 'border-box'
        }}>
            {/* Visual Header Banner */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px', marginTop: '8px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-textLink-foreground)',
                    marginBottom: '4px',
                    border: '1px solid var(--vscode-panel-border)'
                }}>
                    <IconRobot size={28} />
                </div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--vscode-foreground)' }}>
                    AI Diff Agent
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.5', padding: '0 10px' }}>
                    Automate file generation, structural changes, and code updates safely with human-in-the-loop review.
                </div>
            </div>

            {/* Supported Operations Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--vscode-foreground)' }}>
                    Supported Engine Operations
                </div>
                <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '6px',
                    padding: '8px 0'
                }}>
                    {supportedTools.map((tool) => (
                        <div 
                            key={tool.name} 
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                backgroundColor: 'var(--vscode-editor-background)',
                                border: '1px solid var(--vscode-panel-border)',
                                borderRadius: '12px',
                                fontSize: '11px',
                                color: 'var(--vscode-foreground)',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <span style={{ 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%', 
                                backgroundColor: tool.color,
                                flexShrink: 0
                            }} />
                            <code style={{ fontFamily: 'var(--vscode-editor-font-family)' }}>{tool.name}</code>
                        </div>
                    ))}
                </div>
            </div>

            {/* Prompt Instructions Call to Action Card */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px 14px',
                backgroundColor: 'var(--vscode-welcomePage-tileBackground, var(--vscode-editor-background))',
                border: '1px solid var(--vscode-panel-border)',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--vscode-foreground)' }}>
                    <IconFileCode size={20} style={{ color: 'var(--vscode-textLink-foreground)' }} />
                    <div style={{ fontSize: '12.5px', fontWeight: 600 }}>Configure LLM System Prompt</div>
                </div>
                
                <div style={{ fontSize: '11.5px', lineHeight: '1.5' }}>
                    To use the agent, tell your favorite LLM to format its code modifications inside our custom XML-based DSL template.
                </div>

                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '8px',
                    marginTop: '4px' 
                }}>
                    {/* Copy Template Button */}
                    <button
                        onClick={handleCopyExample}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 10px',
                            backgroundColor: 'var(--vscode-button-secondaryBackground)',
                            color: 'var(--vscode-button-secondaryForeground)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'var(--vscode-font-family)',
                            transition: 'opacity 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                        {copied ? (
                            <>
                                <IconCheck size={14} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
                                Copied!
                            </>
                        ) : (
                            <>
                                <IconCopy size={14} />
                                Copy Example XML
                            </>
                        )}
                    </button>

                    {/* Download Guide Button */}
                    <button
                        onClick={handleDownloadInstructions}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 10px',
                            backgroundColor: 'var(--vscode-button-background)',
                            color: 'var(--vscode-button-foreground)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'var(--vscode-font-family)',
                            transition: 'opacity 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                        <IconDownload size={14} />
                        Get System Prompt
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