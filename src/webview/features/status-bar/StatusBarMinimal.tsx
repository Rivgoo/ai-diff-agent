import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import { IconDeviceFloppy, IconArrowBackUp } from '@tabler/icons-react';
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
    const messages = useAgentStore((state) => state.messages);

    const allOps = messages.flatMap(msg => msg.operations || []);
    const dirtyOps = allOps.filter(op => op.status === 'applied_dirty');
    const hasConflicts = allOps.some(op => op.status === 'conflict' || op.status === 'error');

    const isProcessing = stage !== 'idle' && stage !== 'error';

    return (
        <div className={styles.statusBar}>
            <div className={styles.leftGroup}>
                {isProcessing && <span className={styles.spinner} aria-hidden="true" />}
                {stage !== 'idle' ? (
                    <span className={stage === 'error' ? styles.errorText : ''}>{STAGE_LABELS[stage]}</span>
                ) : (
                    dirtyOps.length > 0 && !hasConflicts && <span>Pending: {dirtyOps.length} modifications</span>
                )}
            </div>

            <div className={styles.rightGroup}>
                {dirtyOps.length > 0 && !hasConflicts && !isProcessing && (
                    <>
                        <button type="button" className={styles.actionBtn} onClick={() => sendEvent({ type: 'ACTION_REVERT_ALL' })}>
                            <IconArrowBackUp size={12} /> Revert
                        </button>
                        <button type="button" className={`${styles.actionBtn} ${styles.saveBtn}`} onClick={() => sendEvent({ type: 'ACTION_SAVE_ALL' })}>
                            <IconDeviceFloppy size={12} /> Save All
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
