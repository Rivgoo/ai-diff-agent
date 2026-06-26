import type { IPathResolutionStrategy } from './base';
import type { ResolutionResult } from '../models';
import type { IFileSystemPort, IWorkspaceSearchPort } from '../ports';
import { RESOLVER_CONSTANTS } from '../constants';

/**
 * Generates a case-insensitive glob pattern by wrapping each alphabetic character in a bracket class.
 * e.g., "Logger.ts" -> "**\/[Ll][Oo][Gg][Gg][Ee][Rr].[Tt][Ss]"
 */
function makeCaseInsensitiveGlob(filename: string): string {
    return '**/' + filename.split('').map(char => {
        if (/[a-zA-Z]/.test(char)) {
            return `[${char.toLowerCase()}${char.toUpperCase()}]`;
        }
        return char;
    }).join('');
}

/**
 * Strategy level 3: Global Unique Filename Search.
 * Cascades to search strictly by the trailing filename globally across the workspace.
 * Resolves to the file only if exactly one match exists project-wide, preventing arbitrary overrides.
 */
export class GlobalFilenameStrategy implements IPathResolutionStrategy {
    public readonly name = RESOLVER_CONSTANTS.STRATEGY_NAMES.GLOBAL;

    public async resolve(
        rawPath: string,
        _fs: IFileSystemPort,
        search: IWorkspaceSearchPort
    ): Promise<ResolutionResult | null> {
        const segments = rawPath.replace(/\\/g, '/').split('/').filter(Boolean);
        if (segments.length === 0) {
            return null;
        }

        const filename = segments[segments.length - 1];
        const caseInsensitivePattern = makeCaseInsensitiveGlob(filename);
        
        const candidates = await search.findFiles(
            caseInsensitivePattern,
            RESOLVER_CONSTANTS.DEFAULT_EXCLUSIONS
        );

        if (candidates.length === 0) {
            return null;
        }

        // High confidence match: EXACTLY one file with this filename exists across the workspace
        if (candidates.length === 1) {
            return {
                status: 'RESOLVED_RESILIENTLY',
                resolvedPath: candidates[0],
                originalPath: rawPath,
                strategyUsed: this.name
            };
        }

        // Conflict state: multiple candidates found with the same filename. Abort resolution to prevent writing to the wrong target.
        return {
            status: 'AMBIGUOUS_MATCH',
            resolvedPath: rawPath,
            originalPath: rawPath,
            strategyUsed: this.name,
            candidatePaths: candidates
        };
    }
}
