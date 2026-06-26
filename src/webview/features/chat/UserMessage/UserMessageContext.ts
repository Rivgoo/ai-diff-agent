import { createContext } from 'react';
import type { ChatMessage } from '@/shared/models';

export interface UserMessageState {
    readonly message: ChatMessage;
    readonly isCollapsed: boolean;
}

export interface UserMessageActions {
    readonly toggleCollapse: () => void;
    readonly copyPayload: () => void;
    readonly retryPayload: () => void;
}

export interface UserMessageContextValue {
    readonly state: UserMessageState;
    readonly actions: UserMessageActions;
}

export const UserMessageContext = createContext<UserMessageContextValue | null>(null);
