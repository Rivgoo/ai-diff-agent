import { useEffect, useRef } from 'react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';

import { UserMessageCard } from '@/webview/features/message-feed/components/UserMessageCard';
import { AgentMessageCard } from '@/webview/features/message-feed/components/AgentMessageCard';
import { EmptyState } from '@/webview/features/chat/EmptyState';
import { StatusBarMinimal } from '@/webview/features/status-bar/StatusBarMinimal';
import { FeatureComposer } from '@/webview/features/composer/FeatureComposer';
import { SessionTabs } from '@/webview/features/sessions/SessionTabs';
import { SettingsView } from '@/webview/features/settings/SettingsView';
import styles from './App.module.css';

export const App = () => {
    const { sendEvent } = useIPC();

    const activeSessionId = useAgentStore((state) => state.activeSessionId);
    const messages = useAgentStore((state) => state.sessions[activeSessionId]?.messages) || [];
    
    const isTyping = useAgentStore((state) => state.isAgentTyping);
    const settings = useAgentStore((state) => state.settings);
    const isSettingsOpen = useAgentStore((state) => state.isSettingsOpen);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (settings.behavior.autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping, settings.behavior.autoScroll]);

    const handleOpenFile = (opId: string) => {
        sendEvent({ type: 'OPEN_FILE', operationId: opId });
    };

    return (
        <main className={styles.container}>
            {isSettingsOpen ? (
                <SettingsView />
            ) : (
                <>
                    <SessionTabs />
                    <div ref={scrollRef} className={styles.scrollArea}>
                        {messages.length === 0 ? (
                            <EmptyState />
                        ) : (
                            messages.map((msg) => (
                                msg.role === 'user' ? (
                                    <UserMessageCard 
                                        key={msg.id} 
                                        message={msg} 
                                        onOpenFile={handleOpenFile} 
                                    />
                                ) : (
                                    <AgentMessageCard 
                                        key={msg.id} 
                                        message={msg} 
                                        onOpenFile={handleOpenFile} 
                                    />
                                )
                            ))
                        )}
                    </div>
                    <StatusBarMinimal />
                    <FeatureComposer />
                </>
            )}
        </main>
    );
};
