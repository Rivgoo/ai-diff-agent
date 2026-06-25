import { ChatSession, OperationStatus, AgentSettings } from './models';

/**
 * Typed IPC Bridge defining boundaries between Webview and Extension.
 */

// Requests sent FROM Webview TO Extension Host
export type WebviewEvent =
    | { type: 'REQUEST_STATE_SYNC' }
    | { type: 'REQUEST_SETTINGS_SYNC' }
    | { type: 'UPDATE_SETTINGS'; settings: AgentSettings }
    | { type: 'SUBMIT_PAYLOAD'; payload: string }
    | { type: 'ACTION_ACCEPT'; operationId: string }
    | { type: 'ACTION_REJECT'; operationId: string }
    | { type: 'CLEAR_SESSION' }
    | { type: 'DOWNLOAD_INSTRUCTIONS' };

// Events dispatched FROM Extension Host TO Webview
export type ExtensionEvent =
    | { type: 'STATE_HYDRATE'; session: ChatSession }
    | { type: 'SETTINGS_HYDRATE'; settings: AgentSettings }
    | { type: 'OPERATION_UPDATED'; operationId: string; status: OperationStatus }
    | { type: 'AGENT_TYPING'; isTyping: boolean }
    | { type: 'ERROR_OCCURRED'; message: string };
