/**
 * Types of compensation operations used to roll back modified resources.
 */
export type CompensationActionType =
    | 'DELETE_FILE'
    | 'RESTORE_FILE_CONTENT'
    | 'DELETE_DIRECTORY_IF_EMPTY'
    | 'RESTORE_MOVE'
    | 'RESTORE_DIRECTORY'; // Added for Phase 2 directory restoration on empty folder rollbacks

/**
 * Compensation command payload to remove a file created during the transaction.
 */
export interface DeleteFileAction {
    readonly type: 'DELETE_FILE';
    readonly uri: string; // Serialized VS Code Uri string
}

/**
 * Compensation command payload to restore a modified file back to its pre-transaction state.
 */
export interface RestoreFileContentAction {
    readonly type: 'RESTORE_FILE_CONTENT';
    readonly uri: string; // Serialized VS Code Uri string
    readonly transactionId: string;
    readonly relativeBackupPath: string;
}

/**
 * Compensation command payload to clean up scaffolded empty directories during rollback.
 */
export interface DeleteDirectoryIfEmptyAction {
    readonly type: 'DELETE_DIRECTORY_IF_EMPTY';
    readonly uri: string; // Serialized VS Code Uri string
}

/**
 * Compensation command payload to restore a moved file or directory back to its original location.
 */
export interface RestoreMoveAction {
    readonly type: 'RESTORE_MOVE';
    readonly sourceUri: string; // Serialized VS Code Uri string
    readonly destinationUri: string; // Serialized VS Code Uri string
    readonly transactionId: string;
    readonly relativeBackupPath: string;
}

/**
 * Compensation command payload to restore a deleted empty directory back to its original state during rollback.
 */
export interface RestoreDirectoryAction {
    readonly type: 'RESTORE_DIRECTORY';
    readonly uri: string; // Serialized VS Code Uri string
}

/**
 * Union type representing any actionable compensation step in the transaction lifecycle.
 */
export type CompensationAction =
    | DeleteFileAction
    | RestoreFileContentAction
    | DeleteDirectoryIfEmptyAction
    | RestoreMoveAction
    | RestoreDirectoryAction;

/**
 * Defines a structural contract of a transaction saga containing compensating actions.
 */
export interface TransactionSaga {
    readonly transactionId: string;
    readonly timestamp: number;
    readonly compensations: CompensationAction[];
}
