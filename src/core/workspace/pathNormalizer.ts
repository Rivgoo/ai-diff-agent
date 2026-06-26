import { PathSanitizer } from './pathSanitizer';

/**
 * Domain-driven Path Normalizer.
 * Safely sanitizes AI-generated paths, resolving absolute/hallucinated segments into strict relative paths.
 */
export class PathNormalizer {
    /**
     * Converts absolute, protocol-wrapped, or redundant root-prefixed paths into clean,
     * safe, relative workspace paths.
     * e.g., "/ai-diff-agent/src//modules/core/UTILS/logging/Logger.ts \r" ──► "src/modules/core/UTILS/logging/Logger.ts"
     */
    public static normalize(rawPath: string, rootName: string): string {
        // Run robust physical string sanitization first
        let clean = PathSanitizer.sanitize(rawPath);
        
        // Handle common file protocol wrappers case-insensitively
        if (clean.toLowerCase().startsWith('file://')) {
            clean = clean.substring(7);
        }

        // Split on slash and filter out empty segments to resolve redundant slashes
        const parts = clean.split('/').filter(Boolean);
        
        // Find the root folder name case-insensitively. Everything after it belongs to the workspace.
        const rootIdx = parts.findIndex(p => p.toLowerCase() === rootName.toLowerCase());
        if (rootIdx !== -1 && rootIdx < parts.length - 1) {
            return parts.slice(rootIdx + 1).join('/');
        }

        // Fallback: If root name is missing, assume the path is already properly relative
        return parts.join('/');
    }
}
