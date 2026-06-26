/**
 * Concurrency helper to lock the active transaction state.
 * Prevents race conditions or nested modifications of files before the user has resolved
 * (Saved or Reverted) the previous AI transaction payload.
 */
export class TransactionLock {
    private activeTransactionId: string | null = null;

    /**
     * Attempts to acquire the lock for a specific transaction.
     * Returns true if successfully locked or already locked by the same transaction ID.
     */
    public acquire(transactionId: string): boolean {
        if (this.activeTransactionId !== null && this.activeTransactionId !== transactionId) {
            return false;
        }
        this.activeTransactionId = transactionId;
        return true;
    }

    /**
     * Releases the active lock.
     */
    public release(transactionId: string): void {
        if (this.activeTransactionId === transactionId) {
            this.activeTransactionId = null;
        }
    }

    /**
     * Returns true if there is an active lock.
     */
    public isLocked(): boolean {
        return this.activeTransactionId !== null;
    }

    /**
     * Gets the active transaction ID that holds the lock, if any.
     */
    public getActiveId(): string | null {
        return this.activeTransactionId;
    }
}
