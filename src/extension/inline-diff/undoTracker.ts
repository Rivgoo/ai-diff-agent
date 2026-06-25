import * as vscode from 'vscode';

export interface RevertData {
    uri: vscode.Uri;
    originalText: string;
    appliedRange: vscode.Range;
}

/**
 * Tracks the original state of modified code blocks to allow safe rejection (Undo).
 */
export class UndoTracker {
    private history = new Map<string, RevertData[]>();

    /**
     * Registers a reversion checkpoint for a specific operation.
     */
    public track(operationId: string, data: RevertData): void {
        const existing = this.history.get(operationId) || [];
        existing.push(data);
        this.history.set(operationId, existing);
    }

    /**
     * Retrieves and clears the reversion checkpoints for an operation.
     */
    public consumeRevertData(operationId: string): RevertData[] {
        const data = this.history.get(operationId) || [];
        this.history.delete(operationId);
        return data;
    }

    public clear(operationId: string): void {
        this.history.delete(operationId);
    }
}
