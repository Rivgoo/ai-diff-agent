import type { ChatSession, OperationStatus, AgentSettings } from "../shared/models";
import type { ConflictDetails, Range } from "../shared/contracts";
import type { TransactionSaga } from "../core/models/saga";

export type PipelineStage = "idle" | "parsing" | "validating" | "resolving" | "applying" | "error";

export type PromptMode = 'stable' | 'experimental' | 'custom-stable' | 'custom-experimental';

export type WebviewEvent =
  | { type: "REQUEST_STATE_SYNC" }
  | { type: "REQUEST_SETTINGS_SYNC" }
  | { type: "REQUEST_HISTORY_SYNC" }
  | { type: "ROLLBACK_SAGA"; transactionIds: string[] }
  | { type: "UPDATE_SETTING"; category: "ui" | "workflow" | "engine" | "ast" | "ai" | "bridge"; key: string; value: any; }
  | { type: "SUBMIT_PAYLOAD"; payload: string }
  | { type: "CANCEL_PROCESSING" }
  | { type: "ACTION_SAVE_ALL"; hasConflicts?: boolean }
  | { type: "ACTION_REVERT_ALL" }
  | { type: "ACTION_ACCEPT_OPERATION"; operationId: string; isWalkthrough?: boolean }
  | { type: "ACTION_REVERT_OPERATION"; operationId: string; isWalkthrough?: boolean }
  | { type: "OPEN_FILE"; operationId: string }
  | { type: "OPEN_DIFF"; operationId: string }
  | { type: "OPEN_HISTORY_DIFF"; operationId: string; filePath: string } 
  | { type: "OPEN_FILE_AT_RANGE"; path: string; range?: Range }
  | { type: "CLEAR_SESSION" }
  | { type: "NEW_SESSION" }
  | { type: "SWITCH_SESSION"; sessionId: string }
  | { type: "DELETE_SESSION"; sessionId: string }
  | { type: "COPY_PROMPT"; mode?: PromptMode }
  | { type: "DOWNLOAD_INSTRUCTIONS" }
  | { type: "SHOW_OUTPUT_LOG" }
  | { type: "OPEN_EXTERNAL_LINK"; url: string }
  | { type: "SMART_RETRY_CONTEXT"; operationId: string }
  | { type: "ACTION_JUMP_TO_NEXT_BLOCK" }
  | { type: "SET_WALKTHROUGH_STATE"; isActive: boolean }
  | { type: "OPEN_PROBLEMS_PANEL" }
  | { type: "BRIDGE_TO_MAKE1TXT" };

export type ExtensionEvent =
  | { type: "STATE_HYDRATE"; sessions: Record<string, ChatSession>; activeSessionId: string; }
  | { type: "SETTINGS_HYDRATE"; settings: AgentSettings }
  | { type: "HISTORY_HYDRATE"; history: TransactionSaga[]; currentBranch?: string }
  | { type: "OPERATION_UPDATED"; operationId: string; status: OperationStatus; resolvedResiliently?: boolean; originalPath?: string; path?: string; conflict?: ConflictDetails; isDirectory?: boolean; matchStrategy?: string; alreadyApplied?: boolean; isPartiallyResolved?: boolean; blastRadiusWarning?: string; }
  | { type: "AGENT_TYPING"; isTyping: boolean }
  | { type: "PIPELINE_STATE"; stage: PipelineStage; current: number; total: number; }
  | { type: "PROMPT_COPIED" }
  | { type: "ERROR_OCCURRED"; message: string }
  | { type: "OPERATION_BATCH_UPDATED"; updates: Array<{ operationId: string; status: OperationStatus; resolvedResiliently?: boolean; originalPath?: string; path?: string; conflict?: ConflictDetails; isDirectory?: boolean; matchStrategy?: string; alreadyApplied?: boolean; isPartiallyResolved?: boolean; blastRadiusWarning?: string; }>; }
  | { type: "WALKTHROUGH_COMPLETED" };