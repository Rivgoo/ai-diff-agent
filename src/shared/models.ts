export interface ChangeStats {
    readonly additions: number;
    readonly deletions: number;
}

export type OperationStatus = 'pending' | 'applied_dirty' | 'saved' | 'reverted' | 'conflict' | 'error';
export type MessageRole = 'user' | 'agent' | 'system';
export type OperationType = 'create_file' | 'update_file' | 'delete_path' | 'move_path' | 'create_dir';

export interface AgentSettings {
    autoScroll: boolean;
    strictParsing: boolean;
}

export interface Position {
    readonly line: number;
    readonly character: number;
}

export interface Range {
    readonly start: Position;
    readonly end: Position;
}

export interface ChangeBlock {
    readonly search: string;
    readonly replace: string;
    matchRange?: Range;
}

export interface DiffOperation {
    id: string;
    type: OperationType;
    path: string;
    status: OperationStatus;
    changes: ChangeBlock[];
    sourcePath?: string;
    destinationPath?: string;
    errorMessage?: string;
    stats?: ChangeStats;
}

export interface ChatMessage {
    id: string;
    role: MessageRole;
    text: string;
    timestamp: number;
    operations?: DiffOperation[];
    errorDetails?: string;
}

export interface ChatSession {
    messages: ChatMessage[];
}
