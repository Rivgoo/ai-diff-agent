/// <reference types="node" />
/// <reference types="mocha" />

import * as assert from 'assert';
import { TransactionLock } from '../../src/extension/transactions/transactionLock';

describe('TransactionLock Unit Tests', () => {
    it('should allow acquiring lock on idle state', () => {
        const lock = new TransactionLock();
        assert.strictEqual(lock.isLocked(), false);
        
        const success = lock.acquire('tx-1');
        assert.strictEqual(success, true);
        assert.strictEqual(lock.isLocked(), true);
        assert.strictEqual(lock.getActiveId(), 'tx-1');
    });

    it('should block acquisition by another transaction ID', () => {
        const lock = new TransactionLock();
        lock.acquire('tx-1');

        const success = lock.acquire('tx-2');
        assert.strictEqual(success, false);
        assert.strictEqual(lock.getActiveId(), 'tx-1');
    });

    it('should allow re-acquisition by the same transaction ID', () => {
        const lock = new TransactionLock();
        lock.acquire('tx-1');

        const success = lock.acquire('tx-1');
        assert.strictEqual(success, true);
    });

    it('should release the lock correctly', () => {
        const lock = new TransactionLock();
        lock.acquire('tx-1');
        lock.release('tx-1');

        assert.strictEqual(lock.isLocked(), false);
        assert.strictEqual(lock.getActiveId(), null);

        // Now another tx can acquire
        const success = lock.acquire('tx-2');
        assert.strictEqual(success, true);
    });

    it('should ignore release requests from non-owners', () => {
        const lock = new TransactionLock();
        lock.acquire('tx-1');
        lock.release('tx-2'); // wrong owner

        assert.strictEqual(lock.isLocked(), true);
        assert.strictEqual(lock.getActiveId(), 'tx-1');
    });
});
