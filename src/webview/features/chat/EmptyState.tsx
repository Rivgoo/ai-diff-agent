import { use } from 'react';
import { useIPC } from '@/webview/hooks/useIPC';
import { AgentContext } from '@/webview/store/AgentProvider';
import { Button } from '@/webview/shared/ui/Button/Button';
import { OperationLegend } from './components/OperationLegend';
import { IconCopy, IconDownload, IconTerminal, IconSettings } from '@tabler/icons-react';
import styles from './EmptyState.module.css';

export const EmptyState = () => {
    const { sendEvent } = useIPC();
    const context = use(AgentContext);
    
    if (!context) throw new Error('EmptyState must be inside AgentProvider');

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>AI DIFF AGENT</h1>
            <p className={styles.description}>
                A transactional diff engine designed to stage, review, and apply code modifications with human-in-the-loop control.
            </p>

            <div className={styles.actionsGrid} role="group" aria-label="Quick actions menu">
                <Button variant="secondary" onClick={() => sendEvent({ type: 'COPY_PROMPT' })} aria-label="Copy prompt rules">
                    <IconCopy size={14} aria-hidden="true" />
                    <span>{context.state.isPromptCopied ? 'Copied' : 'Copy Rules'}</span>
                </Button>

                <Button variant="secondary" onClick={() => sendEvent({ type: 'DOWNLOAD_INSTRUCTIONS' })} aria-label="Download instructions">
                    <IconDownload size={14} aria-hidden="true" />
                    <span>Instructions</span>
                </Button>

                <Button variant="secondary" onClick={() => sendEvent({ type: 'SHOW_OUTPUT_LOG' })} aria-label="Open logs">
                    <IconTerminal size={14} aria-hidden="true" />
                    <span>Open Logs</span>
                </Button>

                <Button variant="secondary" onClick={context.actions.toggleSettings} aria-label="Open settings">
                    <IconSettings size={14} aria-hidden="true" />
                    <span>Settings</span>
                </Button>
            </div>

            <OperationLegend />
        </div>
    );
};