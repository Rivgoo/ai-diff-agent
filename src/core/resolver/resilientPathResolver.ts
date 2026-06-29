import type { IFileSystemPort, IWorkspaceSearchPort } from './ports';
import type { ResolutionResult } from './models';
import { PathResolutionException } from './models';
import type { IPathResolutionStrategy } from './strategies/base';
import { DirectMatchStrategy } from './strategies/directMatch';
import { SegmentHeuristicStrategy } from './strategies/segmentHeuristic';
import { GlobalFilenameStrategy } from './strategies/globalFilename';

/**
 * Core Orchestrator coordinating the cascading resolution strategies.
 * Evaluates target paths sequentially (Direct -> Heuristic -> Global) to achieve absolute fault tolerance.
 */
export class ResilientPathResolver {
    private readonly strategies: IPathResolutionStrategy[] = [
        new DirectMatchStrategy(),
        new SegmentHeuristicStrategy(),
        new GlobalFilenameStrategy()
    ];

    constructor(
        private readonly fsPort: IFileSystemPort,
        private readonly searchPort: IWorkspaceSearchPort
    ) {}

    public async resolvePath(rawPath: string, searchBlock?: string): Promise<ResolutionResult> {
        if (!rawPath || rawPath.trim() === '') {
            throw PathResolutionException.emptyInputPath();
        }

        const cleanPath = rawPath.trim();

        // Process strategies in sequential priority
        for (const strategy of this.strategies) {
            try {
                // Передаємо searchBlock в стратегію
                const result = await strategy.resolve(cleanPath, this.fsPort, this.searchPort, searchBlock);
                if (result !== null) {
                    return result;
                }
            } catch (err) {
                const errorInstance = err instanceof Error ? err : new Error(String(err));
                throw PathResolutionException.executionFailed(strategy.name, errorInstance);
            }
        }

        return {
            status: 'NOT_FOUND',
            resolvedPath: cleanPath,
            originalPath: cleanPath,
            strategyUsed: 'NONE'
        };
    }
}
