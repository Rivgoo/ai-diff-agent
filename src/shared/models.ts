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

export interface UiSettings {
  autoScroll: boolean;
  compactMode: boolean;
  showConfidenceBadges: boolean;
  enableCodeLens: boolean;
}

export interface WorkflowSettings {
  chatHistoryMode: 'workspace' | 'global' | 'disabled';
  autoSaveAfterAccept: boolean;
  formatBehavior: 'always' | 'onSaveOnly' | 'never';
  cleanupEmptyDirectories: boolean;
  backupRetentionDays: number;
}

export interface EngineSettings {
  payloadRecoveryMode: 'strict' | 'standard' | 'aggressive';
  fallbackMatchLevel: 'none' | 'safe' | 'aggressive';
  maxFileSizeMb: number;
  
  // Legacy properties awaiting removal in final phases
  strictParsing: boolean;
  allowCdataUnwrap: boolean;
  allowFuzzyMatching: boolean;
  allowSlidingWindow: boolean;
  blockOnSyntaxErrors: boolean;
  respectGitIgnore: boolean;
  enableAstMatching: boolean;
  strictSyntaxValidation: boolean;
  autoFixSyntax: boolean;
}

export interface AstSettings {
  enabledLanguages: string[];
  sanityStrictness: 'ignore' | 'warn' | 'block_on_error' | 'block_on_missing';
  validateEmbeddedScripts: boolean;
  queryTolerance: 'exact' | 'allow_signature_drift';
}

export interface AgentSettings {
  ui: UiSettings;
  workflow: WorkflowSettings;
  engine: EngineSettings;
  ast: AstSettings;
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
  matchStrategy?: string;
  alreadyApplied?: boolean;
  confidenceScore?: 'High' | 'Medium' | 'Low' | 'Warning';
  isPartiallyResolved?: boolean;
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