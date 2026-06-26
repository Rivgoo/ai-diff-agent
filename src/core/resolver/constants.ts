/**
 * Frozen configuration constants for the Resilient Path Resolution Engine.
 * Protects system execution pipelines against magic strings and arbitrary values.
 */
export const RESOLVER_CONSTANTS = {
    /**
     * Default exclusion glob patterns used to prevent resource-heavy global searches
     * from scanning third-party directories, build artifacts, and hidden configuration assets.
     */
    DEFAULT_EXCLUSIONS: '**/node_modules/**,**/dist/**,**/out/**,**/.git/**,**/.vscode/**',

    /**
     * Minimum score (consecutive matched trailing path segments) required to trigger 
     * a valid Segment Heuristic Match. This prevents false-positive resolutions 
     * based strictly on matching a single common folder.
     */
    HEURISTIC_MIN_MATCH_SCORE: 2,

    /**
     * The unique identifier names of the implemented resolution strategies.
     */
    STRATEGY_NAMES: {
        DIRECT: 'DIRECT_MATCH',
        HEURISTIC: 'SEGMENT_HEURISTIC',
        GLOBAL: 'GLOBAL_FILENAME'
    }
} as const;
