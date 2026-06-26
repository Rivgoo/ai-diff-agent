import type { ReactNode } from 'react';
import type { DiffOperation } from '../../../shared/models';
import { useIPC } from '../../hooks/useIPC';
import { Badge } from '../../shared/ui/Badge/Badge';
import { ConflictDetailsPanel } from './ConflictDetailsPanel';
import { 
    IconCheck, IconPlus, IconMinus, IconAlertCircle, IconFile, 
    IconFolder, IconFolderPlus, IconEdit, IconExternalLink, 
    IconArrowBackUp, IconArrowRight, IconAlertTriangle, IconX 
} from '@tabler/icons-react';
import styles from './DiffReviewCard.module.css';

interface BadgeConfig { 
    readonly label: string; 
    readonly bg: string; 
    readonly color: string; 
    readonly icon: ReactNode; 
}

const BADGE_CONFIG: Record<string, BadgeConfig> = {
    create_file: { label: 'NEW', bg: 'var(--vscode-testing-iconPassed)', color: '#ffffff', icon: <IconPlus size={8} strokeWidth={3} /> },
    update_file: { label: 'UPDATE', bg: 'var(--vscode-textLink-foreground)', color: '#ffffff', icon: <IconEdit size={8} strokeWidth={3} /> },
    delete_path: { label: 'DELETE', bg: 'var(--vscode-testing-iconFailed)', color: '#ffffff', icon: <IconMinus size={8} strokeWidth={3} /> },
    move_path: { label: 'MOVE', bg: 'var(--vscode-editorWarning-foreground)', color: '#ffffff', icon: <IconExternalLink size={8} strokeWidth={3} /> },
    create_dir: { label: 'DIR', bg: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)', icon: <IconFolderPlus size={8} strokeWidth={3} /> }
};

export const DiffReviewCard = ({ operation }: { readonly operation: DiffOperation }) => {
    const { sendEvent } = useIPC();

    const isDirectory = operation.type === 'create_dir' || operation.path.endsWith('/');
    const TypeIcon = isDirectory ? IconFolder : IconFile;

    const badge = BADGE_CONFIG[operation.type];
    const isResilient = operation.resolvedResiliently === true;

    // A card is only visually highlighted as an active error/conflict if it contains real mismatch details
    const isConflict = operation.status === 'conflict' && operation.conflict !== undefined;

    const pathParts = operation.path.split('/');
    const fileName = pathParts.pop() ?? operation.path;
    const parentPath = pathParts.join('/');

    const renderStatusIcon = () => {
        const size = 14;
        if (operation.status === 'applied_dirty') {
            return <IconEdit size={size} color="var(--vscode-editorWarning-foreground)" title="Unsaved changes" />;
        }
        if (operation.status === 'saved') {
            return <IconCheck size={size} color="var(--vscode-testing-iconPassed)" title="Saved to Disk" />;
        }
        if (operation.status === 'reverted') {
            return <IconArrowBackUp size={size} color="var(--vscode-descriptionForeground)" title="Reverted" />;
        }
        if (isConflict) {
            return <IconAlertCircle size={size} color="var(--vscode-testing-iconFailed)" title="Conflict" />;
        }
        // Neutral indicator for valid operations cancelled because of another faulty file in the batch
        if (operation.status === 'conflict') {
            return <IconX size={size} color="var(--vscode-descriptionForeground)" title="Aborted due to other errors in this batch" />;
        }
        return null;
    };

    return (
        <div className={styles.cardContainer}>
            <button 
                type="button"
                onClick={() => sendEvent({ type: 'OPEN_FILE', operationId: operation.id })}
                className={`${styles.card} ${isConflict ? styles.cardConflict : ''} ${isResilient ? styles.cardResilient : ''}`}
                style={{ borderLeft: `3px solid ${isResilient ? 'var(--vscode-editorWarning-foreground)' : (badge ? badge.bg : 'var(--vscode-badge-background)')}` }}
                aria-label={`Review ${operation.type} on ${fileName}`}
            >
                <div className={styles.headerRow}>
                    <div className={styles.metaGroup}>
                        <div className={styles.iconBox}><TypeIcon size={15} aria-hidden="true" /></div>
                        <div className={styles.textStack}>
                            <div className={styles.titleRow}>
                                <span className={styles.fileName} title={operation.path}>{fileName}</span>
                                {badge && (
                                    <Badge backgroundColor={badge.bg} color={badge.color}>
                                        {badge.icon}{badge.label}
                                    </Badge>
                                )}
                                {isResilient && (
                                    <Badge backgroundColor="var(--vscode-editorWarning-foreground)" color="#000000">
                                        <IconAlertTriangle size={8} strokeWidth={3} />HEURISTIC
                                    </Badge>
                                )}
                            </div>

                            {operation.type === 'move_path' && operation.sourcePath && operation.destinationPath ? (
                                <div className={styles.movePathBlock}>
                                    <span className={styles.moveSrc}>{operation.sourcePath}</span>
                                    <span className={styles.moveDest}><IconArrowRight size={10} aria-hidden="true" /> {operation.destinationPath}</span>
                                </div>
                            ) : (
                                parentPath && <span className={styles.pathInfo} title={parentPath}>{parentPath}</span>
                            )}
                        </div>
                    </div>

                    <div className={styles.statsGroup}>
                        {operation.stats && (
                            <div className={styles.statPills}>
                                {operation.stats.additions > 0 && <span className={styles.addStat}><IconPlus size={10} strokeWidth={3} />{operation.stats.additions}</span>}
                                {operation.stats.deletions > 0 && <span className={styles.delStat}><IconMinus size={10} strokeWidth={3} />{operation.stats.deletions}</span>}
                            </div>
                        )}
                        {renderStatusIcon()}
                    </div>
                </div>

                {isResilient && operation.originalPath && (
                    <div className={styles.resilientNotice} title={`Originally requested path: ${operation.originalPath}`}>
                        <IconAlertTriangle size={12} className={styles.warnTriangle} aria-hidden="true" />
                        <span className={styles.noticeText}>
                            File resolved resiliently. Requested: <code className={styles.rawCode}>{operation.originalPath}</code>
                        </span>
                    </div>
                )}
            </button>

            {isConflict && operation.conflict && (
                <ConflictDetailsPanel conflict={operation.conflict} />
            )}
        </div>
    );
};
