import type {
  ConflictDetails,
  Position,
  Range,
  ConflictReason,
  PayloadSummary,
} from "./contracts";

export type { ConflictDetails, ConflictReason, Position, Range };

export interface ChangeStats {
  readonly additions: number;
  readonly deletions: number;
}

export type OperationStatus =
  | "pending"
  | "applied_dirty"
  | "saved"
  | "reverted"
  | "conflict"
  | "error";

export type MessageRole = "user" | "agent" | "system";

export type OperationType =
  | "create_file"
  | "update_file"
  | "delete_path"
  | "move_path"
  | "create_dir";

export interface BehaviorSettings {
  autoScroll: boolean;
  compactMode: boolean;
  storeChatInWorkspace: boolean;
}

export interface EngineSettings {
  strictParsing: boolean;
  maxBackupRetentionDays: number;
  autoFixSyntax: boolean;
}

export interface AgentSettings {
  behavior: BehaviorSettings;
  engine: EngineSettings;
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
  originalPath?: string;
  resolvedResiliently?: boolean;
  status: OperationStatus;
  changes: ChangeBlock[];
  sourcePath?: string;
  destinationPath?: string;
  errorMessage?: string;
  stats?: ChangeStats;
  conflict?: ConflictDetails;
  isDirectory?: boolean;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  operations?: DiffOperation[];
  errorDetails?: string;
  payloadSummary?: PayloadSummary;
  isOptimisticPending?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
}
