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
        isDirectory?: boolean
    ) => void;
    updateLocalSetting: (category: 'behavior' | 'engine', key: string, value: any) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
    sessions: {},
    activeSessionId: '',
    isAgentTyping: false,
    settings: { 
        behavior: { autoScroll: true, compactMode: false, storeChatInWorkspace: false }, 
        engine: { strictParsing: false, maxBackupRetentionDays: 7 },
        isFallbackMode: false
    },
    isSettingsOpen: false,
    isPromptCopied: false,
    pipelineProgress: { stage: 'idle', current: 0, total: 0 },
    composerDraft: '',

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

    updateOperationStatus: (operationId, status, resolvedResiliently, originalPath, path, conflict, isDirectory) =>
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
                    isDirectory: isDirectory ?? updatedOps[opIndex].isDirectory
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
        })
}));
