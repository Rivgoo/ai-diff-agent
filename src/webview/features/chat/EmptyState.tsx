import { useContext, useState, useRef, useEffect } from 'react';
import { useIPC } from '@/webview/hooks/useIPC';
import { AgentContext } from '@/webview/store/AgentProvider';
import { Button } from '@/webview/shared/ui/Button/Button';
import { OperationLegend } from './components/OperationLegend';
import { IconCopy, IconDownload, IconTerminal, IconSettings, IconChevronDown } from '@tabler/icons-react';
import styles from './EmptyState.module.css';

export const EmptyState = () => {
    const { sendEvent } = useIPC();
    const context = useContext(AgentContext); // ФІКС
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [promptMode, setPromptMode] = useState<'stable' | 'experimental'>('stable');
    const dropdownRef = useRef<HTMLDivElement>(null);

    if (!context) throw new Error('EmptyState must be inside AgentProvider');

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>AI DIFF AGENT</h1>
            <p className={styles.description}>
                A transactional diff engine designed to stage, review, and apply code modifications with human-in-the-loop control.
            </p>

            <div className={styles.actionsGrid}>
                
                <div style={{ display: 'flex', width: '100%', position: 'relative' }} ref={dropdownRef}>
                    <Button 
                        variant="secondary" 
                        onClick={() => { sendEvent({ type: 'COPY_PROMPT', mode: promptMode }); setIsDropdownOpen(false); }} 
                        style={{ flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: '1px solid var(--vscode-panel-border)' }}
                    >
                        <IconCopy size={14} />
                        <span>{context.state.isPromptCopied ? 'Copied' : `Rules (${promptMode})`}</span>
                    </Button>
                    <Button 
                        variant="secondary" 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        style={{ width: '24px', padding: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                    >
                        <IconChevronDown size={14} />
                    </Button>
                    
                    {isDropdownOpen && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', backgroundColor: 'var(--vscode-dropdown-background)', border: '1px solid var(--vscode-dropdown-border)', borderRadius: '4px', zIndex: 1000, display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
                            <button style={{ background: 'none', border: 'none', padding: '8px 12px', color: 'var(--vscode-dropdown-foreground)', textAlign: 'left', fontSize: '11px', cursor: 'pointer' }} onClick={() => { setPromptMode('stable'); setIsDropdownOpen(false); }}>
                                Stable (Full Files)
                            </button>
                            <button style={{ background: 'none', border: 'none', padding: '8px 12px', color: 'var(--vscode-dropdown-foreground)', textAlign: 'left', fontSize: '11px', cursor: 'pointer' }} onClick={() => { setPromptMode('experimental'); setIsDropdownOpen(false); }}>
                                Experimental (Diffs)
                            </button>
                        </div>
                    )}
                </div>

                <Button variant="secondary" onClick={() => sendEvent({ type: 'DOWNLOAD_INSTRUCTIONS' })}>
                    <IconDownload size={14} />
                    <span>Instructions</span>
                </Button>

                <Button variant="secondary" onClick={() => sendEvent({ type: 'SHOW_OUTPUT_LOG' })}>
                    <IconTerminal size={14} />
                    <span>Open Logs</span>
                </Button>

                <Button variant="secondary" onClick={context.actions.toggleSettings}>
                    <IconSettings size={14} />
                    <span>Settings</span>
                </Button>
            </div>

            <OperationLegend />
        </div>
    );
};