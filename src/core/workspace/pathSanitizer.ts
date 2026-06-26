/**
 * Pure utility to sanitize input file path strings from various structural anomalies.
 * Strips ASCII control characters, carriage returns, trailing whitespaces,
 * and collapses consecutive slash separators.
 */
export class PathSanitizer {
    /**
     * Safely sanitizes a raw path string extracted from XML templates.
     * e.g., " /ai-diff-agent/src//modules/core/UTILS/logging/Logger.ts \r" 
     *  ─► "/ai-diff-agent/src/modules/core/UTILS/logging/Logger.ts"
     */
    public static sanitize(rawPath: string): string {
        if (!rawPath) return '';
        
        // 1. Remove non-printable ASCII and control characters (including \r, \n, \t)
        let clean = rawPath.replace(/[\x00-\x1F\x7F]/g, '');

        // 2. Normalize backslashes to forward slashes
        clean = clean.replace(/\\/g, '/');

        // 3. Collapse multiple consecutive forward slashes into a single slash
        clean = clean.replace(/\/+/g, '/');

        // 4. Strip leading and trailing whitespace
        return clean.trim();
    }
}
