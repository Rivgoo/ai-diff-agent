import { BaseOperation, Range } from '../../shared/contracts';

/**
 * Domain models representing deterministic actions requested by the AI.
 */

export interface CreateFileOperation extends BaseOperation {
    readonly type: 'create_file';
    readonly content: string;
}

export interface DeletePathOperation extends BaseOperation {
    readonly type: 'delete_path';
}

export interface MovePathOperation extends BaseOperation {
    readonly type: 'move_path';
    readonly destinationPath: string;
}

export interface CreateDirOperation extends BaseOperation {
    readonly type: 'create_dir';
}

export interface ChangeBlock {
    readonly search: string;
    readonly replace: string;
    /** Range computed by the matching engine relative to current document state */
    matchRange?: Range;
}

export interface UpdateFileOperation extends BaseOperation {
    readonly type: 'update_file';
    readonly changes: ChangeBlock[];
}

export type AnyOperation = 
    | CreateFileOperation 
    | UpdateFileOperation 
    | DeletePathOperation 
    | MovePathOperation 
    | CreateDirOperation;
