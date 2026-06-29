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
    
    const classNames = [styles.row];
    if (isActive) classNames.push(styles.rowActive);
    if (vm.isRealConflict) classNames.push(styles.rowConflict);
    else if (vm.wasValidated) classNames.push(styles.rowAbortedValidated);
    else if (vm.isAborted) classNames.push(styles.rowAborted);
    
    const rowClass = classNames.join(' ');


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

    const isDirty = vm.statusIcon === 'edit';
    const isSaved = vm.statusIcon === 'check';
    const canDiff = isDirty || isSaved; 

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
                {vm.matchStrategy && (
                    <span 
                        className={styles.resilientFlag} 
                        style={{ 
                            borderColor: vm.matchStrategy.includes('AST') 
                                ? 'var(--vscode-symbolIcon-methodForeground, #b180d7)' 
                                : 'var(--vscode-symbolIcon-classForeground, #4ec9b0)',
                            color: vm.matchStrategy.includes('AST') 
                                ? 'var(--vscode-symbolIcon-methodForeground, #b180d7)' 
                                : 'var(--vscode-symbolIcon-classForeground, #4ec9b0)',
                            fontWeight: vm.matchStrategy.includes('AST') ? 600 : 400
                        }} 
                        title={`Matched using: ${vm.matchStrategy}`}
                    >
                        {vm.matchStrategy.replace('_MATCH', '')}
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
                {canDiff && (
                    <button 
                        type="button" 
                        className={`${styles.actionBtn} ${styles.btnDiff}`} 
                        onClick={(e) => { e.stopPropagation(); sendEvent({ type: 'OPEN_DIFF', operationId: vm.id }); }} 
                        title="Compare changes (Diff)"
                    >
                        <IconGitCompare size={12} />
                    </button>
                )}
                {isDirty && (
                    <>
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
