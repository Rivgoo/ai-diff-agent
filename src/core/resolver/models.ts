/**
 * Operational statuses returned by the cascading search strategies.
 */
export type ResolutionStatus = 
    | 'EXACT_MATCH'           // File successfully resolved at its exact specified path.
    | 'RESOLVED_RESILIENTLY'  // File resolved in a different folder using segment heuristics or global fallback.
    | 'AMBIGUOUS_MATCH'       // Multiple file candidates found globally; resolving would cause write ambiguity.
    | 'NOT_FOUND';            // File could not be resolved across any fallback strategy.

/**
 * Structural payload representing a standardized resolution search result.
 */
export interface ResolutionResult {
    readonly status: ResolutionStatus;
    readonly resolvedPath: string;        // The actual resolved relative workspace path of the file.
    readonly originalPath: string;        // The original raw path provided in the AI payload.
    readonly strategyUsed: string;        // The specific strategy class name that completed the search.
    readonly candidatePaths?: string[];   // A list of alternative file candidates populated during ambiguous matches.
}

/**
 * Domain-specific exception thrown when fatal resolution failures or configuration corruption occur.
 */
export class PathResolutionException extends Error {
    constructor(
        message: string,
        public readonly errorCode: string,
        public readonly diagnosticDetails?: Record<string, any>
    ) {
        super(message);
        this.name = 'PathResolutionException';
        Object.setPrototypeOf(this, PathResolutionException.prototype);
    }

    /**
     * Creates an exception representing an invalid blank search target.
     */
    public static emptyInputPath(): PathResolutionException {
        return new PathResolutionException(
            'Target resolution file path cannot be empty or white-spaced.',
            'ERR_EMPTY_TARGET_PATH'
        );
    }

    /**
     * Creates an exception representing unexpected engine execution errors.
     */
    public static executionFailed(strategyName: string, originalError: Error): PathResolutionException {
        return new PathResolutionException(
            `Search strategy '${strategyName}' failed during execution: ${originalError.message}`,
            'ERR_STRATEGY_EXECUTION_FAILED',
            { strategyName, originalMessage: originalError.message }
        );
    }
}
