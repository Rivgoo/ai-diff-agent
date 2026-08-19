import { create } from 'zustand';
import type { ChatSession, AgentSettings, OperationStatus, DiffOperation } from '../../shared/models';
import type { PipelineStage } from '../../shared/ipc';
import type { ConflictDetails } from '../../shared/contracts';
import type { TransactionSaga } from '../../core/models/saga';

interface PipelineProgress {
    stage: PipelineStage;
    current: number;
    total: number;
}

interface AgentState {
    sessions: Record<string, ChatSession>;
    operationsMap: Record<string, DiffOperation>; 
    activeSessionId: string;
    isAgentTyping: boolean;
    settings: AgentSettings;
    isSettingsOpen: boolean;
    isPromptCopied: boolean;
    pipelineProgress: PipelineProgress;
    composerDraft: string;
    isWalkthroughActive: boolean;
    isDiagnosticsOpen: boolean;
    history: TransactionSaga[];
    currentBranch?: string;
    isHistoryOpen: boolean;

    toggleHistoryWindow: (forceState?: boolean) => void;
    hydrateHistory: (history: TransactionSaga[], currentBranch?: string) => void;
    startWalkthrough: () => void;
    stopWalkthrough: () => void;
    updateOperationBatch: (updates: any[]) => void;
    hydrateSession: (sessions: Record<string, ChatSession>, activeId: string) => void;
    hydrateSettings: (settings: AgentSettings) => void;
    setAgentTyping: (isTyping: boolean) => void;
    setPromptCopied: (copied: boolean) => void;
    toggleSettings: () => void;
    setPipelineProgress: (progress: PipelineProgress) => void;
    setComposerDraft: (draft: string) => void;
    toggleDiagnosticsWindow: (forceState?: boolean) => void;
    
    updateOperationStatus: (
        operationId: string, 
        status: OperationStatus,
        resolvedResiliently?: boolean,
        originalPath?: string,
        path?: string,
        conflict?: ConflictDetails,
        isDirectory?: boolean,
        matchStrategy?: string,
        alreadyApplied?: boolean,
        isPartiallyResolved?: boolean,
        blastRadiusWarning?: string
    ) => void;
    updateLocalSetting: (category: 'ui' | 'workflow' | 'engine' | 'ast' | 'ai', key: string, value: any) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
    sessions: {},
    operationsMap: {}, 
    activeSessionId: '',
    history: [],
    isHistoryOpen: false,
    isAgentTyping: false,
    isDiagnosticsOpen: false,
    currentBranch: undefined,

    hydrateHistory: (history, currentBranch) => set({ history, currentBranch }),
    toggleHistoryWindow: (forceState) => set((state) => ({ 
        isHistoryOpen: forceState !== undefined ? forceState : !state.isHistoryOpen,
        isSettingsOpen: false, 
        isDiagnosticsOpen: false 
    })),

    toggleDiagnosticsWindow: (forceState) => set((state) => ({ 
        isDiagnosticsOpen: forceState !== undefined ? forceState : !state.isDiagnosticsOpen 
    })),

    settings: { 
        ui: { 
            autoScroll: true, 
            compactMode: false, 
            showConfidenceBadges: true, 
            enableCodeLens: true,
            enableWalkthroughMode: false,
            diagnosticsLevel: 'all'
        },
        workflow: { 
            chatHistoryMode: 'workspace', 
            autoSaveMode: 'on_accept', 
            formatBehavior: 'onSaveOnly', 
            cleanupEmptyDirectories: true, 
            ignoredCleanupDirs: ['.ds_store', 'thumbs.db', 'desktop.ini'],
            backupRetentionDays: 7,
            executionMode: 'tolerant',
            clipboardWatcher: false,
            historyBranchAwareness: true,
            historyKeepCount: 50 
        },
        engine: { 
            payloadRecoveryMode: 'aggressive',
            fallbackMatchLevel: 'safe',
            maxFileSizeMb: 5,
            maxGlobalSearchCandidates: 5,
            useUnsavedBuffers: true,
            polyglotParsing: true,
            strictParsing: false, 
            allowCdataUnwrap: true,
            allowFuzzyMatching: true,
            allowSlidingWindow: true,
            blockOnSyntaxErrors: false,
            respectGitIgnore: true
        },
        ast: {
            enableAstMatching: true,
            enabledLanguages: ['javascript', 'typescript', 'tsx', 'python', 'c_sharp', 'cpp', 'json', 'html', 'css', 'bash', 'c'],
            sanityStrictness: 'warn',
            validateEmbeddedScripts: true,
            queryTolerance: 'allow_signature_drift',
            strictSyntaxValidation: false,
            autoFixSyntax: true,
            lspValidation: false,
            autoStitchImports: false,
            blastRadiusAnalysis: true,
            parserTimeoutMs: 100,
            lspTimeoutMs: 2000 
        },
        ai: {
            feedbackLoopEnabled: false
        }
    },
    isSettingsOpen: false,
    isPromptCopied: false,
    pipelineProgress: { stage: 'idle', current: 0, total: 0 },
    composerDraft: '',
    isWalkthroughActive: false,

