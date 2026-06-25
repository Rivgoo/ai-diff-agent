/**
 * Core Domain Models shared between Webview UI and Extension Host.
 * STRICT RULE: No VS Code API imports allowed in this file.
 */

export type OperationStatus = 'pending' | 'reviewing' | 'applied' | 'rejected' | 'conflict' | 'error' | 'manual_modified';
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
    errorMessage?: string;
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
