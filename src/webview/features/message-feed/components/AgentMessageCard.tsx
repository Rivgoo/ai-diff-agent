import type { ChatMessage } from '@/shared/models';
import { OperationList } from '../../operations/components/OperationList';
import styles from '../styles/message.module.css';

interface AgentMessageCardProps {
    readonly message: ChatMessage;
    readonly onOpenFile: (opId: string) => void;
}

export const AgentMessageCard = ({ message, onOpenFile }: AgentMessageCardProps) => {
    const isSystem = message.role === 'system';

    return (
        <div className={`${styles.card} ${styles.agentCard}`}>
            {message.text && (
                <div className={`${styles.textContent} ${isSystem ? styles.errorContent : ''}`}>
                    {message.text}
                </div>
            )}

            {message.errorDetails && (
                <div className={styles.errorContent} style={{ marginTop: message.text ? '4px' : '0' }}>
                    {message.errorDetails}
                </div>
            )}

            {message.operations && message.operations.length > 0 && (
                <OperationList operations={message.operations} onOpenFile={onOpenFile} />
            )}
        </div>
    );
};
