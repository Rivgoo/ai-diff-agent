import type { IPathResolutionStrategy } from './base';
import type { ResolutionResult } from '../models';
import type { IFileSystemPort, IWorkspaceSearchPort } from '../ports';
import { RESOLVER_CONSTANTS } from '../constants';

/**
 * Strategy level 1: Verifies exact file presence.
 * Performs a fast, direct file system exists-check. Prevents expensive cascading searches when paths are accurate.
 */
export class DirectMatchStrategy implements IPathResolutionStrategy {
    public readonly name = RESOLVER_CONSTANTS.STRATEGY_NAMES.DIRECT;

    public async resolve(
        rawPath: string,
        fs: IFileSystemPort,
        _search: IWorkspaceSearchPort,
        _searchBlock?: string,
        _respectGitIgnore?: boolean
    ): Promise<ResolutionResult | null> {
        const pathExists = await fs.exists(rawPath);
        if (pathExists) {
            return {
                status: 'EXACT_MATCH',
                resolvedPath: rawPath,
                originalPath: rawPath,
                strategyUsed: this.name
            };
        }
        return null;
    }
}
