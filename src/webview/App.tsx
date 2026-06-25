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
    IconFileCode
} from '@tabler/icons-react';

const FULL_SYSTEM_PROMPT = `# ROLE AND OBJECTIVE
You are an elite AI coding assistant. Your primary task is to generate code modifications that will be automatically parsed and applied by a custom VS Code extension.

Strictest adherence to the XML-based output format is mandatory.

# THE CONTRACT: XML-BASED DSL
Wrap all file system operations inside a <workspace_edit> root tag.

## 1. Create File
<create_file path="path/to/new/file.ts">
// Complete file content goes here
</create_file>

## 2. Update File (Search and Replace)
<update_file path="path/to/existing/file.ts">
    <change>
        <search>
Exact lines of code to find. Include enough context to be unique.
        </search>
        <replace>
The new lines of code that will replace the search block.
        </replace>
    </change>
</update_file>

## 3. Delete Path
<delete_path path="path/to/delete.ts" />

## 4. Move / Rename Path
<move_path src="old/path.ts" dest="new/path.ts" />

## 5. Create Directory
<create_dir path="new/folder/path" />

# CRITICAL RULES
1. NEVER use placeholders like "// ... existing code ...". Always output full replacement code.
2. Spacing, indentation, and content inside the <search> block must be an exact verbatim match of the file.
3. Output ONLY valid XML inside the <workspace_edit> block. Do not use markdown code fences around the XML tags.`;

const EmptyState = () => {
    const { sendEvent } = useIPC();
    const [copied, setCopied] = useState(false);

    const handleDownloadInstructions = () => {
        sendEvent({ type: 'DOWNLOAD_INSTRUCTIONS' });
    };

    const handleCopyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(FULL_SYSTEM_PROMPT);
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
            padding: '12px 10px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px', 
            color: 'var(--vscode-descriptionForeground)',
            fontFamily: 'var(--vscode-font-family)',
            maxWidth: '100%',
            boxSizing: 'border-box'
        }}>
            {/* Visual Header Banner */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-textLink-foreground)',
                    marginBottom: '2px',
                    border: '1px solid var(--vscode-panel-border)'
                }}>
                    <IconRobot size={24} />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--vscode-foreground)' }}>
                    AI Diff Agent
                </div>
                <div style={{ fontSize: '11.5px', lineHeight: '1.4', padding: '0 6px' }}>
                    Automate file generation, structural changes, and code updates safely with human-in-the-loop review.
                </div>
            </div>

            {/* Supported Operations Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--vscode-foreground)' }}>
                    Supported Engine Operations
                </div>
                <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '6px',
                    padding: '4px 0'
                }}>
                    {supportedTools.map((tool) => (
                        <div 
                            key={tool.name} 
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 8px',
                                backgroundColor: 'var(--vscode-editor-background)',
                                border: '1px solid var(--vscode-panel-border)',
                                borderRadius: '12px',
                                fontSize: '10.5px',
                                color: 'var(--vscode-foreground)',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <span style={{ 
                                width: '5px', 
                                height: '5px', 
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
                gap: '10px',
                padding: '12px 10px',
                backgroundColor: 'var(--vscode-welcomePage-tileBackground, var(--vscode-editor-background))',
                border: '1px solid var(--vscode-panel-border)',
                borderRadius: '6px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--vscode-foreground)' }}>
                    <IconFileCode size={18} style={{ color: 'var(--vscode-textLink-foreground)' }} />
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>Configure LLM System Prompt</div>
                </div>
                
                <div style={{ fontSize: '11px', lineHeight: '1.45' }}>
                    To use the agent, tell your favorite LLM to format its code modifications inside our custom XML-based DSL template.
                </div>

                {/* Highly Adaptive Button Container */}
                <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '6px',
                    marginTop: '2px' 
                }}>
                    {/* Copy Full System Prompt Button */}
                    <button
                        onClick={handleCopyPrompt}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '6px 8px',
                            backgroundColor: 'var(--vscode-button-secondaryBackground)',
                            color: 'var(--vscode-button-secondaryForeground)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'var(--vscode-font-family)',
                            transition: 'opacity 0.15s ease',
                            flex: '1 1 120px',
                            whiteSpace: 'nowrap',
                            minHeight: '28px'
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
                                Copy System Prompt
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
                            padding: '6px 8px',
                            backgroundColor: 'var(--vscode-button-background)',
                            color: 'var(--vscode-button-foreground)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'var(--vscode-font-family)',
                            transition: 'opacity 0.15s ease',
                            flex: '1 1 120px',
                            whiteSpace: 'nowrap',
                            minHeight: '28px'
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
            {/* Global style override to fix VS Code webview default body padding */}
            <style>{`
                body {
                    padding: 0 !important;
                    margin: 0 !important;
                    overflow: hidden !important;
                }
                #root {
                    height: 100vh;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                }
            `}</style>

            <SettingsModal />

            {/* Pipeline progress bar */}
            <PipelineProgress />

            {/* Messages Area with compact paddings */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.length === 0 ? (
                    <EmptyState />
                ) : (
                    messages.map((msg) => (
                        <MessageBubble key={msg.id} message={msg} />
                    ))
                )}
                {isTyping && (
                    <div style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic', paddingLeft: '4px', fontSize: '11.5px' }}>
                        Applying...
                    </div>
                )}
            </div>

            {/* Payload Composer */}
            <PayloadComposer />
        </div>
    );
};