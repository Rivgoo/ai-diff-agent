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
    readonly conflictDetails?: ConflictDetails;
    readonly isResilient: boolean;
    readonly originalPath?: string;
    readonly statusIcon: 'edit' | 'check' | 'revert' | 'error' | 'loading' | null;
    readonly isDirectory: boolean;
    readonly matchStrategy?: string;
}

/**
 * Transforms raw core domain operations into presentation-ready ViewModels.
 * Decouples complex conditional rendering logic from the React UI components.
 */
export function mapToOperationRowViewModel(op: DiffOperation): OperationRowViewModel {
    const isAborted = op.conflict?.reason === 'ABORTED';
    const isConflict = op.status === 'conflict' || op.status === 'error';
    
    // A file is a real conflict (culprit) if it failed, but wasn't purely aborted due to another failure
    const isRealConflict = isConflict && !isAborted;
    
    // Identifies victims that successfully passed validation before the overall transaction crashed
    const wasValidated = isAborted && op.conflict?.wasValidated === true;
    
    const isProcessing = op.status === 'pending';

    // File name and directory parsing
    const pathParts = op.path.split('/');
    const fileName = pathParts.pop() || op.path;
    const dirPath = pathParts.join('/');

    // Centralised descriptors lookup replacing fragile inline conditionals
    const descriptor = OPERATION_DESCRIPTORS[op.type];
    const statusMarker = descriptor ? descriptor.prefix : '[ ]';
    const markerColor = descriptor ? descriptor.themeColorVar : 'var(--vscode-descriptionForeground)';

    // Determine trailing status icon
    let statusIcon: OperationRowViewModel['statusIcon'] = null;
    
    if (isProcessing) statusIcon = 'loading';
    else if (isRealConflict) statusIcon = 'error';
    else if (isAborted) statusIcon = null; // Hide icons completely for safe victims to reduce visual noise
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
        conflictDetails: op.conflict,
        isResilient: !!op.resolvedResiliently,
        originalPath: op.originalPath,
        statusIcon,
        isDirectory: !!op.isDirectory,
        matchStrategy: op.matchStrategy
    };
}
