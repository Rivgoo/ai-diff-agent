import * as vscode from 'vscode';
import * as cp from 'child_process';
import { SYSTEM_CONSTANTS } from '@/shared/constants';
import type { TransactionSaga, CompensationAction } from '@/core/models/saga';

export type AntiAction =
    | { type: 'delete_created'; path: string }
    | { type: 'restore_file'; path: string; relativePath: string }
    | { type: 'restore_move'; sourcePath: string; destinationPath: string; relativeSourcePath: string }
    | { type: 'delete_dir_if_empty'; path: string }
    | { type: 'restore_dir'; path: string };

export interface TransactionRecord {
    operationId: string;
    antiActions: AntiAction[];
    summary: string;
}

export class CompensationStore {
    private memoryStore = new Map<string, TransactionSaga>();
    private readonly workspaceRootPath: string | undefined;

    constructor(private readonly storage: vscode.Memento) {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            this.workspaceRootPath = folders[0].uri.fsPath;
        }
        
        this.load();
        this.cleanupOldTransactions(7);
    }

    public getCurrentBranch(): string | undefined {
        if (!this.workspaceRootPath) return undefined;
        try {
            const branch = cp.execSync('git rev-parse --abbrev-ref HEAD', { 
                cwd: this.workspaceRootPath, 
                encoding: 'utf8',
                timeout: 500 
            }).trim();
            return branch;
        } catch {
            return undefined;
        }
    }

    public addSaga(saga: TransactionSaga): void {
        this.memoryStore.set(saga.transactionId, saga);
        this.persist();
    }

    public getSaga(transactionId: string): TransactionSaga | undefined {
        return this.memoryStore.get(transactionId);
    }

    // ФІКС: Новий метод для оновлення статусу замість видалення
    public updateSagaStatus(transactionId: string, status: 'saved' | 'reverted'): void {
        const saga = this.memoryStore.get(transactionId);
        if (saga) {
            this.memoryStore.set(transactionId, { ...saga, status });
            this.persist();
        }
    }

    public addTransaction(record: TransactionRecord): void {
        const compensations: CompensationAction[] = record.antiActions.map(act => {
            if (act.type === 'delete_created') return { type: 'DELETE_FILE', uri: act.path };
            if (act.type === 'restore_file') return { type: 'RESTORE_FILE_CONTENT', uri: act.path, transactionId: record.operationId, relativeBackupPath: act.relativePath };
            if (act.type === 'delete_dir_if_empty') return { type: 'DELETE_DIRECTORY_IF_EMPTY', uri: act.path };
            if (act.type === 'restore_dir') return { type: 'RESTORE_DIRECTORY', uri: act.path };
            return { type: 'RESTORE_MOVE', sourceUri: act.sourcePath, destinationUri: act.destinationPath, transactionId: record.operationId, relativeBackupPath: act.relativeSourcePath };
        });

        const saga: TransactionSaga = {
            transactionId: record.operationId,
            timestamp: Date.now(),
            compensations,
            summary: record.summary,
            branchName: this.getCurrentBranch(),
            status: 'pending' // При створенні статус pending
        };

        this.addSaga(saga);
    }

    public getTransaction(operationId: string): TransactionRecord | undefined {
        const saga = this.getSaga(operationId);
        if (!saga) return undefined;

        const antiActions: AntiAction[] = saga.compensations.map(comp => {
            if (comp.type === 'DELETE_FILE') return { type: 'delete_created', path: comp.uri };
            if (comp.type === 'RESTORE_FILE_CONTENT') return { type: 'restore_file', path: comp.uri, relativePath: comp.relativeBackupPath };
            if (comp.type === 'DELETE_DIRECTORY_IF_EMPTY') return { type: 'delete_dir_if_empty', path: comp.uri };
            if (comp.type === 'RESTORE_DIRECTORY') return { type: 'restore_dir', path: comp.uri };
            return { type: 'restore_move', sourcePath: comp.sourceUri, destinationPath: comp.destinationUri, relativeSourcePath: comp.relativeBackupPath };
        }) as AntiAction[];

        return {
            operationId: saga.transactionId,
            antiActions,
            summary: saga.summary
        };
    }

    public getAllIds(): string[] {
        return Array.from(this.memoryStore.keys());
    }

    public getAllSagas(): TransactionSaga[] {
        return Array.from(this.memoryStore.values()).sort((a, b) => b.timestamp - a.timestamp);
    }

    public cleanupOldTransactions(retentionDays: number): void {
        const now = Date.now();
        const msInDay = 1000 * 60 * 60 * 24;
        let requiresPersist = false;

        for (const [id, saga] of this.memoryStore.entries()) {
            const ageDays = (now - saga.timestamp) / msInDay;
            if (ageDays > retentionDays) {
                this.memoryStore.delete(id);
                requiresPersist = true;
            }
        }

        if (requiresPersist) {
            this.persist();
        }
    }

    private load(): void {
        try {
            const rawData = this.storage.get<any[]>(SYSTEM_CONSTANTS.STORAGE_KEY_TRANSACTIONS, []);
            for (const record of rawData) {
                if (record && typeof record === 'object' && record.transactionId) {
                    const saga: TransactionSaga = {
                        transactionId: record.transactionId,
                        timestamp: record.timestamp || Date.now(),
                        compensations: record.compensations || [],
                        summary: record.summary || 'Unknown operation',
                        branchName: record.branchName,
                        status: record.status || 'pending'
                    };
                    this.memoryStore.set(saga.transactionId, saga);
                }
            }
        } catch (error) {
            this.memoryStore.clear();
        }
    }

    private persist(): void {
        this.storage.update(SYSTEM_CONSTANTS.STORAGE_KEY_TRANSACTIONS, Array.from(this.memoryStore.values()));
    }
}