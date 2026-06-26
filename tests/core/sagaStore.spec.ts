/// <reference types="node" />
/// <reference types="mocha" />

declare var require: any;
declare var __dirname: string;

const path = require('path');
const Module = require('module');
const originalRequire = Module.prototype.require;

// Intercept requirements globally to mock 'vscode' and resolve '@/' path aliases dynamically at runtime.
Module.prototype.require = function (this: any, id: string) {
    if (id === 'vscode') {
        return {
            Uri: {
                parse: (val: string) => ({
                    toString: () => val,
                    fsPath: val,
                    path: val
                })
            }
        };
    }

    // Resolves Deviation: Dynamic path mapping for '@/' alias during CommonJS runtime execution.
    if (id.startsWith('@/')) {
        const relativePart = id.substring(2);
        const targetPath = path.resolve(__dirname, '../../src', relativePart);
        return originalRequire.call(this, targetPath);
    }

    return originalRequire.apply(this, arguments);
};

import * as assert from 'assert';
import { CompensationStore } from '../../src/extension/transactions/compensationStore';
import type { TransactionSaga } from '../../src/core/models/saga';

/**
 * In-memory test double of VS Code Memento state storage.
 */
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

        // Map and inject legacy transaction record format
        const legacyRecord = {
            operationId: 'legacy-tx',
            antiActions: [
                { type: 'delete_created', uri: { toString: () => 'file:///legacy.ts' } as any }
            ]
        };

        store.addTransaction(legacyRecord as any);

        // Retrieve and verify legacy mappings via adapters (using explicit cast for Union type check)
        const retrieved = store.getTransaction('legacy-tx');
        assert.ok(retrieved);
        assert.strictEqual(retrieved!.operationId, 'legacy-tx');
        assert.strictEqual(retrieved!.antiActions[0].type, 'delete_created');
        assert.strictEqual((retrieved!.antiActions[0] as any).uri.toString(), 'file:///legacy.ts');
    });

    it('should survive storage payload corruption gracefully', () => {
        const memento = new MockMemento();
        
        // Emulate corrupted JSON configuration
        memento.update('ai-diff-agent.transactions', 'CORRUPT_NON_ARRAY_STRING');

        const store = new CompensationStore(memento as any);
        
        // Ensure graceful recovery with empty storage
        assert.strictEqual(store.getAllIds().length, 0);
    });
});
