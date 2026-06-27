import type { DiffOperation } from '@/shared/models';
import { MetricPill } from '@/webview/shared/ui/MetricPill/MetricPill';
import { IconFilePlus, IconEdit, IconTrash, IconFolderPlus, IconFolderMinus } from '@tabler/icons-react';
import styles from '../StatusBarMinimal.module.css';

interface StatusBarMetricsProps {
    readonly operations: DiffOperation[];
}

export const StatusBarMetrics = ({ operations }: StatusBarMetricsProps) => {
    let addedFiles = 0;
    let addedDirs = 0;
    let modifiedFiles = 0;
    let deletedFiles = 0;
    let deletedDirs = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;

    operations.forEach(op => {
        if (op.type === 'create_file') {
            addedFiles++;
        } else if (op.type === 'create_dir') {
            addedDirs++;
        } else if (op.type === 'update_file' || op.type === 'move_path') {
            modifiedFiles++;
        } else if (op.type === 'delete_path') {
            if (op.isDirectory) {
                deletedDirs++;
            } else {
                deletedFiles++;
            }
        }

        if (op.stats) {
            totalAdditions += op.stats.additions;
            totalDeletions += op.stats.deletions;
        }
    });

    return (
        <div className={styles.metricsContainer} aria-label="Unsaved operations statistics">
            {addedFiles > 0 && (
                <MetricPill icon={IconFilePlus} count={addedFiles} label="added files" intent="add" variant="micro" />
            )}
            {addedDirs > 0 && (
                <MetricPill icon={IconFolderPlus} count={addedDirs} label="added directories" intent="add" variant="micro" />
            )}
            {modifiedFiles > 0 && (
                <MetricPill icon={IconEdit} count={modifiedFiles} label="modified files" intent="modify" variant="micro" />
            )}
            {deletedFiles > 0 && (
                <MetricPill icon={IconTrash} count={deletedFiles} label="deleted files" intent="delete" variant="micro" />
            )}
            {deletedDirs > 0 && (
                <MetricPill icon={IconFolderMinus} count={deletedDirs} label="deleted directories" intent="delete" variant="micro" />
            )}
            
            {(totalAdditions > 0 || totalDeletions > 0) && (
                <span className={styles.lineImpact} title="Lines added / removed">
                    (<span className={styles.addCount}>+{totalAdditions}</span>/
                    <span className={styles.delCount}>-{totalDeletions}</span>)
                </span>
            )}
        </div>
    );
};
