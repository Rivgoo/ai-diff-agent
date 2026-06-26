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

    // Find the latest message that contains operations to isolate from historical timeline
    const latestMsgWithOps = [...messages].reverse().find(msg => msg.operations && msg.operations.length > 0);
    const activeOps = latestMsgWithOps ? (latestMsgWithOps.operations || []) : [];

    const dirtyOps = activeOps.filter(op => op.status === 'applied_dirty');
    const hasConflicts = activeOps.some(op => op.status === 'conflict' || op.status === 'error');

    const isProcessing = stage !== 'idle' && stage !== 'error';

    // Conditional Collapsing Guard: 
    // If the pipeline is completely idle, and there are no active dirty files, 
    // or if the latest batch was aborted due to conflicts/failures, collapse the component entirely.
    // This removes the 30px offset padding and border and brings the composer flush with the messages container.
    const hasActiveContent = isProcessing || (dirtyOps.length > 0 && !hasConflicts);

    if (!hasActiveContent) {
        return null; 
    }

    // Calculate granular stats dynamically across the active uncommitted batch
    let added = 0;
    let modified = 0;
    let deleted = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;

    dirtyOps.forEach(op => {
        if (op.type === 'create_file' || op.type === 'create_dir') {
            added++;
        } else if (op.type === 'update_file' || op.type === 'move_path') {
            modified++;
        } else if (op.type === 'delete_path') {
            deleted++;
        }

        if (op.stats) {
            totalAdditions += op.stats.additions;
            totalDeletions += op.stats.deletions;
        }
    });

    const isMac = navigator.userAgent.toUpperCase().includes('MAC');
    const saveShortcut = isMac ? '⇧⌘A' : 'Ctrl+Shift+A';
    const revertShortcut = isMac ? '⇧⌘R' : 'Ctrl+Shift+R';

    return (
        <div className={styles.statusBar} role="status">
            <div className={styles.leftGroup}>
                {isProcessing && <span className={styles.spinner} aria-hidden="true" />}
                
                {stage !== 'idle' ? (
                    <span className={stage === 'error' ? styles.errorText : ''}>
                        {STAGE_LABELS[stage]}
                    </span>
                ) : (
                    dirtyOps.length > 0 && (
                        <div className={styles.metricsList}>
                            {added > 0 && (
                                <span>
                                    <span className={styles.metricAdd}>+A</span> <span className={styles.metricValue}>{added}</span>
                                </span>
                            )}
                            {modified > 0 && (
                                <span>
                                    {added > 0 && <span className={styles.separator}>·</span>}
                                    <span className={styles.metricMod}>~M</span> <span className={styles.metricValue}>{modified}</span>
                                </span>
                            )}
                            {deleted > 0 && (
                                <span>
                                    {(added > 0 || modified > 0) && <span className={styles.separator}>·</span>}
                                    <span className={styles.metricDel}>-D</span> <span className={styles.metricValue}>{deleted}</span>
                                </span>
                            )}
                            
                            {(totalAdditions > 0 || totalDeletions > 0) && (
                                <span className={styles.impactDiff}>
                                    (<span className={styles.metricAdd}>+{totalAdditions}</span>
                                    {'/'}
                                    <span className={styles.metricDel}>-{totalDeletions}</span>)
                                </span>
                            )}
                        </div>
                    )
                )}
            </div>

            <div className={styles.rightGroup}>
                {dirtyOps.length > 0 && !isProcessing && (
                    <>
                        <button 
                            type="button" 
                            className={`${styles.actionBtn} ${styles.btnRevert}`} 
                            onClick={() => sendEvent({ type: 'ACTION_REVERT_ALL' })}
                            title={`Discard all uncommitted files (${revertShortcut})`}
                        >
                            <IconArrowBackUp size={12} />
                            <span>Revert</span>
                        </button>
                        
                        <button 
                            type="button" 
                            className={`${styles.actionBtn} ${styles.btnSave}`} 
                            onClick={() => sendEvent({ type: 'ACTION_SAVE_ALL' })}
                            title={`Commit all transaction writes to disk (${saveShortcut})`}
                        >
                            <IconDeviceFloppy size={12} />
                            <span>Save All</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
