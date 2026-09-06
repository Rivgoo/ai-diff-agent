import type { IPathResolutionStrategy, ResolutionOptions } from './base';
import type { ResolutionResult } from '../models';
import type { IFileSystemPort, IWorkspaceSearchPort } from '../ports';
import { RESOLVER_CONSTANTS } from '../constants';

export class DirectMatchStrategy implements IPathResolutionStrategy {
    public readonly name = RESOLVER_CONSTANTS.STRATEGY_NAMES.DIRECT;

    public async resolve(
        rawPath: string,
        fs: IFileSystemPort,
        _search: IWorkspaceSearchPort,
        _searchBlock?: string,
        _options?: ResolutionOptions
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