import { create } from 'zustand';
import { ChatMessage, ChatSession, AgentSettings, OperationStatus } from '../../shared/models';
import { PipelineStage } from '../../shared/ipc';

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
    pipelineProgress: PipelineProgress;

    hydrateSession: (session: ChatSession) => void;
    hydrateSettings: (settings: AgentSettings) => void;
    setAgentTyping: (isTyping: boolean) => void;
    clearSession: () => void;
    toggleSettings: () => void;
    setPipelineProgress: (progress: PipelineProgress) => void;
    updateOperationStatus: (operationId: string, status: OperationStatus) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
    messages: [],
    isAgentTyping: false,
    settings: { autoScroll: true, strictParsing: false },
    isSettingsOpen: false,
    pipelineProgress: { stage: 'idle', current: 0, total: 0 },

    hydrateSession: (session: ChatSession) => set({ messages: session.messages }),
    hydrateSettings: (settings: AgentSettings) => set({ settings }),
    setAgentTyping: (isTyping: boolean) => set({ isAgentTyping: isTyping }),
    clearSession: () => set({ messages: [] }),
    toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
    setPipelineProgress: (progress: PipelineProgress) => set({ pipelineProgress: progress }),

    /**
     * Patches a single operation's status by ID — O(n) scan but avoids full React tree re-render.
     */
    updateOperationStatus: (operationId: string, status: OperationStatus) =>
        set((state) => ({
            messages: state.messages.map((msg) => {
                if (!msg.operations) return msg;
                const opIndex = msg.operations.findIndex((o) => o.id === operationId);
                if (opIndex === -1) return msg;
                const updatedOps = [...msg.operations];
                updatedOps[opIndex] = { ...updatedOps[opIndex], status };
                return { ...msg, operations: updatedOps };
            })
        }))
}));
