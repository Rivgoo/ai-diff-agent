import { ChatMessage, DiffOperation } from '../../../shared/models';
import { ErrorAlert } from '../review/ErrorAlert';
import { DiffReviewCard } from '../review/DiffReviewCard';

interface MessageBubbleProps {
    message: ChatMessage;
}

export const MessageBubble = (props: MessageBubbleProps) => {
    const { message } = props;
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    let backgroundColor = 'var(--vscode-editor-background)';
    if (isUser) backgroundColor = 'var(--vscode-button-secondaryBackground)';
    if (isSystem) backgroundColor = 'transparent';

    return (
        <div style={{ 
            padding: '10px 14px', 
            borderRadius: '6px', 
            backgroundColor,
            border: isSystem ? 'none' : '1px solid var(--vscode-panel-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
        }}>
            <div style={{ fontWeight: 'bold', color: isSystem ? 'var(--vscode-errorForeground)' : 'var(--vscode-foreground)' }}>
                {isUser ? 'You' : (isSystem ? 'System Error' : 'AI Agent')}
            </div>
            
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--vscode-foreground)', lineHeight: '1.4' }}>
                {message.text}
            </div>

            {message.errorDetails && <ErrorAlert details={message.errorDetails} />}

            {message.operations && message.operations.length > 0 && (
                <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {message.operations.map((op: DiffOperation) => (
                        <DiffReviewCard key={op.id} operation={op} />
                    ))}
                </div>
            )}
        </div>
    );
};
