import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import styles from './EmptyState.module.css';

export const EmptyState = () => {
    const { sendEvent } = useIPC();
    const copied = useAgentStore((state) => state.isPromptCopied);

    return (
        <div className={styles.container}>
            <div className={styles.asciiArt}>
{`   ___ ________  _  __
  / _ /  _/ __ \\(_)/ /_
 / __ |/ // /_/ / / __/
/_/ |_/___/____/_/\\__/ `}
            </div>
            
            <div className={styles.textBlock}>
                AI Diff Agent v2.2 (CLI Mode)<br/>
                Deterministic XML AST parsing engine active.
            </div>

            <div className={styles.textBlock}>
                <div className={styles.cmdLine}>$ supported-schemas --list</div>
                <div className={styles.toolsList}>
                    <span>[+] create_file</span>
                    <span>[M] update_file</span>
                    <span>[D] delete_path</span>
                    <span>[R] move_path</span>
                </div>
            </div>

            <div className={styles.actions}>
                <button className={styles.btn} onClick={() => sendEvent({ type: 'COPY_PROMPT' })}>
                    {copied ? '✔ System Prompt Copied' : '> Copy System Prompt'}
                </button>
            </div>
        </div>
    );
};
