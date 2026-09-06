import { createContext, type ReactNode } from 'react';
import { useAgentStore } from './agentStore';
import type { ChatSession, AgentSettings } from '@/shared/models';

export interface AgentContextContract {
    state: {
        activeSessionId: string;
        sessions: Record<string, ChatSession>;
        isAgentTyping: boolean;
        settings: AgentSettings;
        isSettingsOpen: boolean;
        isPromptCopied: boolean;
        isDiagnosticsOpen: boolean; 
        isHistoryOpen: boolean; 
    };
    actions: {
        toggleSettings: () => void;
        toggleHistoryWindow: (forceState?: boolean) => void;
    };
}

export const AgentContext = createContext<AgentContextContract | null>(null);

export const AgentProvider = ({ children }: { children: ReactNode }) => {
    const activeSessionId = useAgentStore((s) => s.activeSessionId);
    const sessions = useAgentStore((s) => s.sessions);
    const isAgentTyping = useAgentStore((s) => s.isAgentTyping);
    const settings = useAgentStore((s) => s.settings);
    const isSettingsOpen = useAgentStore((s) => s.isSettingsOpen);
    const isPromptCopied = useAgentStore((s) => s.isPromptCopied);
    const isDiagnosticsOpen = useAgentStore((s) => s.isDiagnosticsOpen);
    const isHistoryOpen = useAgentStore((s) => s.isHistoryOpen);
    
    const toggleSettings = useAgentStore((s) => s.toggleSettings);
    const toggleHistoryWindow = useAgentStore((s) => s.toggleHistoryWindow);

    const value: AgentContextContract = {
        state: {
            activeSessionId,
            sessions,
            isAgentTyping,
            settings,
            isSettingsOpen,
            isPromptCopied,
            isDiagnosticsOpen,
            isHistoryOpen
        },
        actions: {
            toggleSettings,
            toggleHistoryWindow
        }
    };

    return (
        <AgentContext.Provider value={value}>
            {children}
        </AgentContext.Provider>
    );
};