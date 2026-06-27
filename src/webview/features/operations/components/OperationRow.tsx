import { memo } from 'react';
import type { OperationRowViewModel } from '../view-models/operationMapper';
import { useIPC } from '@/webview/hooks/useIPC';
import { IconLoader2, IconEdit, IconCheck, IconArrowBackUp, IconX, IconGitCompare } from '@tabler/icons-react';
import styles from '../styles/row.module.css';

interface OperationRowProps {
    readonly vm: OperationRowViewModel;
    readonly isActive: boolean;
    readonly onMouseEnter: () => void;
    readonly onClick: () => void;
}

const RowComponent = ({ vm, isActive, onMouseEnter, onClick }: OperationRowProps) => {
    const { sendEvent } = useIPC();
    
    // Generate semantic UI classes based on ViewModel truth matrix
    const classNames = [styles.row];
    if (isActive) classNames.push(styles.rowActive);
    if (vm.isRealConflict) classNames.push(styles.rowConflict);
    else if (vm.wasValidated) classNames.push(styles.rowAbortedValidated);
    else if (vm.isAborted) classNames.push(styles.rowAborted);
    
    const rowClass = classNames.join(' ');
    
    // Pencil icon indicates the file is fully staged and waiting for user decision
    const isDirty = vm.statusIcon === 'edit';

    const renderIcon = () => {
        const size = 12;
        switch (vm.statusIcon) {
            case 'loading': return <IconLoader2 size={size} className={styles.iconSpin} />;
            case 'edit': return <IconEdit size={size} color="var(--vscode-editorWarning-foreground)" />;
            case 'check': return <IconCheck size={size} color="var(--vscode-testing-iconPassed)" />;
            case 'revert': return <IconArrowBackUp size={size} />;
            case 'error': return <IconX size={size} color="var(--vscode-editorError-foreground)" />;
            default: return null;
        }
    };

    return (
        <div 
            className={rowClass} 
            onMouseEnter={onMouseEnter}
            onClick={onClick}
            role="gridcell"
        >
            <span className={styles.statusMarker} style={{ color: vm.markerColor }}>
                {vm.statusMarker}
            </span>

            <div className={styles.pathContainer}>
                <span className={styles.fileName}>{vm.fileName}</span>
                {vm.dirPath && (
                    <span className={styles.dirPath} title={vm.dirPath}>
                        &lrm;{vm.dirPath}
                    </span>
                )}
                {vm.isResilient && (
                    <span className={styles.resilientFlag} title={`Resolved heuristically from: ${vm.originalPath}`}>
                        HEURISTIC
                    </span>
                )}
            </div>

            <div className={styles.metricsContainer}>
                {vm.metricAdd ? <span className={styles.metricAdd}>+{vm.metricAdd}</span> : null}
                {vm.metricDel ? <span className={styles.metricDel}>-{vm.metricDel}</span> : null}
                <div className={styles.statusIcon}>{renderIcon()}</div>
            </div>

            {/* ACTION MENU OVERLAY */}
            <div className={styles.actionOverlay}>
                {isDirty && (
                    <>
                        <button 
                            type="button" 
                            className={`${styles.actionBtn} ${styles.btnDiff}`} 
                            onClick={(e) => { e.stopPropagation(); sendEvent({ type: 'OPEN_DIFF', operationId: vm.id }); }} 
                            title="Compare changes (Diff)"
                        >
                            <IconGitCompare size={12} />
                        </button>
                        <button 
                            type="button" 
                            className={`${styles.actionBtn} ${styles.btnAccept}`} 
                            onClick={(e) => { e.stopPropagation(); sendEvent({ type: 'ACTION_ACCEPT_OPERATION', operationId: vm.id }); }} 
                            title="Accept this file"
                        >
                            <IconCheck size={12} />
                        </button>
                        <button 
                            type="button" 
                            className={`${styles.actionBtn} ${styles.btnReject}`} 
                            onClick={(e) => { e.stopPropagation(); sendEvent({ type: 'ACTION_REVERT_OPERATION', operationId: vm.id }); }} 
                            title="Reject this file"
                        >
                            <IconX size={12} />
                        </button>
                    </>
                )}
                <button type="button" className={styles.openBtn} onClick={(e) => { e.stopPropagation(); onClick(); }} title="Open file">
                    Open
                </button>
            </div>
        </div>
    );
};

export const OperationRow = memo(RowComponent);
