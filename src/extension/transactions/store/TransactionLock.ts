export class TransactionLock {
    private readonly lockedIds = new Set<string>();

    public acquireBatch(ids: string[]): boolean {
        if (ids.length === 0) {
            return true;
        }
        
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

    public acquire(transactionId: string): boolean {
        return this.acquireBatch([transactionId]);
    }

    public release(transactionId: string): void {
        this.lockedIds.delete(transactionId);
    }

    public releaseAll(): void {
        this.lockedIds.clear();
    }

    public isLocked(): boolean {
        return this.lockedIds.size > 0;
    }

    public getActiveId(): string | null {
        return this.lockedIds.size > 0 ? Array.from(this.lockedIds)[0] : null;
    }

    public getLockedIds(): string[] {
        return Array.from(this.lockedIds);
    }
}
