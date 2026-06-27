import type { PayloadSummary } from '@/shared/contracts';
import { MetricPill } from '@/webview/shared/ui/MetricPill/MetricPill';
import { IconFilePlus, IconEdit, IconTrash, IconFileExport, IconFolderPlus } from '@tabler/icons-react';
import styles from '../styles/message.module.css';

export const MessageMetricsGrid = ({ summary }: { summary: PayloadSummary }) => {
    const { 
        totalCreatedFiles, 
        totalUpdatedFiles, 
        totalDeletedPaths, 
        totalMovedPaths, 
        totalCreatedDirs,
        codeImpact
    } = summary;

    const totalOps = totalCreatedFiles + totalUpdatedFiles + totalDeletedPaths + totalMovedPaths + totalCreatedDirs;
    
    if (totalOps === 0) return null;

    return (
        <div className={styles.metricsGrid} aria-label="Transaction metrics summary">
            {totalCreatedFiles > 0 && <MetricPill icon={IconFilePlus} count={totalCreatedFiles} label="created" intent="add" />}
            {totalUpdatedFiles > 0 && <MetricPill icon={IconEdit} count={totalUpdatedFiles} label="updated" intent="modify" />}
            {totalDeletedPaths > 0 && <MetricPill icon={IconTrash} count={totalDeletedPaths} label="deleted" intent="delete" />}
            {totalMovedPaths > 0 && <MetricPill icon={IconFileExport} count={totalMovedPaths} label="moved" intent="neutral" />}
            {totalCreatedDirs > 0 && <MetricPill icon={IconFolderPlus} count={totalCreatedDirs} label="dirs" intent="add" />}

            {(codeImpact.additions > 0 || codeImpact.deletions > 0) && (
                <>
                    <div className={styles.impactDivider} aria-hidden="true" />
                    <div className={styles.impactText} title="Lines added / removed">
                        {codeImpact.additions > 0 && <span className={styles.addText}>+{codeImpact.additions}</span>}
                        {codeImpact.deletions > 0 && <span className={styles.delText}>-{codeImpact.deletions}</span>}
                    </div>
                </>
            )}
        </div>
    );
};
