import { create } from 'zustand';
import type { ChatMessage, ChatSession, AgentSettings, OperationStatus } from '../../shared/models';
import type { PipelineStage } from '../../shared/ipc';
import type { ConflictDetails } from '../../shared/contracts';

interface PipelineProgress {
    stage: PipelineStage;
    current: number;
    total: number;
}

interface AgentState {
    messages: ChatMessage[];
    isAgentTyping: boolean;
    settings: AgentSettings;
    isSettingsOpen: boolean;
    isPromptCopied: boolean;
    pipelineProgress: PipelineProgress;

    hydrateSession: (session: ChatSession) => void;
    hydrateSettings: (settings: AgentSettings) => void;
    setAgentTyping: (isTyping: boolean) => void;
    setPromptCopied: (copied: boolean) => void;
    clearSession: () => void;
    toggleSettings: () => void;
    setPipelineProgress: (progress: PipelineProgress) => void;
    
    /**
     * Updates an operation with full metadata synchronization.
     * Prevents UI desync for resiliently resolved paths and global conflict candidate lists.
     */
    updateOperationStatus: (
        operationId: string, 
        status: OperationStatus,
        resolvedResiliently?: boolean,
        originalPath?: string,
        path?: string,
        conflict?: ConflictDetails
    ) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
    messages: [],
    isAgentTyping: false,
    settings: { autoScroll: true, strictParsing: false },
    isSettingsOpen: false,
    isPromptCopied: false,
    pipelineProgress: { stage: 'idle', current: 0, total: 0 },

    hydrateSession: (session: ChatSession) => set({ messages: session.messages }),
    hydrateSettings: (settings: AgentSettings) => set({ settings }),
    setAgentTyping: (isTyping: boolean) => set({ isAgentTyping: isTyping }),
    setPromptCopied: (copied: boolean) => set({ isPromptCopied: copied }),
    clearSession: () => set({ messages: [] }),
    toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
    setPipelineProgress: (progress: PipelineProgress) => set({ pipelineProgress: progress }),

    updateOperationStatus: (
        operationId: string, 
        status: OperationStatus,
        resolvedResiliently?: boolean,
        originalPath?: string,
        path?: string,
        conflict?: ConflictDetails
    ) =>
        set((state) => ({
            messages: state.messages.map((msg) => {
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
                    conflict: conflict ?? updatedOps[opIndex].conflict
                };
                return { ...msg, operations: updatedOps };
            })
        }))
}));
