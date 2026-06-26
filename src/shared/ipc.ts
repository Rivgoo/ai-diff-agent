import type {
  ChatSession,
  OperationStatus,
  AgentSettings,
} from "../shared/models";
import type { ConflictDetails } from "../shared/contracts";

export type PipelineStage =
  | "idle"
  | "parsing"
  | "validating"
  | "resolving"
  | "applying"
  | "error";

export type WebviewEvent =
  | { type: "REQUEST_STATE_SYNC" }
  | { type: "REQUEST_SETTINGS_SYNC" }
  | {
      type: "UPDATE_SETTING";
      category: "behavior" | "engine";
      key: string;
      value: any;
    }
  | { type: "SUBMIT_PAYLOAD"; payload: string }
  | { type: "CANCEL_PROCESSING" }
  | { type: "ACTION_SAVE_ALL" }
  | { type: "ACTION_REVERT_ALL" }
  | { type: "ACTION_ACCEPT_OPERATION"; operationId: string }
  | { type: "ACTION_REVERT_OPERATION"; operationId: string }
  | { type: "OPEN_FILE"; operationId: string }
  | { type: "OPEN_DIFF"; operationId: string }
  | { type: "CLEAR_SESSION" }
  | { type: "NEW_SESSION" }
  | { type: "SWITCH_SESSION"; sessionId: string }
  | { type: "DELETE_SESSION"; sessionId: string }
  | { type: "COPY_PROMPT" }
  | { type: "DOWNLOAD_INSTRUCTIONS" }
  | { type: "SHOW_OUTPUT_LOG" };

export type ExtensionEvent =
  | {
      type: "STATE_HYDRATE";
      sessions: Record<string, ChatSession>;
      activeSessionId: string;
    }
  | { type: "SETTINGS_HYDRATE"; settings: AgentSettings }
  | {
      type: "OPERATION_UPDATED";
      operationId: string;
      status: OperationStatus;
      resolvedResiliently?: boolean;
      originalPath?: string;
      path?: string;
      conflict?: ConflictDetails;
    }
  | { type: "AGENT_TYPING"; isTyping: boolean }
  | {
      type: "PIPELINE_STATE";
      stage: PipelineStage;
      current: number;
      total: number;
    }
  | { type: "PROMPT_COPIED" }
  | { type: "ERROR_OCCURRED"; message: string };
