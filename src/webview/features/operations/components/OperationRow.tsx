import { memo } from 'react';
import type { OperationRowViewModel } from '../view-models/operationMapper';
import { IconLoader2, IconEdit, IconCheck, IconArrowBackUp, IconX } from '@tabler/icons-react';
import styles from '../styles/row.module.css';

interface OperationRowProps {
    readonly vm: OperationRowViewModel;
    readonly isActive: boolean;
    readonly onMouseEnter: () => void;
    readonly onClick: () => void;
}

const RowComponent = ({ vm, isActive, onMouseEnter, onClick }: OperationRowProps) => {
    const rowClass = `${styles.row} ${isActive ? styles.rowActive : ''} ${vm.isConflict ? styles.rowConflict : ''}`;

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

            <div className={styles.actionOverlay}>
                <button type="button" className={styles.openBtn} onClick={(e) => { e.stopPropagation(); onClick(); }}>
                    Open
                </button>
            </div>
        </div>
    );
};

export const OperationRow = memo(RowComponent);
