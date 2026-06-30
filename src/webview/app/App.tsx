import { useEffect, useRef, use } from 'react';
import { useIPC } from '@/webview/hooks/useIPC';
import { AgentContext } from '@/webview/store/AgentProvider';

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
    const context = use(AgentContext);
    
    if (!context) throw new Error('App must be wrapped in AgentProvider');
    const { state } = context;

    const messages = state.sessions[state.activeSessionId]?.messages || [];
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (state.settings.behavior.autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, state.isAgentTyping, state.settings.behavior.autoScroll]);

    const handleOpenFile = (opId: string) => {
        sendEvent({ type: 'OPEN_FILE', operationId: opId });
    };

    return (
        <main className={styles.container}>
            {state.isSettingsOpen ? (
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