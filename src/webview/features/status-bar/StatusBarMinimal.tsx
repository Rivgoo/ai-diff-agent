import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import { StatusBarMetrics } from './components/StatusBarMetrics';
import { ActionControls } from './components/ActionControls';
import type { PipelineStage } from '@/shared/ipc';
import styles from './StatusBarMinimal.module.css';

const STAGE_LABELS: Record<PipelineStage, string> = {
    idle: '',
    parsing: 'Parsing AST...',
    validating: 'Validating bounds...',
    resolving: 'Normalizing paths...',
    applying: 'Executing operations...',
    error: 'Execution failed'
};

export const StatusBarMinimal = () => {
    const { sendEvent } = useIPC();
    const { stage } = useAgentStore((state) => state.pipelineProgress);
    
    const activeSessionId = useAgentStore((state) => state.activeSessionId);
    const messages = useAgentStore((state) => state.sessions[activeSessionId]?.messages) || [];

    const latestMsgWithOps = [...messages].reverse().find(msg => msg.operations && msg.operations.length > 0);
    const activeOps = latestMsgWithOps ? (latestMsgWithOps.operations || []) : [];

    const dirtyOps = activeOps.filter(op => op.status === 'applied_dirty');
    const hasConflicts = activeOps.some(op => op.status === 'conflict' || op.status === 'error');

    const isProcessing = stage !== 'idle' && stage !== 'error';
    const hasActiveContent = isProcessing || (dirtyOps.length > 0 && !hasConflicts);

    if (!hasActiveContent) {
        return null; 
    }

    const handleSaveAll = () => sendEvent({ type: 'ACTION_SAVE_ALL' });
    const handleRevertAll = () => sendEvent({ type: 'ACTION_REVERT_ALL' });

    return (
        <div className={styles.statusBar} role="status">
            <div className={styles.leftGroup}>
                {isProcessing && <span className={styles.spinner} aria-hidden="true" />}
                
                {stage !== 'idle' ? (
                    <span className={stage === 'error' ? styles.errorText : ''}>
                        {STAGE_LABELS[stage]}
                    </span>
                ) : (
                    <StatusBarMetrics operations={dirtyOps} />
                )}
            </div>

            {!isProcessing && dirtyOps.length > 0 && (
                <ActionControls onSave={handleSaveAll} onRevert={handleRevertAll} />
            )}
        </div>
    );
};
