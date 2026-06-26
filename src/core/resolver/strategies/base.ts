import type { ResolutionResult } from '../models';
import type { IFileSystemPort, IWorkspaceSearchPort } from '../ports';

/**
 * Standard behavioral contract for all cascading path resolution strategies.
 */
export interface IPathResolutionStrategy {
    /**
     * Unique diagnostic identifier name of the strategy.
     */
    readonly name: string;

    /**
     * Attempts to resolve the path. Returns null if the strategy is unable to locate candidates.
     */
    resolve(
        rawPath: string,
        fs: IFileSystemPort,
        search: IWorkspaceSearchPort
    ): Promise<ResolutionResult | null>;
}
