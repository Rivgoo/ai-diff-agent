import { create } from 'zustand';
import type { ChatSession, AgentSettings, OperationStatus } from '../../shared/models';
import type { PipelineStage } from '../../shared/ipc';
import type { ConflictDetails } from '../../shared/contracts';

interface PipelineProgress {
    stage: PipelineStage;
    current: number;
    total: number;
}

interface AgentState {
    sessions: Record<string, ChatSession>;
    activeSessionId: string;
    isAgentTyping: boolean;
    settings: AgentSettings;
    isSettingsOpen: boolean;
    isPromptCopied: boolean;
    pipelineProgress: PipelineProgress;
    composerDraft: string;
    isWalkthroughActive: boolean;
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
    ) => void;
    updateLocalSetting: (category: 'ui' | 'workflow' | 'engine' | 'ast' | 'ai', key: string, value: any) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
    sessions: {},
    activeSessionId: '',
    isAgentTyping: false,
    settings: { 
        ui: { 
            autoScroll: true, 
            compactMode: false, 
            showConfidenceBadges: true, 
            enableCodeLens: true,
            phantomInlineDiffs: true,
            enableWalkthroughMode: false
        },
        workflow: { 
            chatHistoryMode: 'workspace', 
            autoSaveAfterAccept: true, 
            formatBehavior: 'onSaveOnly', 
            cleanupEmptyDirectories: true, 
            backupRetentionDays: 7,
            executionMode: 'tolerant',
            clipboardWatcher: false,
            historyBranchAwareness: true
        },
        engine: { 
            payloadRecoveryMode: 'aggressive',
            fallbackMatchLevel: 'safe',
            maxFileSizeMb: 5,
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
            enabledLanguages: ['javascript', 'typescript', 'python', 'c_sharp', 'json', 'html', 'css', 'bash', 'c'],
            sanityStrictness: 'warn',
            validateEmbeddedScripts: true,
            queryTolerance: 'allow_signature_drift',
            strictSyntaxValidation: false,
            autoFixSyntax: true,
            lspValidation: false,
            autoStitchImports: false,
            blastRadiusAnalysis: true
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

    hydrateSession: (sessions, activeId) => set({ sessions, activeSessionId: activeId }),
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

    updateOperationStatus: (operationId, status, resolvedResiliently, originalPath, path, conflict, isDirectory, matchStrategy, alreadyApplied, isPartiallyResolved) =>
        set((state) => {
            const activeSession = state.sessions[state.activeSessionId];
            if (!activeSession) return state;

            const updatedMessages = activeSession.messages.map((msg) => {
                if (!msg.operations) return msg;
                const opIndex = msg.operations.findIndex((o) => o.id === operationId);
                if (opIndex === -1) return msg;
                
                const updatedOps = [...msg.operations];
                updatedOps[opIndex] = { 
                    ...updatedOps[opIndex], 
                    status,
                    resolvedResiliently: resolvedResiliently ?? updatedOps[opIndex].resolvedResiliently,
                    originalPath: originalPath ?? updatedOps[opIndex].originalPath,
                    path: path ?? updatedOps[opIndex].path,
                    conflict: conflict ?? updatedOps[opIndex].conflict,
                    isDirectory: isDirectory ?? updatedOps[opIndex].isDirectory,
                    matchStrategy: matchStrategy ?? updatedOps[opIndex].matchStrategy,
                    alreadyApplied: alreadyApplied ?? updatedOps[opIndex].alreadyApplied,
                    confidenceScore: updatedOps[opIndex].confidenceScore,
                    isPartiallyResolved: isPartiallyResolved ?? updatedOps[opIndex].isPartiallyResolved
                };
                return { ...msg, operations: updatedOps };
            });

            return {
                sessions: {
                    ...state.sessions,
                    [state.activeSessionId]: {
                        ...activeSession,
                        messages: updatedMessages
                    }
                }
            };
        }),

    updateOperationBatch: (updates) => set((state) => {
        const activeSession = state.sessions[state.activeSessionId];
        if (!activeSession) return state;

        const updatesMap = new Map(updates.map(u => [u.operationId, u]));
        let sessionChanged = false;

        const updatedMessages = activeSession.messages.map((msg) => {
            if (!msg.operations) return msg;

            let messageChanged = false;
            const updatedOps = msg.operations.map(op => {
                const update = updatesMap.get(op.id);
                if (update) {
                    messageChanged = true;
                    sessionChanged = true;
                    return {
                        ...op,
                        status: update.status,
                        resolvedResiliently: update.resolvedResiliently ?? op.resolvedResiliently,
                        originalPath: update.originalPath ?? op.originalPath,
                        path: update.path ?? op.path,
                        conflict: update.conflict ?? op.conflict,
                        isDirectory: update.isDirectory ?? op.isDirectory,
                        matchStrategy: update.matchStrategy ?? op.matchStrategy,
                        confidenceScore: update.confidenceScore ?? op.confidenceScore,
                        isPartiallyResolved: update.isPartiallyResolved ?? op.isPartiallyResolved
                    };
                }
                return op;
            });

            return messageChanged ? { ...msg, operations: updatedOps } : msg;
        });

        if (!sessionChanged) return state;

        return {
            sessions: {
                ...state.sessions,
                [state.activeSessionId]: {
                    ...activeSession,
                    messages: updatedMessages
                }
            }
        };
    })
}));