    startWalkthrough: () => set({ isWalkthroughActive: true }),
    stopWalkthrough: () => set({ isWalkthroughActive: false }),

    hydrateSession: (sessions, activeId) => set((state) => {
        const newOpsMap = { ...state.operationsMap };
        Object.values(sessions).forEach(session => {
            session.messages.forEach(msg => {
                msg.operations?.forEach(op => {
                    newOpsMap[op.id] = op;
                });
            });
        });
        return { sessions, activeSessionId: activeId, operationsMap: newOpsMap };
    }),

    hydrateSettings: (settings) => set({ settings }),
    setAgentTyping: (isTyping) => set({ isAgentTyping: isTyping }),
    setPromptCopied: (copied) => set({ isPromptCopied: copied }),
    toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
    setPipelineProgress: (progress) => set({ pipelineProgress: progress }),
    setComposerDraft: (draft) => set({ composerDraft: draft }),

    updateLocalSetting: (category, key, value) => set((state) => ({
        settings: {
            ...state.settings,
            [category]: {
                ...state.settings[category],
                [key]: value
            }
        }
    })),

    updateOperationStatus: (opId, status, resolvedResiliently, originalPath, path, conflict, isDirectory, matchStrategy, alreadyApplied, isPartiallyResolved, blastRadiusWarning) =>
        set((state) => {
            const currentOp = state.operationsMap[opId];
            if (!currentOp) return state;

            // ФІКС: Автоматичне очищення конфліктів при вирішенні
            const isResolved = status === 'saved' || status === 'reverted';

            return {
                operationsMap: {
                    ...state.operationsMap,
                    [opId]: {
                        ...currentOp,
                        status,
                        resolvedResiliently: resolvedResiliently ?? currentOp.resolvedResiliently,
                        originalPath: originalPath ?? currentOp.originalPath,
                        path: path ?? currentOp.path,
                        conflict: isResolved ? undefined : (conflict ?? currentOp.conflict),
                        isDirectory: isDirectory ?? currentOp.isDirectory,
                        matchStrategy: matchStrategy ?? currentOp.matchStrategy,
                        alreadyApplied: alreadyApplied ?? currentOp.alreadyApplied,
                        isPartiallyResolved: isPartiallyResolved ?? currentOp.isPartiallyResolved,
                        blastRadiusWarning: isResolved ? undefined : (blastRadiusWarning ?? currentOp.blastRadiusWarning)
                    }
                }
            };
        }),

    updateOperationBatch: (updates) => set((state) => {
        const newOpsMap = { ...state.operationsMap };
        let hasChanges = false;

        for (const update of updates) {
            const currentOp = newOpsMap[update.operationId];
            if (currentOp) {
                hasChanges = true;
                const isResolved = update.status === 'saved' || update.status === 'reverted';

                newOpsMap[update.operationId] = {
                    ...currentOp,
                    status: update.status,
                    resolvedResiliently: update.resolvedResiliently ?? currentOp.resolvedResiliently,
                    originalPath: update.originalPath ?? currentOp.originalPath,
                    path: update.path ?? currentOp.path,
                    conflict: isResolved ? undefined : (update.conflict ?? currentOp.conflict),
                    isDirectory: update.isDirectory ?? currentOp.isDirectory,
                    matchStrategy: update.matchStrategy ?? currentOp.matchStrategy,
                    confidenceScore: update.confidenceScore ?? currentOp.confidenceScore,
                    isPartiallyResolved: update.isPartiallyResolved ?? currentOp.isPartiallyResolved,
                    blastRadiusWarning: isResolved ? undefined : (update.blastRadiusWarning ?? currentOp.blastRadiusWarning)
                };
            }
        }

        return hasChanges ? { operationsMap: newOpsMap } : state;
    })
}));