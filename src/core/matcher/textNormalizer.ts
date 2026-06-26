/**
 * String clean utilities to secure exact comparison between environments.
 * Mitigates matching offset skew caused by line break formatting or BOM codes.
 */
export class TextNormalizer {
    /**
     * Strips UTF-8 Byte Order Mark (BOM) patterns that interfere with exact text index matching.
     */
    public static stripBOM(text: string): string {
        if (text.charCodeAt(0) === 0xFEFF) {
            return text.substring(1);
        }
        return text;
    }

    /**
     * Normalizes line breaks to unix standard to guarantee equivalence.
     * Operates linearly and avoids costly regex backtracking.
     */
    public static normalizeLineEndings(text: string): string {
        return text.replace(/\r\n/g, '\n');
    }
}
