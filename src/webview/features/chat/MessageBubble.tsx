import type { ChatMessage, DiffOperation } from '@/shared/models';
import { ErrorAlert } from './ErrorAlert';
import { DiffReviewCard } from '@/webview/features/review/DiffReviewCard';
import { UserMessage } from './UserMessage/UserMessage';
import { useAgentStore } from '@/webview/store/agentStore';
import { IconAlertTriangle } from '@tabler/icons-react';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
    readonly message: ChatMessage;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const setComposerDraft = useAgentStore((state) => state.setComposerDraft);

    if (isUser) {
        return (
            <UserMessage.Provider message={message} onRetry={setComposerDraft}>
                <UserMessage.Frame>
                    <UserMessage.Header />
                    <UserMessage.StatsBar />
                    <UserMessage.CodeAccordion />
                </UserMessage.Frame>
            </UserMessage.Provider>
        );
    }

    const containerClass = `${styles.wrapper} ${isSystem ? styles.system : styles.agent}`;
    const textClass = `${styles.text} ${isSystem ? styles.textSystem : ''}`;

    return (
        <div className={containerClass}>
            <div className={styles.contentLayout}>
                {isSystem && (
                    <div className={styles.systemIconBox}>
                        <IconAlertTriangle size={15} className={styles.systemIcon} aria-hidden="true" />
                    </div>
                )}
                <div className={textClass}>
                    {message.text}
                </div>
            </div>

            {message.errorDetails && <ErrorAlert details={message.errorDetails} />}

            {message.operations && message.operations.length > 0 && (
                <div className={styles.operationsList}>
                    {(message.operations as DiffOperation[]).map((op) => (
                        <DiffReviewCard key={op.id} operation={op} />
                    ))}
                </div>
            )}
        </div>
    );
};
