import { ChatSession, OperationStatus, AgentSettings } from './models';

/**
 * Typed IPC Bridge defining boundaries between Webview and Extension Host.
 */

export type PipelineStage = 'idle' | 'parsing' | 'validating' | 'resolving' | 'staging' | 'reviewing' | 'error';

// Requests sent FROM Webview TO Extension Host
export type WebviewEvent =
    | { type: 'REQUEST_STATE_SYNC' }
    | { type: 'REQUEST_SETTINGS_SYNC' }
    | { type: 'UPDATE_SETTINGS'; settings: AgentSettings }
    | { type: 'SUBMIT_PAYLOAD'; payload: string }
    | { type: 'CANCEL_PROCESSING' } // Dispatched when the user hits Cancel during a pipeline run
    | { type: 'ACTION_ACCEPT'; operationId: string }
    | { type: 'ACTION_REJECT'; operationId: string }
    | { type: 'ACTION_ACCEPT_ALL' }
    | { type: 'ACTION_REJECT_ALL' }
    | { type: 'OPEN_DIFF'; operationId: string }
    | { type: 'CLEAR_SESSION' }
    | { type: 'DOWNLOAD_INSTRUCTIONS' };

// Events dispatched FROM Extension Host TO Webview
export type ExtensionEvent =
    | { type: 'STATE_HYDRATE'; session: ChatSession }
    | { type: 'SETTINGS_HYDRATE'; settings: AgentSettings }
    | { type: 'OPERATION_UPDATED'; operationId: string; status: OperationStatus }
    | { type: 'AGENT_TYPING'; isTyping: boolean }
    | { type: 'PIPELINE_STATE'; stage: PipelineStage; current: number; total: number }
    | { type: 'ERROR_OCCURRED'; message: string };
