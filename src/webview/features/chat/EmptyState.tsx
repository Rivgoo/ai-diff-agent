import { useContext, useState, useRef, useEffect } from 'react';
import { useIPC } from '@/webview/hooks/useIPC';
import { AgentContext } from '@/webview/store/AgentProvider';
import { Button } from '@/webview/shared/ui/Button/Button';
import { OperationLegend } from './components/OperationLegend';
import { IconCopy, IconDownload, IconTerminal, IconSettings, IconChevronDown } from '@tabler/icons-react';
import styles from './EmptyState.module.css';

export const EmptyState = () => {
    const { sendEvent } = useIPC();
    const context = useContext(AgentContext);
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [activePromptLabel, setActivePromptLabel] = useState('System (Stable)');
    
    // Зберігаємо поточний вибір, щоб копіювати по кліку на головну кнопку
    const [currentSelection, setCurrentSelection] = useState<{ mode: 'system'|'custom', formatId: 'stable'|'experimental', customPath?: string }>({
        mode: 'system',
        formatId: 'stable'
    });

    const dropdownRef = useRef<HTMLDivElement>(null);

    if (!context) throw new Error('EmptyState must be inside AgentProvider');

    const customPrompts = context.state.settings.ai.customPrompts || [];

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (label: string, payload: typeof currentSelection) => {
        setActivePromptLabel(label);
        setCurrentSelection(payload);
        setIsDropdownOpen(false);
    };

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
                        onClick={() => { sendEvent({ type: 'COPY_PROMPT', ...currentSelection }); setIsDropdownOpen(false); }} 
                        style={{ flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: '1px solid var(--vscode-panel-border)' }}
                    >
                        <IconCopy size={14} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
                            {context.state.isPromptCopied ? 'Copied' : activePromptLabel}
                        </span>
                    </Button>
                    <Button 
                        variant="secondary" 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        style={{ width: '24px', padding: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                    >
                        <IconChevronDown size={14} />
                    </Button>
                    
                    {isDropdownOpen && (
                        <div className={styles.dropdownMenu}>
                            <button className={styles.dropdownItem} onClick={() => handleSelect('System (Stable)', { mode: 'system', formatId: 'stable' })}>
                                System: Stable (Full Files)
                            </button>
                            <button className={styles.dropdownItem} onClick={() => handleSelect('System (Diff)', { mode: 'system', formatId: 'experimental' })}>
                                System: Experimental (Diffs)
                            </button>
                            
                            {customPrompts.length > 0 && (
                                <>
                                    <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--vscode-dropdown-border)' }} />
                                    {customPrompts.map(cp => (
                                        <button 
                                            key={cp.id} 
                                            className={styles.dropdownItem} 
                                            onClick={() => handleSelect(cp.name, { mode: 'custom', formatId: cp.baseFormat, customPath: cp.path })}
                                            title={`Base: ${cp.baseFormat}\nPath: ${cp.path}`}
                                        >
                                            {cp.name}
                                        </button>
                                    ))}
                                </>
                            )}
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