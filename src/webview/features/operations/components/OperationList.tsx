import { useRef } from 'react';
import type { DiffOperation } from '@/shared/models';
import { mapToOperationRowViewModel } from '../view-models/operationMapper';
import { OperationRow } from './OperationRow';
import { ConflictGutter } from './ConflictGutter';
import { useRovingIndex } from '@/webview/shared/hooks/useRovingIndex';
import styles from '../styles/list.module.css';

interface OperationListProps {
    readonly operations: DiffOperation[];
    readonly onOpenFile: (opId: string) => void;
}

export const OperationList = ({ operations, onOpenFile }: OperationListProps) => {
    const listRef = useRef<HTMLDivElement>(null);
    const viewModels = operations.map(mapToOperationRowViewModel);
    const { activeIndex, setActiveIndex, onKeyDown } = useRovingIndex(viewModels.length);

    if (viewModels.length === 0) return null;

    return (
        <div 
            className={styles.listContainer} 
            role="grid" 
            tabIndex={0} 
            ref={listRef}
            onKeyDown={onKeyDown}
            aria-label="Files changed in transaction"
        >
            <div className={styles.headerRow} aria-hidden="true">
                <span>STS</span>
                <span>PATH</span>
                <span style={{ textAlign: 'right' }}>DIFF</span>
            </div>
            
            <div className={styles.rowsWrapper} role="rowgroup">
                {viewModels.map((vm, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <div key={vm.id} role="row">
                            <OperationRow 
                                vm={vm} 
                                isActive={isActive} 
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => onOpenFile(vm.id)}
                            />
                            {/* Render detailed Conflict Gutter ONLY for the active culprit causing the transaction abort */}
                            {vm.isRealConflict && vm.conflictDetails && (
                                <ConflictGutter details={vm.conflictDetails} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
