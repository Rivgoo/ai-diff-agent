/**
 * Shared contracts defining basic structural types used by legacy core files.
 * Restored to guarantee backward compatibility and compilation with core components.
 */

export type OperationType = 'create_file' | 'update_file' | 'delete_path' | 'move_path' | 'create_dir';
export type OperationStatus = 'pending' | 'matched' | 'conflict' | 'applied' | 'rejected' | 'error' | 'manual_modified';

export interface Position {
    readonly line: number;
    readonly character: number;
}

export interface Range {
    readonly start: Position;
    readonly end: Position;
}

export interface BaseOperation {
    readonly id: string;
    readonly type: OperationType;
    readonly path: string;
    status: OperationStatus;
    errorMessage?: string;
}

export type MatchFailureReason = 'NOT_FOUND' | 'AMBIGUOUS_MATCH' | 'EMPTY_SEARCH_BLOCK';

export interface MatchSuccess {
    readonly status: 'MATCHED';
    readonly range: Range;
    readonly confidence: 'exact' | 'fallback';
}

export interface MatchFailure {
    readonly status: 'FAILED';
    readonly reason: MatchFailureReason;
    readonly matchesFound: number;
}

export type MatchResult = MatchSuccess | MatchFailure;

export type Result<T, E = Error> = 
    | { readonly success: true; readonly value: T }
    | { readonly success: false; readonly error: E };

export const Result = {
    ok<T>(value: T): Result<T, never> {
        return { success: true, value };
    },
    fail<E>(error: E): Result<never, E> {
        return { success: false, error };
    }
};
