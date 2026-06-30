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
    };
    actions: {
        toggleSettings: () => void;
    };
}

export const AgentContext = createContext<AgentContextContract | null>(null);

export const AgentProvider = ({ children }: { children: ReactNode }) => {
    // Провайдер — єдине місце, яке знає про Zustand.
    // UI-компоненти знатимуть лише про AgentContext.
    const activeSessionId = useAgentStore((s) => s.activeSessionId);
    const sessions = useAgentStore((s) => s.sessions);
    const isAgentTyping = useAgentStore((s) => s.isAgentTyping);
    const settings = useAgentStore((s) => s.settings);
    const isSettingsOpen = useAgentStore((s) => s.isSettingsOpen);
    const isPromptCopied = useAgentStore((s) => s.isPromptCopied);
    const toggleSettings = useAgentStore((s) => s.toggleSettings);

    const value: AgentContextContract = {
        state: {
            activeSessionId,
            sessions,
            isAgentTyping,
            settings,
            isSettingsOpen,
            isPromptCopied
        },
        actions: {
            toggleSettings
        }
    };

    return (
        <AgentContext value={value}>
            {children}
        </AgentContext>
    );
};