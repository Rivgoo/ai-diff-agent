/// <reference types="node" />
/// <reference types="mocha" />

import * as assert from 'assert';
import { TransactionCompiler } from '../../src/core/compiler/transactionCompiler';
import type { AnyOperation } from '../../src/core/models/operations';

describe('TransactionCompiler Unit & Integration Tests', () => {
    const compiler = new TransactionCompiler();

    it('should successfully compile standard conflict-free operations', () => {
        const ops: AnyOperation[] = [
            { id: '1', type: 'create_file', path: 'src/app.ts', content: 'console.log("hello");', status: 'pending' },
            { id: '2', type: 'create_dir', path: 'src/components', status: 'pending' }
        ];

        const result = compiler.compile(ops);
        assert.strictEqual(result.success, true);
        if (result.success) {
            const compiled = result.value.operations;
            assert.strictEqual(compiled.length, 2);
            assert.strictEqual(result.value.warnings.length, 0);
        }
    });

    it('should collapse consecutive duplicate Create operations (last-writer-wins)', () => {
        const ops: AnyOperation[] = [
            { id: '1', type: 'create_file', path: 'src/main.ts', content: 'console.log("v1");', status: 'pending' },
            { id: '2', type: 'create_file', path: 'src/main.ts', content: 'console.log("v2");', status: 'pending' }
        ];

        const result = compiler.compile(ops);
        assert.strictEqual(result.success, true);
        if (result.success) {
            const compiled = result.value.operations;
            assert.strictEqual(compiled.length, 1);
            assert.strictEqual(compiled[0].type, 'create_file');
            assert.strictEqual((compiled[0] as any).content, 'console.log("v2");');
            assert.strictEqual(result.value.warnings.length, 1);
        }
    });

    it('should resolve Delete followed by Create into a single overwritten Create', () => {
        const ops: AnyOperation[] = [
            { id: '1', type: 'delete_path', path: 'src/legacy.ts', status: 'pending' },
            { id: '2', type: 'create_file', path: 'src/legacy.ts', content: 'const fresh = true;', status: 'pending' }
        ];

        const result = compiler.compile(ops);
        assert.strictEqual(result.success, true);
        if (result.success) {
            const compiled = result.value.operations;
            assert.strictEqual(compiled.length, 1);
            assert.strictEqual(compiled[0].type, 'create_file');
            assert.strictEqual((compiled[0] as any).content, 'const fresh = true;');
            assert.strictEqual(result.value.warnings.length, 1);
        }
    });

    it('should resolve Create followed by Delete into a complete No-op', () => {
        const ops: AnyOperation[] = [
            { id: '1', type: 'create_file', path: 'src/temp.ts', content: 'temp content', status: 'pending' },
            { id: '2', type: 'delete_path', path: 'src/temp.ts', status: 'pending' }
        ];

        const result = compiler.compile(ops);
        assert.strictEqual(result.success, true);
        if (result.success) {
            const compiled = result.value.operations;
            assert.strictEqual(compiled.length, 0); // Both operations are optimized away
            assert.strictEqual(result.value.warnings.length, 1);
        }
    });

    it('should apply updates to newly created files directly in-memory', () => {
        const ops: AnyOperation[] = [
            { id: '1', type: 'create_file', path: 'src/app.ts', content: 'const port = 3000;\nconst host = "localhost";', status: 'pending' },
            { id: '2', type: 'update_file', path: 'src/app.ts', changes: [
                { search: 'const port = 3000;', replace: 'const port = 8080;' }
            ], status: 'pending' }
        ];

        const result = compiler.compile(ops);
        assert.strictEqual(result.success, true);
        if (result.success) {
            const compiled = result.value.operations;
            assert.strictEqual(flattenedContains(compiled, 'update_file'), false);
            assert.strictEqual(compiled.length, 1);
            assert.strictEqual(compiled[0].type, 'create_file');
            assert.strictEqual((compiled[0] as any).content, 'const port = 8080;\nconst host = "localhost";');
        }
    });

    it('should safely absorb and drop updates targeting deleted files', () => {
        const ops: AnyOperation[] = [
            { id: '1', type: 'delete_path', path: 'src/legacy.ts', status: 'pending' },
            { id: '2', type: 'update_file', path: 'src/legacy.ts', changes: [{ search: 'x', replace: 'y' }], status: 'pending' }
        ];

        const result = compilerCompile(operations => {
            const r = new TransactionCompiler().compile(ops);
            return r.success ? r.value.operations : [];
        });

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].type, 'delete_path');
    });

    it('should fold moves on newly created files into a single renamed creation', () => {
        const ops: AnyOperation[] = [
            { id: '1', type: 'create_file', path: 'src/old.ts', content: 'export const x = 1;', status: 'pending' },
            { id: '2', type: 'move_path', path: 'src/old.ts', destinationPath: 'src/new.ts', status: 'pending' }
        ];

        const result = compiler.compile(ops);
        assert.strictEqual(result.success, true);
        if (result.success) {
            const compiled = result.value.operations;
            assert.strictEqual(compiled.length, 1);
            assert.strictEqual(compiled[0].type, 'create_file');
            assert.strictEqual(compiled[0].path, 'src/new.ts');
            assert.strictEqual((compiled[0] as any).content, 'export const x = 1;');
        }
    });

    it('should reorder updates to original path prior to moving them on disk', () => {
        const ops: AnyOperation[] = [
            { id: '1', type: 'move_path', path: 'src/old.ts', destinationPath: 'src/new.ts', status: 'pending' },
            { id: '2', type: 'update_file', path: 'src/new.ts', changes: [
                { search: 'export const old = 1;', replace: 'export const updated = 1;' }
            ], status: 'pending' }
        ];

        const result = compiler.compile(ops);
        assert.strictEqual(result.success, true);
        if (result.success) {
            const compiled = result.value.operations;
            assert.strictEqual(compiled.length, 2);
            // Verify ordering: Update targets original path FIRST
            assert.strictEqual(compiled[0].type, 'update_file');
            assert.strictEqual(compiled[0].path, 'src/old.ts');
            
            assert.strictEqual(compiled[1].type, 'move_path');
            assert.strictEqual(compiled[1].path, 'src/old.ts');
            assert.strictEqual((compiled[1] as any).destinationPath, 'src/new.ts');
        }
    });
});

// Helper testing wrapper
function flattenedContains(ops: AnyOperation[], type: string): boolean {
    return ops.some(op => op.type === type);
}

function compilerCompile(fn: (ops: AnyOperation[]) => AnyOperation[]): AnyOperation[] {
    return fn([]);
}
