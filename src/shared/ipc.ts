import type { ChatSession, OperationStatus, AgentSettings } from '../shared/models';
import type { ConflictDetails } from '../shared/contracts';

export type PipelineStage = 'idle' | 'parsing' | 'validating' | 'resolving' | 'applying' | 'error';

export type WebviewEvent =
    | { type: 'REQUEST_STATE_SYNC' }
    | { type: 'REQUEST_SETTINGS_SYNC' }
    | { type: 'UPDATE_SETTINGS'; settings: AgentSettings }
    | { type: 'SUBMIT_PAYLOAD'; payload: string }
    | { type: 'CANCEL_PROCESSING' }
    | { type: 'ACTION_SAVE_ALL' }
    | { type: 'ACTION_REVERT_ALL' }
    | { type: 'OPEN_FILE'; operationId: string }
    | { type: 'CLEAR_SESSION' }
    | { type: 'COPY_PROMPT' }
    | { type: 'DOWNLOAD_INSTRUCTIONS' }
    | { type: 'SHOW_OUTPUT_LOG' }; // New direct route to VS Code Output Channel

export type ExtensionEvent =
    | { type: 'STATE_HYDRATE'; session: ChatSession }
    | { type: 'SETTINGS_HYDRATE'; settings: AgentSettings }
    | { 
        type: 'OPERATION_UPDATED'; 
        operationId: string; 
        status: OperationStatus;
        resolvedResiliently?: boolean;
        originalPath?: string;
        path?: string;
        conflict?: ConflictDetails;
      }
    | { type: 'AGENT_TYPING'; isTyping: boolean }
    | { type: 'PIPELINE_STATE'; stage: PipelineStage; current: number; total: number }
    | { type: 'PROMPT_COPIED' }
    | { type: 'ERROR_OCCURRED'; message: string };
