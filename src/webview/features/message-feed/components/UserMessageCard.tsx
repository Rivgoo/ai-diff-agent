import type { ChatMessage } from '@/shared/models';
import { MessageMetricsGrid } from './MessageMetricsGrid';
import { PayloadAccordion } from './PayloadAccordion';
import { OperationList } from '../../operations/components/OperationList';
import styles from '../styles/message.module.css';

interface UserMessageCardProps {
    readonly message: ChatMessage;
    readonly onOpenFile: (opId: string) => void;
}

export const UserMessageCard = ({ message, onOpenFile }: UserMessageCardProps) => {
    return (
        <div className={`${styles.card} ${styles.userCard}`}>
            {message.payloadSummary && (
                <div className={styles.summaryContainer}>
                    <MessageMetricsGrid summary={message.payloadSummary} />
                    <PayloadAccordion rawInput={message.payloadSummary.rawInput} />
                </div>
            )}
            
            {message.text && !message.payloadSummary && (
                <div className={styles.textContent}>{message.text}</div>
            )}

            {message.operations && message.operations.length > 0 && (
                <OperationList operations={message.operations} onOpenFile={onOpenFile} />
            )}
        </div>
    );
};
