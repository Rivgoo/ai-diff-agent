import { useEffect, useRef } from 'react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import { SettingsModal } from '@/webview/features/settings/SettingsModal';
import { TerminalLog } from '@/webview/features/terminal/components/TerminalLog';
import { EmptyState } from '@/webview/features/chat/EmptyState';
import { StatusBarMinimal } from '@/webview/features/status-bar/StatusBarMinimal';
import { FeatureComposer } from '@/webview/features/composer/FeatureComposer';
import { SessionTabs } from '@/webview/features/sessions/SessionTabs';
import styles from './App.module.css';

export const App = () => {
    const { sendEvent } = useIPC();

    // БЕЗПЕЧНЕ ОТРИМАННЯ ПОВІДОМЛЕНЬ
    const activeSessionId = useAgentStore((state) => state.activeSessionId);
    const messages = useAgentStore((state) => state.sessions[activeSessionId]?.messages) || [];
    
    const isTyping = useAgentStore((state) => state.isAgentTyping);
    const settings = useAgentStore((state) => state.settings);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (settings.autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping, settings.autoScroll]);

    const handleOpenFile = (opId: string) => {
        sendEvent({ type: 'OPEN_FILE', operationId: opId });
    };

    return (
        <main className={styles.container}>
            <SettingsModal />
            
            <SessionTabs />

            <div ref={scrollRef} className={styles.scrollArea}>
                {messages.length === 0 ? (
                    <EmptyState />
                ) : (
                    messages.map((msg) => (
                        <TerminalLog 
                            key={msg.id} 
                            message={msg} 
                            onOpenFile={handleOpenFile} 
                        />
                    ))
                )}
            </div>

            <StatusBarMinimal />
            <FeatureComposer />
        </main>
    );
};