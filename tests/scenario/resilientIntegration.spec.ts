import * as assert from 'assert';
import { TransactionManager } from '../../src/extension/transactions/transactionManager';
import { CompensationStore } from '../../src/extension/transactions/compensationStore';
import { DecorationService } from '../../src/extension/transactions/decorationService';
import type { AnyOperation } from '../../src/core/models/operations';
import { resetMockState, mockFilesystem } from '../mocks/vscode.mock';
import type { DiffOperation } from '../../src/shared/models';

describe('Saga Engine End-to-End Integration - Resilient Path Resolution Flow', () => {
    let store: CompensationStore;
    let decorationService: DecorationService;
    let manager: TransactionManager;
    const statusLogs: { opId: string; status: string; metadata?: Partial<DiffOperation> }[] = [];

    const mockMemento: any = {
        get: () => [],
        update: () => Promise.resolve()
    };

    beforeEach(() => {
        resetMockState();
        statusLogs.length = 0;

        store = new CompensationStore(mockMemento);
        decorationService = new DecorationService();
        
        manager = new TransactionManager(store, decorationService, (opId, status, metadata) => {
            statusLogs.push({ opId, status, metadata });
        });
    });

    it('should resiliently resolve, stage, and write changes when original path contains directory mismatches', async () => {
        const fileUriStr = 'file:///workspace/src/components/Button.tsx';
        const fileContent = 'export const Button = () => {\n    return <button>Click</button>;\n};';
        
        // Setup stateful virtual file system matching expectations
        mockFilesystem.set(fileUriStr, fileContent);

        const operations: AnyOperation[] = [
            {
                id: 'op-resilient-update',
                type: 'update_file',
                // Path is wrong (legacy folder does not exist), but file exists inside components/
                path: 'src/legacy/Button.tsx',
                changes: [
                    { 
                        search: 'return <button>Click</button>;', 
                        replace: 'return <button className="custom">Click</button>;' 
                    }
                ],
                status: 'pending'
            }
        ];

        await manager.applyBatch(operations);

        // Pre-flight checks should pass, resilient resolution rewrites destination path on disk
        const log = statusLogs.find(l => l.opId === 'op-resilient-update');
        assert.ok(log);
        assert.strictEqual(log!.status, 'applied_dirty');
        assert.strictEqual(log!.metadata?.resolvedResiliently, true);
        assert.strictEqual(log!.metadata?.originalPath, 'src/legacy/Button.tsx');
        assert.strictEqual(log!.metadata?.path, 'src/components/Button.tsx');

        // Confirm modifications wrote directly into resolved target buffer
        const modifiedContent = mockFilesystem.get(fileUriStr);
        assert.ok(modifiedContent?.includes('className="custom"'));
    });

    it('should abort batch pre-flight and report ambiguous conflict suggestions when duplicates are found', async () => {
        const file1 = 'file:///workspace/src/components/Button.tsx';
        const file2 = 'file:///workspace/src/shared/Button.tsx';
        
        mockFilesystem.set(file1, 'content1');
        mockFilesystem.set(file2, 'content2');

        const operations: AnyOperation[] = [
            {
                id: 'op-ambiguous-update',
                type: 'update_file',
                path: 'src/legacy/Button.tsx', // Button.tsx exists in BOTH directories, causing segment ambiguity
                changes: [
                    { search: 'content1', replace: 'new' }
                ],
                status: 'pending'
            }
        ];

        await manager.applyBatch(operations);

        const log = statusLogs.find(l => l.opId === 'op-ambiguous-update');
        assert.ok(log);
        assert.strictEqual(log!.status, 'conflict');
        assert.strictEqual(log!.metadata?.conflict?.reason, 'AMBIGUOUS_MATCH');
        assert.strictEqual(log!.metadata?.conflict?.candidatePaths?.length, 2);
        assert.ok(log!.metadata?.conflict?.candidatePaths?.includes('src/components/Button.tsx'));
    });

    it('should complete transactional Saga atomic rollback when nested execution steps fail', async () => {
        const buttonUri = 'file:///workspace/src/components/Button.tsx';
        const mathUri = 'file:///workspace/src/utils/math.ts';

        mockFilesystem.set(buttonUri, 'export const Button = () => {};');
        mockFilesystem.set(mathUri, 'export const add = (a, b) => a + b;');

        const operations: AnyOperation[] = [
            {
                id: 'op-button',
                type: 'update_file',
                path: 'src/legacy/Button.tsx', // Found resiliently
                changes: [
                    { search: 'export const Button = () => {};', replace: 'export const StyledButton = () => {};' }
                ],
                status: 'pending'
            },
            {
                id: 'op-math',
                type: 'update_file',
                path: 'src/utils/math.ts', // Found exactly, but search matches fail (forcing conflict abort)
                changes: [
                    { search: 'NON_EXISTENT_MATH_FUNCTION_TRIGGERING_CONFLICT', replace: 'sub' }
                ],
                status: 'pending'
            }
        ];

        await manager.applyBatch(operations);

        // Pre-flight checks should fail on the second file, triggering atomic rollback of both staged files
        const buttonLog = statusLogs.find(l => l.opId === 'op-button');
        const mathLog = statusLogs.find(l => l.opId === 'op-math');

        assert.strictEqual(buttonLog!.status, 'conflict');
        assert.strictEqual(mathLog!.status, 'conflict');

        // Confirm both files are left untouched
        assert.strictEqual(mockFilesystem.get(buttonUri), 'export const Button = () => {};');
        assert.strictEqual(mockFilesystem.get(mathUri), 'export const add = (a, b) => a + b;');
    });
});
