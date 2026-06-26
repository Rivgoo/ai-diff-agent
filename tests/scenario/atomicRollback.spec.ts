/// <reference types="node" />
/// <reference types="mocha" />

import * as assert from 'assert';
import { TransactionManager } from '../../src/extension/transactions/transactionManager';
import { CompensationStore } from '../../src/extension/transactions/compensationStore';
import { DecorationService } from '../../src/extension/transactions/decorationService';
import type { AnyOperation } from '../../src/core/models/operations';
import { resetMockState, mockFilesystem, mockApplyEditCallCount } from '../mocks/vscode.mock';

describe('Saga Engine Scenario - Atomic Failure Rollback Execution', () => {
    let store: CompensationStore;
    let decorationService: DecorationService;
    let manager: TransactionManager;
    const statusLogs: { opId: string; status: string }[] = [];

    const mockMemento: any = {
        get: () => [],
        update: () => Promise.resolve()
    };

    beforeEach(() => {
        resetMockState();
        statusLogs.length = 0;

        store = new CompensationStore(mockMemento);
        decorationService = new DecorationService();
        manager = new TransactionManager(store, decorationService, (opId, status) => {
            statusLogs.push({ opId, status });
        });
    });

    it('should rollback and clean up all resources atomically if ONE operation matching fails', async () => {
        const operations: AnyOperation[] = [
            {
                id: 'op-create',
                type: 'create_file',
                path: 'src/components/button.ts',
                content: 'export const Button = () => {};',
                status: 'pending'
            },
            {
                id: 'op-update',
                type: 'update_file',
                path: 'src/index.ts',
                changes: [
                    { search: 'NON_EXISTENT_PATTERN_TRIGGERING_MATCH_ERROR', replace: 'new content' }
                ],
                status: 'pending'
            }
        ];

        mockFilesystem.set('file:///workspace/src/index.ts', 'const x = 100;');

        await manager.applyBatch(operations);

        // Verify Workspace applyEdit call did not proceed on overall batch preparation mismatch
        assert.strictEqual(mockApplyEditCallCount, 0);
        assert.strictEqual(mockFilesystem.has('file:///workspace/src/components/'), false);
        assert.strictEqual(mockFilesystem.get('file:///workspace/src/index.ts'), 'const x = 100;');

        const lockRef = (manager as any).transactionLock;
        assert.strictEqual(lockRef.isLocked(), false);

        const createStatus = statusLogs.find(log => log.opId === 'op-create');
        const updateStatus = statusLogs.find(log => log.opId === 'op-update');

        assert.ok(createStatus);
        assert.ok(updateStatus);
        assert.strictEqual(createStatus!.status, 'conflict');
        assert.strictEqual(updateStatus!.status, 'conflict');
    });
});
