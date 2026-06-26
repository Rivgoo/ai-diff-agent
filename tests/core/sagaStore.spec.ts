/// <reference types="node" />
/// <reference types="mocha" />

import * as assert from 'assert';
import * as vscode from 'vscode';
import { CompensationStore } from '../../src/extension/transactions/compensationStore';
import type { TransactionSaga } from '../../src/core/models/saga';

class MockMemento {
    private data = new Map<string, any>();

    public get<T>(key: string, defaultValue?: T): T {
        return this.data.has(key) ? this.data.get(key) : (defaultValue as T);
    }

    public update(key: string, value: any): Thenable<void> {
        this.data.set(key, value);
        return Promise.resolve();
    }
}

describe('Saga Log & CompensationStore Integration Tests', () => {
    it('should initialize with empty data when storage is fresh', () => {
        const memento = new MockMemento();
        const store = new CompensationStore(memento as any);

        assert.strictEqual(store.getAllIds().length, 0);
    });

    it('should successfully add and retrieve saga transactions', () => {
        const memento = new MockMemento();
        const store = new CompensationStore(memento as any);

        const saga: TransactionSaga = {
            transactionId: 'tx-100',
            timestamp: Date.now(),
            compensations: [
                { type: 'DELETE_FILE', uri: 'file:///workspace/src/test.ts' }
            ]
        };

        store.addSaga(saga);
        assert.strictEqual(store.getAllIds().length, 1);
        assert.strictEqual(store.getAllIds()[0], 'tx-100');

        const retrieved = store.getSaga('tx-100');
        assert.ok(retrieved);
        assert.strictEqual(retrieved!.transactionId, 'tx-100');
        assert.strictEqual(retrieved!.compensations[0].type, 'DELETE_FILE');
    });

    it('should maintain backward compatibility for legacy TransactionRecords and AntiActions', () => {
        const memento = new MockMemento();
        const store = new CompensationStore(memento as any);

        const legacyRecord = {
            operationId: 'legacy-tx',
            antiActions: [
                { type: 'delete_created', uri: vscode.Uri.parse('file:///legacy.ts') }
            ]
        };

        store.addTransaction(legacyRecord as any);

        const retrieved = store.getTransaction('legacy-tx');
        assert.ok(retrieved);
        assert.strictEqual(retrieved!.operationId, 'legacy-tx');
        assert.strictEqual(retrieved!.antiActions[0].type, 'delete_created');
        assert.strictEqual((retrieved!.antiActions[0] as any).uri.toString(), 'file:///legacy.ts');
    });

    it('should survive storage payload corruption gracefully', () => {
        const memento = new MockMemento();
        memento.update('ai-diff-agent.transactions', 'CORRUPT_NON_ARRAY_STRING');

        const store = new CompensationStore(memento as any);
        assert.strictEqual(store.getAllIds().length, 0);
    });
});
