import type { DiffOperation, ConflictDetails } from '@/shared/models';
import { OPERATION_DESCRIPTORS } from '../constants/descriptors';

export interface OperationRowViewModel {
    readonly id: string;
    readonly type: string;
    readonly statusMarker: string;
    readonly markerColor: string;
    readonly fileName: string;
    readonly dirPath: string;
    readonly metricAdd: number | null;
    readonly metricDel: number | null;
    readonly isConflict: boolean;
    readonly isRealConflict: boolean;
    readonly isAborted: boolean;
    readonly wasValidated: boolean;
    readonly alreadyApplied: boolean;
    readonly conflictDetails?: ConflictDetails;
    readonly isResilient: boolean;
    readonly originalPath?: string;
    readonly statusIcon: 'edit' | 'check' | 'revert' | 'error' | 'loading' | 'warning' | null;
    readonly isDirectory: boolean;
    readonly matchStrategy?: string;
    readonly confidenceScore?: string;
}

export function mapToOperationRowViewModel(op: DiffOperation): OperationRowViewModel {
    const isAborted = op.conflict?.reason === 'ABORTED';
    const isConflict = op.status === 'conflict' || op.status === 'error';
    const isRealConflict = isConflict && !isAborted;
    const wasValidated = isAborted && op.conflict?.wasValidated === true;
    const isProcessing = op.status === 'pending';
    const alreadyApplied = !!op.alreadyApplied;

    const pathParts = op.path.split('/');
    const fileName = pathParts.pop() || op.path;
    const dirPath = pathParts.join('/');

    const descriptor = OPERATION_DESCRIPTORS[op.type];
    const statusMarker = descriptor ? descriptor.prefix : '[ ]';
    
    // Якщо файл вже містить ці зміни, фарбуємо маркер у жовтий
    let markerColor = descriptor ? descriptor.themeColorVar : 'var(--vscode-descriptionForeground)';
    if (alreadyApplied) markerColor = 'var(--vscode-editorWarning-foreground)';

    let statusIcon: OperationRowViewModel['statusIcon'] = null;
    
    if (isProcessing) statusIcon = 'loading';
    else if (isRealConflict) statusIcon = 'error';
    else if (alreadyApplied) statusIcon = 'warning'; // Жовтий значок
    else if (isAborted) statusIcon = null;
    else if (op.status === 'applied_dirty') statusIcon = 'edit';
    else if (op.status === 'saved') statusIcon = 'check';
    else if (op.status === 'reverted') statusIcon = 'revert';

    return {
        id: op.id,
        type: op.type,
        statusMarker,
        markerColor,
        fileName,
        dirPath,
        metricAdd: op.stats?.additions || null,
        metricDel: op.stats?.deletions || null,
        isConflict,
        isRealConflict,
        isAborted,
        wasValidated,
        alreadyApplied,
        conflictDetails: op.conflict,
        isResilient: !!op.resolvedResiliently,
        originalPath: op.originalPath,
        statusIcon,
        isDirectory: !!op.isDirectory,
        matchStrategy: op.matchStrategy,
        confidenceScore: op.confidenceScore 
    };
}