import * as vscode from 'vscode';
import { SYSTEM_CONSTANTS } from '../../shared/constants';
import type { TransactionSaga, CompensationAction } from '../../core/models/saga';

/**
 * LEGACY TYPE DEFINITIONS
 * Preserved and extended to support directory cleanup actions while maintaining
 * backward compatibility during incremental migration phases.
 */
export type AntiAction =
    | { type: 'delete_created'; uri: vscode.Uri }
    | { type: 'restore_file'; uri: vscode.Uri; relativePath: string }
    | { type: 'restore_move'; sourceUri: vscode.Uri; destinationUri: vscode.Uri; relativeSourcePath: string }
    | { type: 'delete_dir_if_empty'; uri: vscode.Uri }
    | { type: 'restore_dir'; uri: vscode.Uri }; // Added for resilient empty directory cleanup restoration

export interface TransactionRecord {
    operationId: string;
    antiActions: AntiAction[];
}

/**
 * Persistent Saga Log storage manager.
 * Uses VS Code Memento to store transaction logs, ensuring recovery is possible
 * even if the editor or extension host restarts unexpectedly.
 */
export class CompensationStore {
    private memoryStore = new Map<string, TransactionSaga>();

    constructor(private readonly storage: vscode.Memento) {
        this.load();
    }

    // ==========================================================================
    // MODERN SAGA API (Phase 1+)
    // ==========================================================================

    /**
     * Registers a new transaction saga and persists its compensation logs.
     */
    public addSaga(saga: TransactionSaga): void {
        this.memoryStore.set(saga.transactionId, saga);
        this.persist();
    }

    /**
     * Retrieves an active transaction saga by its unique transaction identifier.
     */
    public getSaga(transactionId: string): TransactionSaga | undefined {
        return this.memoryStore.get(transactionId);
    }

    /**
     * Removes the transaction saga log after successful commit or rollback.
     */
    public clearSaga(transactionId: string): void {
        this.memoryStore.delete(transactionId);
        this.persist();
    }

    // ==========================================================================
    // BACKWARD COMPATIBILITY ADAPTERS (Preserves existing legacy systems)
    // ==========================================================================

    /**
     * Legacy adapter to register anti-actions mapped under transaction record format.
     */
    public addTransaction(record: TransactionRecord): void {
        const compensations: CompensationAction[] = record.antiActions.map(act => {
            if (act.type === 'delete_created') {
                return {
                    type: 'DELETE_FILE',
                    uri: act.uri.toString()
                };
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
                return {
                    type: 'DELETE_DIRECTORY_IF_EMPTY',
                    uri: act.uri.toString()
                };
            }
            if (act.type === 'restore_dir') {
                return {
                    type: 'RESTORE_DIRECTORY',
                    uri: act.uri.toString()
                };
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

    /**
     * Legacy adapter to retrieve transaction logs mapped back to original structures.
     */
    public getTransaction(operationId: string): TransactionRecord | undefined {
        const saga = this.getSaga(operationId);
        if (!saga) return undefined;

        const antiActions: AntiAction[] = saga.compensations.map(comp => {
            if (comp.type === 'DELETE_FILE') {
                return {
                    type: 'delete_created',
                    uri: vscode.Uri.parse(comp.uri)
                };
            }
            if (comp.type === 'RESTORE_FILE_CONTENT') {
                return {
                    type: 'restore_file',
                    uri: vscode.Uri.parse(comp.uri),
                    relativePath: comp.relativeBackupPath
                };
            }
            if (comp.type === 'DELETE_DIRECTORY_IF_EMPTY') {
                return {
                    type: 'delete_dir_if_empty',
                    uri: vscode.Uri.parse(comp.uri)
                };
            }
            if (comp.type === 'RESTORE_DIRECTORY') {
                return {
                    type: 'restore_dir',
                    uri: vscode.Uri.parse(comp.uri)
                };
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

    /**
     * Retrieves identifiers of all pending transactions.
     */
    public getAllIds(): string[] {
        return Array.from(this.memoryStore.keys());
    }

    /**
     * Legacy adapter to remove a record.
     */
    public clearTransaction(operationId: string): void {
        this.clearSaga(operationId);
    }

    // ==========================================================================
    // PRIVATE STORAGE UTILITIES
    // ==========================================================================

    /**
     * Hydrates in-memory storage map from local Memento persistent storage.
     */
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
            // Fail-safe initialization on corrupted storage logs
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
