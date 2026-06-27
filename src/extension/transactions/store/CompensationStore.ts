import * as vscode from 'vscode';
import { SYSTEM_CONSTANTS } from '@/shared/constants';
import type { TransactionSaga, CompensationAction } from '@/core/models/saga';

export type AntiAction =
    | { type: 'delete_created'; uri: vscode.Uri }
    | { type: 'restore_file'; uri: vscode.Uri; relativePath: string }
    | { type: 'restore_move'; sourceUri: vscode.Uri; destinationUri: vscode.Uri; relativeSourcePath: string }
    | { type: 'delete_dir_if_empty'; uri: vscode.Uri }
    | { type: 'restore_dir'; uri: vscode.Uri };

export interface TransactionRecord {
    operationId: string;
    antiActions: AntiAction[];
}

export class CompensationStore {
    private memoryStore = new Map<string, TransactionSaga>();

    constructor(private readonly storage: vscode.Memento) {
        this.load();
    }

    public addSaga(saga: TransactionSaga): void {
        this.memoryStore.set(saga.transactionId, saga);
        this.persist();
    }

    public getSaga(transactionId: string): TransactionSaga | undefined {
        return this.memoryStore.get(transactionId);
    }

    public clearSaga(transactionId: string): void {
        this.memoryStore.delete(transactionId);
        this.persist();
    }

    public addTransaction(record: TransactionRecord): void {
        const compensations: CompensationAction[] = record.antiActions.map(act => {
            if (act.type === 'delete_created') {
                return { type: 'DELETE_FILE', uri: act.uri.toString() };
            }
            if (act.type === 'restore_file') {
                return {
                    type: 'RESTORE_FILE_CONTENT',
                    uri: act.uri.toString(),
                    transactionId: record.operationId,
                    relativeBackupPath: act.relativePath
                };
            }
            if (act.type === 'delete_dir_if_empty') {
                return { type: 'DELETE_DIRECTORY_IF_EMPTY', uri: act.uri.toString() };
            }
            if (act.type === 'restore_dir') {
                return { type: 'RESTORE_DIRECTORY', uri: act.uri.toString() };
            }
            return {
                type: 'RESTORE_MOVE',
                sourceUri: act.sourceUri.toString(),
                destinationUri: act.destinationUri.toString(),
                transactionId: record.operationId,
                relativeBackupPath: act.relativeSourcePath
            };
        });

        const saga: TransactionSaga = {
            transactionId: record.operationId,
            timestamp: Date.now(),
            compensations
        };

        this.addSaga(saga);
    }

    public getTransaction(operationId: string): TransactionRecord | undefined {
        const saga = this.getSaga(operationId);
        if (!saga) return undefined;

        const antiActions: AntiAction[] = saga.compensations.map(comp => {
            if (comp.type === 'DELETE_FILE') {
                return { type: 'delete_created', uri: vscode.Uri.parse(comp.uri) };
            }
            if (comp.type === 'RESTORE_FILE_CONTENT') {
                return {
                    type: 'restore_file',
                    uri: vscode.Uri.parse(comp.uri),
                    relativePath: comp.relativeBackupPath
                };
            }
            if (comp.type === 'DELETE_DIRECTORY_IF_EMPTY') {
                return { type: 'delete_dir_if_empty', uri: vscode.Uri.parse(comp.uri) };
            }
            if (comp.type === 'RESTORE_DIRECTORY') {
                return { type: 'restore_dir', uri: vscode.Uri.parse(comp.uri) };
            }
            return {
                type: 'restore_move',
                sourceUri: vscode.Uri.parse(comp.sourceUri),
                destinationUri: vscode.Uri.parse(comp.destinationUri),
                relativeSourcePath: comp.relativeBackupPath
            };
        }) as AntiAction[];

        return {
            operationId: saga.transactionId,
            antiActions
        };
    }

    public getAllIds(): string[] {
        return Array.from(this.memoryStore.keys());
    }

    public clearTransaction(operationId: string): void {
        this.clearSaga(operationId);
    }

    private load(): void {
        try {
            const rawData = this.storage.get<any[]>(SYSTEM_CONSTANTS.STORAGE_KEY_TRANSACTIONS, []);
            for (const record of rawData) {
                if (record && typeof record === 'object' && record.transactionId) {
                    const saga: TransactionSaga = {
                        transactionId: record.transactionId,
                        timestamp: record.timestamp || Date.now(),
                        compensations: record.compensations || []
                    };
                    this.memoryStore.set(saga.transactionId, saga);
                }
            }
        } catch (error) {
            this.memoryStore.clear();
        }
    }

    private persist(): void {
        this.storage.update(
            SYSTEM_CONSTANTS.STORAGE_KEY_TRANSACTIONS,
            Array.from(this.memoryStore.values())
        );
    }
}
