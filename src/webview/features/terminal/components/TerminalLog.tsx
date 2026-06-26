import type { ChatMessage } from '@/shared/models';
import { CommandHeader } from './CommandHeader';
import { StdOutAccordion } from './StdOutAccordion';
import { OperationList } from '../../operations/components/OperationList';
import styles from '../styles/terminal.module.css';

interface TerminalLogProps {
    readonly message: ChatMessage;
    readonly onOpenFile: (opId: string) => void;
}

export const TerminalLog = ({ message, onOpenFile }: TerminalLogProps) => {
    const isSystem = message.role === 'system';
    const isUser = message.role === 'user';

    return (
        <div className={styles.terminalContainer}>
            {isUser && message.payloadSummary && (
                <>
                    <CommandHeader summary={message.payloadSummary} />
                    <StdOutAccordion summary={message.payloadSummary} />
                </>
            )}

            {!isUser && (
                <div className={`${styles.stdoutLine} ${isSystem ? styles.stderrLine : ''}`}>
                    {message.text}
                </div>
            )}

            {message.errorDetails && (
                <div className={`${styles.stdoutLine} ${styles.stderrLine}`} style={{ marginTop: '4px' }}>
                    [STDERR] {message.errorDetails}
                </div>
            )}

            {message.operations && message.operations.length > 0 && (
                <OperationList operations={message.operations} onOpenFile={onOpenFile} />
            )}
        </div>
    );
};
