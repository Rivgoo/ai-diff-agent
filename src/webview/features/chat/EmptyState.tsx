import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import styles from './EmptyState.module.css';

export const EmptyState = () => {
    const { sendEvent } = useIPC();
    const settings = useAgentStore((state) => state.settings);
    const copied = useAgentStore((state) => state.isPromptCopied);

    return (
        <div className={styles.container}>
            {/* Minimalist ASCII Terminal Logo */}
            <div className={styles.asciiHeader}>
{`   _  _     ___  _  __  ___ 
  / _\\ |__ / _ \\(_)/ /_/ _ \\
  \\ \\| '_ / // / / __/ // /
  _\\ \\ | |\\__/_/ \\__/\\___/ 
  \\__/ |_|                 `}
            </div>

            {/* Reactive Environmental System Diagnostics */}
            <div className={styles.metaGrid}>
                <div className={styles.metaRow}>
                    <span className={styles.metaKey}>AGENT STATUS:</span>
                    <span className={`${styles.metaValue} ${styles.activeValue}`}>ONLINE</span>
                </div>
                <div className={styles.metaRow}>
                    <span className={styles.metaKey}>PARSING PATTERN:</span>
                    <span className={styles.metaValue}>
                        {settings.strictParsing ? (
                            <span className={styles.warnValue}>STRICT (STDOUT ENFORCED)</span>
                        ) : (
                            <span className={styles.activeValue}>RECOVERY (FUZZY FALLBACKS)</span>
                        )}
                    </span>
                </div>
                <div className={styles.metaRow}>
                    <span className={styles.metaKey}>AUTO-SCROLLING:</span>
                    <span className={styles.metaValue}>
                        {settings.autoScroll ? (
                            <span className={styles.activeValue}>ENABLED</span>
                        ) : (
                            <span>DISABLED</span>
                        )}
                    </span>
                </div>
                <div className={styles.metaRow}>
                    <span className={styles.metaKey}>PERSISTENCE ENGINE:</span>
                    <span className={styles.metaValue}>VSCODE MEMENTO SAGA</span>
                </div>
            </div>

            {/* CLI Command-Menu Palette */}
            <div className={styles.cmdSection}>
                <div className={styles.cmdTitle}>Quick Utility Menu</div>
                
                {/* Action 1: Copy System Prompt */}
                <div className={styles.commandBox}>
                    <div className={styles.commandText}>
                        <span className={styles.promptSymbol}>$</span>
                        <span>setup-prompt <span className={styles.argText}>--copy</span></span>
                    </div>
                    <button 
                        type="button" 
                        className={styles.actionBtn} 
                        onClick={() => sendEvent({ type: 'COPY_PROMPT' })}
                        aria-label="Copy AI rules to clipboard"
                    >
                        {copied ? 'Copied' : 'Execute'}
                    </button>
                </div>

                {/* Action 2: Get Instructions (RESTORED) */}
                <div className={styles.commandBox}>
                    <div className={styles.commandText}>
                        <span className={styles.promptSymbol}>$</span>
                        <span>get-docs <span className={styles.argText}>--download</span></span>
                    </div>
                    <button 
                        type="button" 
                        className={styles.actionBtn} 
                        onClick={() => sendEvent({ type: 'DOWNLOAD_INSTRUCTIONS' })}
                        aria-label="Download prompt instruction sheets"
                    >
                        Download
                    </button>
                </div>

                {/* Action 3: Show Output Logs (NEW) */}
                <div className={styles.commandBox}>
                    <div className={styles.commandText}>
                        <span className={styles.promptSymbol}>$</span>
                        <span>view-logs <span className={styles.argText}>--open</span></span>
                    </div>
                    <button 
                        type="button" 
                        className={styles.actionBtn} 
                        onClick={() => sendEvent({ type: 'SHOW_OUTPUT_LOG' })}
                        aria-label="Show background output diagnostics log"
                    >
                        Open Logs
                    </button>
                </div>

                {/* Action 4: Configure Settings Panel */}
                <div className={styles.commandBox}>
                    <div className={styles.commandText}>
                        <span className={styles.promptSymbol}>$</span>
                        <span>config-agent <span className={styles.argText}>--configure</span></span>
                    </div>
                    <button 
                        type="button" 
                        className={styles.actionBtn} 
                        onClick={() => useAgentStore.getState().toggleSettings()}
                        aria-label="Open settings dashboard panel"
                    >
                        Configure
                    </button>
                </div>
            </div>
        </div>
    );
};
