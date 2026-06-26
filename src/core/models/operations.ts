import type { BaseOperation, Range } from '@/shared/contracts';

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

// --- Type Guards ---

export function isCreateFileOperation(op: AnyOperation): op is CreateFileOperation {
    return op.type === 'create_file';
}

export function isUpdateFileOperation(op: AnyOperation): op is UpdateFileOperation {
    return op.type === 'update_file';
}

export function isDeletePathOperation(op: AnyOperation): op is DeletePathOperation {
    return op.type === 'delete_path';
}

export function isMovePathOperation(op: AnyOperation): op is MovePathOperation {
    return op.type === 'move_path';
}

export function isCreateDirOperation(op: AnyOperation): op is CreateDirOperation {
    return op.type === 'create_dir';
}