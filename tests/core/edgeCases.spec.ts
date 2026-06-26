import * as assert from 'assert';
import { PathNormalizer } from '../../src/core/workspace/pathNormalizer';
import { PathSanitizer } from '../../src/core/workspace/pathSanitizer';
import { ResilientPathResolver } from '../../src/core/resolver/resilientPathResolver';
import type { IFileSystemPort, IWorkspaceSearchPort } from '../../src/core/resolver/ports';

class FileSystemMock implements IFileSystemPort {
    constructor(private readonly files: Set<string>) {}
    public async exists(path: string): Promise<boolean> {
        return this.files.has(path);
    }
}

class WorkspaceSearchMock implements IWorkspaceSearchPort {
    constructor(private readonly files: string[]) {}
    public async findFiles(globPattern: string): Promise<string[]> {
        const filename = globPattern.replace('**/', '');
        return this.files.filter(f => f.endsWith('/' + filename) || f === filename);
    }
}

describe('Resilient Path Resolver - Edge Cases Verification', () => {

    describe('PathSanitizer Edge Cases', () => {
        it('should strip ASCII control characters, carriage returns, and tabs seamlessly', () => {
            const raw = "\t/src/components/Button.tsx \r\n";
            const sanitized = PathSanitizer.sanitize(raw);
            assert.strictEqual(sanitized, '/src/components/Button.tsx');
        });

        it('should collapse multiple redundant slash separators into a single slash', () => {
            const raw = '///src////components//////Button.tsx';
            const sanitized = PathSanitizer.sanitize(raw);
            assert.strictEqual(sanitized, '/src/components/Button.tsx');
        });
    });

    describe('PathNormalizer Edge Cases', () => {
        it('should strip multiple consecutive leading/trailing slashes and sanitize backslashes', () => {
            const raw = '///workspace\\\\src//components///Button.tsx';
            const normalized = PathNormalizer.normalize(raw, 'workspace');
            assert.strictEqual(normalized, 'src/components/Button.tsx');
        });

        it('should handle Windows drive letter prefixes and restore relative paths securely', () => {
            const raw = 'C:\\workspace\\src\\app.ts';
            const normalized = PathNormalizer.normalize(raw, 'workspace');
            assert.strictEqual(normalized, 'src/app.ts');
        });

        it('should strip file:// scheme prefixes completely', () => {
            const raw = 'file:///workspace/src/utils/math.ts';
            const normalized = PathNormalizer.normalize(raw, 'workspace');
            assert.strictEqual(normalized, 'src/utils/math.ts');
        });

        it('should execute case-insensitive root name pruning successfully', () => {
            const raw = '///AI-DIFF-AGENT/src/components/Button.tsx';
            const normalized = PathNormalizer.normalize(raw, 'ai-diff-agent');
            assert.strictEqual(normalized, 'src/components/Button.tsx');
        });
    });

    describe('ResilientPathResolver Edge Cases', () => {
        it('should throw an error on empty, blank, or control character paths', async () => {
            const resolver = new ResilientPathResolver(new FileSystemMock(new Set()), new WorkspaceSearchMock([]));
            await assert.rejects(
                async () => {
                    await resolver.resolvePath(' \t\n ');
                },
                /Target resolution file path cannot be empty/
            );
        });

        it('should resolve paths containing trailing whitespace or carriage returns resiliently', async () => {
            const fileSet = new Set(['src/components/Button.tsx']);
            const resolver = new ResilientPathResolver(
                new FileSystemMock(fileSet), 
                new WorkspaceSearchMock(Array.from(fileSet))
            );
            
            const result = await resolver.resolvePath('src/components/Button.tsx \r\n');
            assert.strictEqual(result.status, 'EXACT_MATCH');
            assert.strictEqual(result.resolvedPath, 'src/components/Button.tsx');
        });
    });
});
