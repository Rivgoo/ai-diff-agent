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

    it('should allow acquiring multiple transaction IDs as a batch', () => {
        const lock = new TransactionLock();
        const success = lock.acquireBatch(['tx-1', 'tx-2', 'tx-3']);
        assert.strictEqual(success, true);
        assert.strictEqual(lock.isLocked(), true);
        assert.deepStrictEqual(lock.getLockedIds(), ['tx-1', 'tx-2', 'tx-3']);
    });

    it('should reject a batch if any locked ID belongs to another active session', () => {
        const lock = new TransactionLock();
        lock.acquire('tx-1');

        const success = lock.acquireBatch(['tx-2', 'tx-3']);
        assert.strictEqual(success, false);
    });

    it('should release resolved IDs selectively and clear when empty', () => {
        const lock = new TransactionLock();
        lock.acquireBatch(['tx-1', 'tx-2']);
        
        lock.release('tx-1');
        assert.strictEqual(lock.isLocked(), true);
        assert.deepStrictEqual(lock.getLockedIds(), ['tx-2']);

        lock.release('tx-2');
        assert.strictEqual(lock.isLocked(), false);
        assert.strictEqual(lock.getActiveId(), null);
    });
});
