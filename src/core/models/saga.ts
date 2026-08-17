export type CompensationActionType =
    | 'DELETE_FILE'
    | 'RESTORE_FILE_CONTENT'
    | 'DELETE_DIRECTORY_IF_EMPTY'
    | 'RESTORE_MOVE'
    | 'RESTORE_DIRECTORY';

export interface DeleteFileAction {
    readonly type: 'DELETE_FILE';
    readonly uri: string;
}

export interface RestoreFileContentAction {
    readonly type: 'RESTORE_FILE_CONTENT';
    readonly uri: string;
    readonly transactionId: string;
    readonly relativeBackupPath: string;
}

export interface DeleteDirectoryIfEmptyAction {
    readonly type: 'DELETE_DIRECTORY_IF_EMPTY';
    readonly uri: string;
}

export interface RestoreMoveAction {
    readonly type: 'RESTORE_MOVE';
    readonly sourceUri: string;
    readonly destinationUri: string;
    readonly transactionId: string;
    readonly relativeBackupPath: string;
}

export interface RestoreDirectoryAction {
    readonly type: 'RESTORE_DIRECTORY';
    readonly uri: string;
}

export type CompensationAction =
    | DeleteFileAction
    | RestoreFileContentAction
    | DeleteDirectoryIfEmptyAction
    | RestoreMoveAction
    | RestoreDirectoryAction;

export interface TransactionSaga {
    readonly transactionId: string;
    readonly timestamp: number;
    readonly compensations: CompensationAction[];
    readonly summary: string;       
    readonly branchName?: string;   
    status?: 'pending' | 'saved' | 'reverted';
}