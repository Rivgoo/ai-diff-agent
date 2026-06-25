/**
 * Domain-driven Path Normalizer.
 * Safely sanitizes AI-generated paths, resolving absolute hallucinations into strict relative paths.
 */
export class PathNormalizer {
    public static normalize(rawPath: string, rootName: string): string {
        let clean = rawPath.replace(/\\/g, '/');
        
        // Handle common file protocol wrappers
        if (clean.startsWith('file://')) {
            clean = clean.substring(7);
        }

        // Clean redundant leading slashes
        clean = clean.replace(/^\/+/, '');

        const parts = clean.split('/');
        
        // Find the root folder name. Everything after it belongs to the workspace.
        const rootIdx = parts.indexOf(rootName);
        if (rootIdx !== -1 && rootIdx < parts.length - 1) {
            return parts.slice(rootIdx + 1).join('/');
        }

        // Fallback: If root name is missing, assume the path is already properly relative
        return clean;
    }
}
