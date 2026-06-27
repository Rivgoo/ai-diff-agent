export type OperationType = 'create_file' | 'update_file' | 'delete_path' | 'move_path' | 'create_dir';
export type OperationStatus = 'pending' | 'applied_dirty' | 'saved' | 'reverted' | 'conflict' | 'error';

export interface Position {
    readonly line: number;
    readonly character: number;
}

export interface Range {
    readonly start: Position;
    readonly end: Position;
}

/**
 * Diagnostic categorization of transactional conflict triggers.
 */
export type ConflictReason = 'NOT_FOUND' | 'AMBIGUOUS_MATCH' | 'PATH_TRAVERSAL' | 'FILE_NOT_FOUND' | 'UNKNOWN' | 'ABORTED';

/**
 * Encapsulates matching failure telemetry used by presentation components
 * to describe conflict resolution strategies to the user.
 */
export interface ConflictDetails {
    readonly reason: ConflictReason;
    readonly blockIndex: number;
    readonly totalBlocks: number;
    readonly searchExcerpt: string;
    readonly originalSearchBlock: string;
    readonly matchesFound?: number;
    readonly candidatePaths?: string[]; // Workspace alternatives suggested on ambiguous resolution conflicts.
    readonly wasValidated?: boolean; // Indicates if the file successfully passed pre-flight validation before the transaction was aborted
}

export interface BaseOperation {
    readonly id: string;
    readonly type: OperationType;
    readonly path: string;
    status: OperationStatus;
    errorMessage?: string;
    conflict?: ConflictDetails;
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

/**
 * Quantifies line changes calculated strictly from parsed search/replace streams.
 */
export interface CodeImpactMetrics {
    readonly additions: number; // Sum of lines generated inside replace blocks or new files
    readonly deletions: number; // Sum of lines captured inside search blocks or deleted paths
}

/**
 * Metadata summarizing structural changes inside a submitted DSL payload.
 */
export interface PayloadSummary {
    readonly rawInput: string;
    readonly totalCreatedFiles: number;
    readonly totalUpdatedFiles: number;
    readonly totalDeletedPaths: number;
    readonly totalMovedPaths: number;
    readonly totalCreatedDirs: number;
    readonly codeImpact: CodeImpactMetrics;
}
