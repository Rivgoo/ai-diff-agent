import * as assert from 'assert';
import { ResilientPathResolver } from '../../src/core/resolver/resilientPathResolver';
import type { IFileSystemPort, IWorkspaceSearchPort } from '../../src/core/resolver/ports';
import { PathResolutionException } from '../../src/core/resolver/models';

/**
 * Memory-based Mock FileSystem Adapter for lightning-fast, isolated testing.
 */
class MemoryFileSystemMock implements IFileSystemPort {
    constructor(private readonly activeFiles: Set<string>) {}

    public async exists(relativePath: string): Promise<boolean> {
        return this.activeFiles.has(relativePath);
    }
}

/**
 * Memory-based Mock WorkspaceSearch Adapter.
 */
class MemoryWorkspaceSearchMock implements IWorkspaceSearchPort {
    constructor(private readonly activeFiles: string[]) {}

    public async findFiles(globPattern: string, _excludePattern?: string): Promise<string[]> {
        // Simple mock glob-to-regex matcher for **/[filename] searches
        const filenamePart = globPattern.replace('**/', '');
        return this.activeFiles.filter(filePath => {
            const normalized = filePath.replace(/\\/g, '/');
            return normalized.endsWith(`/${filenamePart}`) || normalized === filenamePart;
        });
    }
}

describe('ResilientPathResolver Unit Tests', () => {
    
    it('should resolve direct paths immediately when exact match exists (Phase 1)', async () => {
        const fileSet = new Set(['src/components/Button.tsx', 'src/utils/math.ts']);
        const fsMock = new MemoryFileSystemMock(fileSet);
        const searchMock = new MemoryWorkspaceSearchMock(Array.from(fileSet));
        
        const resolver = new ResilientPathResolver(fsMock, searchMock);
        const result = await resolver.resolvePath('src/components/Button.tsx');

        assert.strictEqual(result.status, 'EXACT_MATCH');
        assert.strictEqual(result.resolvedPath, 'src/components/Button.tsx');
        assert.strictEqual(result.strategyUsed, 'DIRECT_MATCH');
    });

    it('should resolve relocated files using segment heuristic matching (Phase 2)', async () => {
        const physicalFiles = ['src/features/button/Button.tsx', 'src/utils/math.ts'];
        const fsMock = new MemoryFileSystemMock(new Set(physicalFiles));
        const searchMock = new MemoryWorkspaceSearchMock(physicalFiles);

        const resolver = new ResilientPathResolver(fsMock, searchMock);
        
        // Requested path contains mismatched middle segments
        const result = await resolver.resolvePath('src/components/button/Button.tsx');

        assert.strictEqual(result.status, 'RESOLVED_RESILIENTLY');
        assert.strictEqual(result.resolvedPath, 'src/features/button/Button.tsx');
        assert.strictEqual(result.strategyUsed, 'SEGMENT_HEURISTIC');
        assert.strictEqual(result.originalPath, 'src/components/button/Button.tsx');
    });

    it('should resolve to ambiguous match when multiple high-confidence heuristic files conflict', async () => {
        const physicalFiles = [
            'src/features/button/Button.tsx', 
            'src/shared/button/Button.tsx',
            'src/utils/math.ts'
        ];
        const fsMock = new MemoryFileSystemMock(new Set(physicalFiles));
        const searchMock = new MemoryWorkspaceSearchMock(physicalFiles);

        const resolver = new ResilientPathResolver(fsMock, searchMock);
        const result = await resolver.resolvePath('src/legacy/button/Button.tsx');

        assert.strictEqual(result.status, 'AMBIGUOUS_MATCH');
        assert.strictEqual(result.strategyUsed, 'SEGMENT_HEURISTIC');
        assert.ok(result.candidatePaths?.includes('src/features/button/Button.tsx'));
        assert.ok(result.candidatePaths?.includes('src/shared/button/Button.tsx'));
    });

    it('should cascade to global filename search when directory context fails completely (Phase 3)', async () => {
        const physicalFiles = ['src/deep/nested/folder/module/Logger.ts'];
        const fsMock = new MemoryFileSystemMock(new Set(physicalFiles));
        const searchMock = new MemoryWorkspaceSearchMock(physicalFiles);

        const resolver = new ResilientPathResolver(fsMock, searchMock);
        
        // Completely wrong requested folder context, but uniquely identified project-wide
        const result = await resolver.resolvePath('legacy/Logger.ts');

        assert.strictEqual(result.status, 'RESOLVED_RESILIENTLY');
        assert.strictEqual(result.resolvedPath, 'src/deep/nested/folder/module/Logger.ts');
        assert.strictEqual(result.strategyUsed, 'GLOBAL_FILENAME');
    });

    it('should yield ambiguous match on global search fallback if multiple files exist', async () => {
        const physicalFiles = [
            'src/deep/Logger.ts',
            'src/utils/Logger.ts'
        ];
        const fsMock = new MemoryFileSystemMock(new Set(physicalFiles));
        const searchMock = new MemoryWorkspaceSearchMock(physicalFiles);

        const resolver = new ResilientPathResolver(fsMock, searchMock);
        const result = await resolver.resolvePath('Logger.ts');

        assert.strictEqual(result.status, 'AMBIGUOUS_MATCH');
        assert.strictEqual(result.strategyUsed, 'GLOBAL_FILENAME');
        assert.strictEqual(result.candidatePaths?.length, 2);
    });

    it('should yield NOT_FOUND when target does not exist across any strategy', async () => {
        const fsMock = new MemoryFileSystemMock(new Set(['src/index.ts']));
        const searchMock = new MemoryWorkspaceSearchMock(['src/index.ts']);

        const resolver = new ResilientPathResolver(fsMock, searchMock);
        const result = await resolver.resolvePath('src/components/Modal.tsx');

        assert.strictEqual(result.status, 'NOT_FOUND');
    });

    it('should throw Domain Exception on empty target parameter checks', async () => {
        const fsMock = new MemoryFileSystemMock(new Set());
        const searchMock = new MemoryWorkspaceSearchMock([]);
        const resolver = new ResilientPathResolver(fsMock, searchMock);

        await assert.rejects(
            async () => {
                await resolver.resolvePath('   ');
            },
            (err: any) => {
                assert.ok(err instanceof PathResolutionException);
                assert.strictEqual(err.errorCode, 'ERR_EMPTY_TARGET_PATH');
                return true;
            }
        );
    });
});
