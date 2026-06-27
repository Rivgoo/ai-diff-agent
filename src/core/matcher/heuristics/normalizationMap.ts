/**
 * Establishes a bidirectional mapping between a heavily stripped string
 * and the physical file offsets. 
 * Critical for preventing Offset Drift during fallback replacement phases.
 */
export interface NormalizationMap {
    readonly normalizedText: string;
    /**
     * Array where the index corresponds to the character index in `normalizedText`,
     * and the value holds the absolute character index in the original document string.
     */
    readonly originalIndices: Uint32Array;
}
