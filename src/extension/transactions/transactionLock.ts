/**
 * Concurrency helper to lock the active transaction state.
 * Prevents race conditions or nested modifications of files before the user has resolved
 * (Saved or Reverted) the previous AI transaction payload.
 * Supports multi-key set-based batch locking.
 */
export class TransactionLock {
    private readonly lockedIds = new Set<string>();

    /**
     * Attempts to acquire the lock for a batch of transaction IDs.
     * Succeeds only if the lock is completely idle or if the keys are already locked.
     */
    public acquireBatch(ids: string[]): boolean {
        if (ids.length === 0) {
            return true;
        }
        
        // If already locked by other IDs (not in this batch), reject.
        for (const id of this.lockedIds) {
            if (!ids.includes(id)) {
                return false;
            }
        }
        
        for (const id of ids) {
            this.lockedIds.add(id);
        }
        return true;
    }

    /**
     * Attempts to acquire the lock for a specific transaction ID.
     * Preserved for backward-compatibility with single-operation patterns.
     */
    public acquire(transactionId: string): boolean {
        return this.acquireBatch([transactionId]);
    }

    /**
     * Releases a specific lock.
     */
    public release(transactionId: string): void {
        this.lockedIds.delete(transactionId);
    }

    /**
     * Releases all locked IDs.
     */
    public releaseAll(): void {
        this.lockedIds.clear();
    }

    /**
     * Returns true if there is an active lock.
     */
    public isLocked(): boolean {
        return this.lockedIds.size > 0;
    }

    /**
     * Gets one of the active transaction IDs that holds the lock, if any.
     */
    public getActiveId(): string | null {
        return this.lockedIds.size > 0 ? Array.from(this.lockedIds)[0] : null;
    }

    /**
     * Gets all locked transaction IDs.
     */
    public getLockedIds(): string[] {
        return Array.from(this.lockedIds);
    }
}
