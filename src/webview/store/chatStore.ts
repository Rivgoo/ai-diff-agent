import { create } from 'zustand';
import { ChatMessage, ChatSession, AgentSettings } from '../../shared/models';

interface ChatState {
    messages: ChatMessage[];
    isAgentTyping: boolean;
    settings: AgentSettings;
    isSettingsOpen: boolean;
    
    hydrateSession: (session: ChatSession) => void;
    hydrateSettings: (settings: AgentSettings) => void;
    addMessage: (message: ChatMessage) => void;
    setAgentTyping: (isTyping: boolean) => void;
    clearSession: () => void;
    toggleSettings: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    isAgentTyping: false,
    settings: { autoScroll: true, strictParsing: false },
    isSettingsOpen: false,

    hydrateSession: (session: ChatSession) => set({ messages: session.messages }),
    hydrateSettings: (settings: AgentSettings) => set({ settings }),
    
    addMessage: (message: ChatMessage) => set((state) => ({ 
        messages: [...state.messages, message] 
    })),
    
    setAgentTyping: (isTyping: boolean) => set({ isAgentTyping: isTyping }),
    clearSession: () => set({ messages: [] }),
    toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen }))
}));
