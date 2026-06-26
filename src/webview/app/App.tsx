import { useEffect, useRef } from 'react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import { SettingsModal } from '@/webview/features/settings/SettingsModal';
import { PipelineProgress } from '@/webview/features/progress/PipelineProgress';
import { StickyBatchBar } from '@/webview/features/review/StickyBatchBar';
import { MessageBubble } from '@/webview/features/chat/MessageBubble';
import { EmptyState } from '@/webview/features/chat/EmptyState';
import { FeatureComposer } from '@/webview/features/composer/FeatureComposer';
import styles from './App.module.css';

export const App = () => {
    // Initialize IPC bridge once
    useIPC();

    const messages = useAgentStore((state) => state.messages);
    const isTyping = useAgentStore((state) => state.isAgentTyping);
    const settings = useAgentStore((state) => state.settings);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (settings.autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping, settings.autoScroll]);

    return (
        <main className={styles.container}>
            <SettingsModal />
            <PipelineProgress />

            <div ref={scrollRef} className={styles.scrollArea}>
                {messages.length === 0 ? (
                    <EmptyState />
                ) : (
                    messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
                )}
            </div>

            <StickyBatchBar />
            <FeatureComposer />
        </main>
    );
};
