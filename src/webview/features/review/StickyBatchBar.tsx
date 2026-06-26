import type { ReactNode } from 'react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import { Button } from '@/webview/shared/ui/Button/Button';
import { IconDeviceFloppy, IconArrowBackUp, IconFiles, IconPlus, IconMinus, IconEdit, IconExternalLink, IconFolderPlus, IconX } from '@tabler/icons-react';
import styles from './StickyBatchBar.module.css';

export const StickyBatchBar = () => {
    const { sendEvent } = useIPC();
    const messages = useAgentStore((state) => state.messages);
    
    // Flat-map all diff operations in the active chat session context
    const allOps = messages.flatMap(msg => msg.operations || []);

    // Safety check: Abort rendering entirely if any operation resolved to a conflict state
    const hasConflicts = allOps.some(op => op.status === 'conflict' || op.status === 'error');
    if (hasConflicts) {
        return null;
    }

    // Capture pending and staging modifications for the summary metrics
    const dirtyOps = allOps.filter(op => op.status === 'applied_dirty');
    if (dirtyOps.length === 0) {
        return null;
    }

    let addedFiles = 0, addedFolders = 0, deletedFiles = 0, deletedFolders = 0, updatedFiles = 0, movedPaths = 0;
    let totalAdditions = 0, totalDeletions = 0;

    dirtyOps.forEach(op => {
        if (op.type === 'create_file') addedFiles++;
        else if (op.type === 'create_dir') addedFolders++;
        else if (op.type === 'delete_path') { if (op.path.endsWith('/')) deletedFolders++; else deletedFiles++; }
        else if (op.type === 'update_file') updatedFiles++;
        else if (op.type === 'move_path') movedPaths++;

        if (op.stats) {
            totalAdditions += op.stats.additions;
            totalDeletions += op.stats.deletions;
        }
    });

    const statItems: ReactNode[] = [];
    const iconSize = 11;

    if (addedFiles > 0) statItems.push(<span key="add-f" className={styles.statItem} style={{ color: 'var(--vscode-testing-iconPassed)' }}><IconPlus size={iconSize} />{addedFiles} file{addedFiles > 1 ? 's' : ''}</span>);
    if (addedFolders > 0) statItems.push(<span key="add-d" className={styles.statItem} style={{ color: 'var(--vscode-badge-background)' }}><IconFolderPlus size={iconSize} />{addedFolders} dir{addedFolders > 1 ? 's' : ''}</span>);
    if (updatedFiles > 0) statItems.push(<span key="up-f" className={styles.statItem} style={{ color: 'var(--vscode-textLink-foreground)' }}><IconEdit size={iconSize} />{updatedFiles} update{updatedFiles > 1 ? 's' : ''}</span>);
    if (deletedFiles > 0) statItems.push(<span key="del-f" className={styles.statItem} style={{ color: 'var(--vscode-testing-iconFailed)' }}><IconMinus size={iconSize} />{deletedFiles} deleted file{deletedFiles > 1 ? 's' : ''}</span>);
    if (deletedFolders > 0) statItems.push(<span key="del-d" className={styles.statItem} style={{ color: 'var(--vscode-testing-iconFailed)' }}><IconX size={iconSize} />{deletedFolders} deleted dir{deletedFolders > 1 ? 's' : ''}</span>);
    if (movedPaths > 0) statItems.push(<span key="mov-p" className={styles.statItem} style={{ color: 'var(--vscode-editorWarning-foreground)' }}><IconExternalLink size={iconSize} />{movedPaths} moved</span>);

    return (
        <div className={styles.bar}>
            <div className={styles.summaryRow}>
                <div className={styles.label}><IconFiles size={13} aria-hidden="true" /><span>Pending Review:</span></div>
                <div className={styles.statsList}>
                    {statItems.reduce((prev, curr) => prev === null ? [curr] : [...prev, <span key={`sep-${curr.key}`} className={styles.separator}>·</span>, curr], null as ReactNode[] | null)}
                </div>
                {(totalAdditions > 0 || totalDeletions > 0) && (
                    <span className={styles.lines}>
                        ({totalAdditions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>+{totalAdditions}</span>}
                        {totalAdditions > 0 && totalDeletions > 0 && ' '}
                        {totalDeletions > 0 && <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>-{totalDeletions}</span>})
                    </span>
                )}
            </div>

            <div className={styles.actions}>
                <Button variant="secondary" onClick={() => sendEvent({ type: 'ACTION_REVERT_ALL' })} aria-label="Undo all modifications">
                    <IconArrowBackUp size={13} aria-hidden="true" /> Revert All
                </Button>
                <Button variant="primary" onClick={() => sendEvent({ type: 'ACTION_SAVE_ALL' })} aria-label="Save all open dirty files">
                    <IconDeviceFloppy size={13} aria-hidden="true" /> Save All
                </Button>
            </div>
        </div>
    );
};
