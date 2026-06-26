import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import { Button } from '@/webview/shared/ui/Button/Button';
import { IconRobot, IconDownload, IconCopy, IconCheck, IconFileCode } from '@tabler/icons-react';
import styles from './EmptyState.module.css';

const SUPPORTED_TOOLS = [
    { name: 'create_file', color: 'var(--vscode-testing-iconPassed)' },
    { name: 'update_file', color: 'var(--vscode-textLink-foreground)' },
    { name: 'delete_path', color: 'var(--vscode-testing-iconFailed)' },
    { name: 'move_path', color: 'var(--vscode-editorWarning-foreground)' }
];

export const EmptyState = () => {
    const { sendEvent } = useIPC();
    const copied = useAgentStore((state) => state.isPromptCopied);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.avatar}>
                    <IconRobot size={20} aria-hidden="true" />
                </div>
                <div className={styles.title}>AI Diff Agent</div>
                <div className={styles.subtitle}>
                    Automate structural edits and code updates safely with transactional human-in-the-loop review.
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className={styles.opsLabel}>Operations</div>
                <div className={styles.opsList}>
                    {SUPPORTED_TOOLS.map((tool) => (
                        <div key={tool.name} className={styles.opTag}>
                            <span className={styles.opDot} style={{ backgroundColor: tool.color }} aria-hidden="true" />
                            <code>{tool.name}</code>
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.promptCard}>
                <div className={styles.promptHeader}>
                    <IconFileCode size={16} style={{ color: 'var(--vscode-textLink-foreground)' }} aria-hidden="true" />
                    System Prompt Setup
                </div>
                <div className={styles.promptDesc}>
                    Instruct your LLM to format changes inside the custom XML-based DSL template.
                </div>
                <div className={styles.actions}>
                    <Button variant="secondary" className={styles.btnFill} onClick={() => sendEvent({ type: 'COPY_PROMPT' })}>
                        {copied ? <><IconCheck size={12} color="var(--vscode-testing-iconPassed)" /> Copied!</> : <><IconCopy size={12} /> Copy Prompt</>}
                    </Button>
                    <Button variant="primary" className={styles.btnFill} onClick={() => sendEvent({ type: 'DOWNLOAD_INSTRUCTIONS' })}>
                        <IconDownload size={12} /> Get Instructions
                    </Button>
                </div>
            </div>
        </div>
    );
};
