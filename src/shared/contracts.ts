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

export type ConflictReason = 'NOT_FOUND' | 'AMBIGUOUS_MATCH' | 'PATH_TRAVERSAL' | 'FILE_NOT_FOUND' | 'UNKNOWN' | 'ABORTED' | 'SYNTAX_CORRUPTION_PREVENTED';

export interface ConflictDetails {
    readonly reason: ConflictReason;
    readonly blockIndex: number;
    readonly totalBlocks: number;
    readonly searchExcerpt: string;
    readonly originalSearchBlock: string;
    readonly matchesFound?: number;
    readonly candidatePaths?: string[];
    readonly wasValidated?: boolean;
    readonly semanticDiagnostic?: string;
}

export interface BaseOperation {
    readonly id: string;
    readonly type: OperationType;
    readonly path: string;
    status: OperationStatus;
    errorMessage?: string;
    conflict?: ConflictDetails;
    isDirectory?: boolean;
}

export type MatchFailureReason = 'NOT_FOUND' | 'AMBIGUOUS_MATCH' | 'EMPTY_SEARCH_BLOCK' | 'SYNTAX_CORRUPTION_PREVENTED';

export type ConfidenceScore = 'High' | 'Medium' | 'Low' | 'Warning';
export interface MatchSuccess {
    readonly status: 'MATCHED';
    readonly range: Range;
    readonly confidence: 'exact' | 'fallback';
    readonly confidenceScore: ConfidenceScore; 
    readonly strategy?: string;
    readonly hoistedImports?: string[];
    readonly cleanReplaceBlock?: string;
}

export interface MatchFailure {
    readonly status: 'FAILED';
    readonly reason: MatchFailureReason;
    readonly matchesFound: number;
    readonly semanticDiagnostic?: string;
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

export interface CodeImpactMetrics {
    readonly additions: number;
    readonly deletions: number;
}

export interface PayloadSummary {
    readonly rawInput: string;
    readonly totalCreatedFiles: number;
    readonly totalUpdatedFiles: number;
    readonly totalDeletedPaths: number;
    readonly totalMovedPaths: number;
    readonly totalCreatedDirs: number;
    readonly codeImpact: CodeImpactMetrics;
}
