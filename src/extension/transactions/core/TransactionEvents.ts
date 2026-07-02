import type { ConflictDetails, OperationStatus } from '../../../shared/models';

export interface OperationStatusUpdate {
    operationId: string;
    status: OperationStatus;
    resolvedResiliently?: boolean;
    originalPath?: string;
    path?: string;
    conflict?: ConflictDetails;
    isDirectory?: boolean;
    matchStrategy?: string;
    alreadyApplied?: boolean;
    confidenceScore?: 'High' | 'Medium' | 'Low' | 'Warning'; 
}