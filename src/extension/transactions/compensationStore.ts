import * as vscode from 'vscode';

export type AntiAction = 
    | { type: 'delete_created'; uri: vscode.Uri }
    | { type: 'restore_file'; uri: vscode.Uri; relativePath: string }
    | { type: 'restore_move'; sourceUri: vscode.Uri; destinationUri: vscode.Uri; relativeSourcePath: string };

export interface TransactionRecord {
    operationId: string;
    antiActions: AntiAction[];
}

/**
 * Memento-backed transaction record store.
 */
export class CompensationStore {
    private static readonly KEY = 'ai-diff-agent.transactions';
    private memoryStore = new Map<string, TransactionRecord>();

    constructor(private readonly storage: vscode.Memento) {
        this.load();
    }

    public addTransaction(record: TransactionRecord): void {
        this.memoryStore.set(record.operationId, record);
        this.persist();
    }

    public getTransaction(operationId: string): TransactionRecord | undefined {
        return this.memoryStore.get(operationId);
    }

    public getAllIds(): string[] {
        return Array.from(this.memoryStore.keys());
    }

    public clearTransaction(operationId: string): void {
        this.memoryStore.delete(operationId);
        this.persist();
    }

    private load(): void {
        const data = this.storage.get<TransactionRecord[]>(CompensationStore.KEY, []);
        for (const record of data) {
            const hydratedActions = record.antiActions.map(action => {
                const rawAct = action as any;
                if (action.type === 'delete_created') {
                    return {
                        type: 'delete_created',
                        uri: vscode.Uri.parse(rawAct.uri.fsPath || rawAct.uri.path)
                    };
                }
                if (action.type === 'restore_file') {
                    return {
                        type: 'restore_file',
                        uri: vscode.Uri.parse(rawAct.uri.fsPath || rawAct.uri.path),
                        relativePath: rawAct.relativePath
                    };
                }
                if (action.type === 'restore_move') {
                    return {
                        type: 'restore_move',
                        sourceUri: vscode.Uri.parse(rawAct.sourceUri.fsPath || rawAct.sourceUri.path),
                        destinationUri: vscode.Uri.parse(rawAct.destinationUri.fsPath || rawAct.destinationUri.path),
                        relativeSourcePath: rawAct.relativeSourcePath
                    };
                }
                return action;
            }) as AntiAction[];

            this.memoryStore.set(record.operationId, { operationId: record.operationId, antiActions: hydratedActions });
        }
    }

    private persist(): void {
        this.storage.update(CompensationStore.KEY, Array.from(this.memoryStore.values()));
    }
}
