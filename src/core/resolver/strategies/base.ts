import type { ResolutionResult } from '../models';
import type { IFileSystemPort, IWorkspaceSearchPort } from '../ports';

export interface IPathResolutionStrategy {
    readonly name: string;
    resolve(
        rawPath: string,
        fs: IFileSystemPort,
        search: IWorkspaceSearchPort,
        searchBlock?: string 
    ): Promise<ResolutionResult | null>;
}
