import type { DiffOperation, ConflictDetails } from '@/shared/models';

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
    readonly conflictDetails?: ConflictDetails;
    readonly isResilient: boolean;
    readonly originalPath?: string;
    readonly statusIcon: 'edit' | 'check' | 'revert' | 'error' | 'loading' | null;
}

/**
 * Transforms raw core domain operations into presentation-ready ViewModels.
 * Decouples complex conditional rendering logic from the React UI components.
 */
export function mapToOperationRowViewModel(op: DiffOperation): OperationRowViewModel {
    const isConflict = op.status === 'conflict' || op.status === 'error';
    const isProcessing = op.status === 'pending';

    // File name and directory parsing
    const pathParts = op.path.split('/');
    const fileName = pathParts.pop() || op.path;
    const dirPath = pathParts.join('/');

    // Determine CLI-style status marker and VS Code semantic color
    let statusMarker = '[ ]';
    let markerColor = 'var(--vscode-descriptionForeground)';

    if (op.type === 'create_file') {
        statusMarker = '[A]';
        markerColor = 'var(--vscode-gitDecoration-addedResourceForeground)';
    } else if (op.type === 'update_file') {
        statusMarker = '[M]';
        markerColor = 'var(--vscode-gitDecoration-modifiedResourceForeground)';
    } else if (op.type === 'delete_path') {
        statusMarker = '[D]';
        markerColor = 'var(--vscode-gitDecoration-deletedResourceForeground)';
    } else if (op.type === 'move_path') {
        statusMarker = '[R]';
        markerColor = 'var(--vscode-gitDecoration-renamedResourceForeground)';
    } else if (op.type === 'create_dir') {
        statusMarker = '[+]';
        markerColor = 'var(--vscode-descriptionForeground)';
    }

    // Determine trailing status icon
    let statusIcon: OperationRowViewModel['statusIcon'] = null;
    if (isProcessing) statusIcon = 'loading';
    else if (isConflict) statusIcon = 'error';
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
        conflictDetails: op.conflict,
        isResilient: !!op.resolvedResiliently,
        originalPath: op.originalPath,
        statusIcon
    };
}
