import { useState, type ReactNode } from 'react';
import type { ChatMessage } from '@/shared/models';
import { UserMessageContext } from './UserMessageContext';
import { UserMessageFrame } from './UserMessageFrame';
import { UserMessageHeader } from './UserMessageHeader';
import { UserMessageStatsBar } from './UserMessageStatsBar';
import { UserCodeAccordion } from './UserCodeAccordion';

interface UserMessageProviderProps {
    readonly message: ChatMessage;
    readonly children: ReactNode;
    readonly onRetry: (payload: string) => void;
}

export function UserMessageProvider({ message, children, onRetry }: UserMessageProviderProps) {
    const [isCollapsed, setIsCollapsed] = useState(true);

    const toggleCollapse = () => {
        setIsCollapsed((prev) => !prev);
    };

    const copyPayload = () => {
        if (message.payloadSummary) {
            navigator.clipboard.writeText(message.payloadSummary.rawInput).catch((err) => {
                console.error('Failed to copy to clipboard', err);
            });
        }
    };

    const retryPayload = () => {
        if (message.payloadSummary) {
            onRetry(message.payloadSummary.rawInput);
        }
    };

    const contextValue = {
        state: { message, isCollapsed },
        actions: { toggleCollapse, copyPayload, retryPayload }
    };

    return (
        <UserMessageContext.Provider value={contextValue}>
            {children}
        </UserMessageContext.Provider>
    );
}

export const UserMessage = {
    Provider: UserMessageProvider,
    Frame: UserMessageFrame,
    Header: UserMessageHeader,
    StatsBar: UserMessageStatsBar,
    CodeAccordion: UserCodeAccordion
};
