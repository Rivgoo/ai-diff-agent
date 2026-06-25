import { ChatMessage, DiffOperation } from '../../../shared/models';
import { ErrorAlert } from '../review/ErrorAlert';
import { DiffReviewCard } from '../review/DiffReviewCard';
import { BatchSummaryBar } from '../review/BatchSummaryBar';

interface MessageBubbleProps {
    message: ChatMessage;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    const containerStyle: React.CSSProperties = isUser
        ? {
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--vscode-button-secondaryBackground)',
            border: '1px solid var(--vscode-panel-border)',
            alignSelf: 'flex-end',
            maxWidth: '90%'
          }
        : isSystem
        ? {
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
            border: '1px solid var(--vscode-inputValidation-errorBorder)'
          }
        : {
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: 'var(--vscode-editor-background)',
            border: '1px solid var(--vscode-panel-border)'
          };

    const roleLabel = isUser ? null : (isSystem ? null : 'AI Agent');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...containerStyle }}>
            {roleLabel && (
                <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {roleLabel}
                </div>
            )}

            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: isSystem ? 'var(--vscode-editorError-foreground)' : 'var(--vscode-foreground)', lineHeight: '1.4', fontSize: '13px' }}>
                {message.text}
            </div>

            {message.errorDetails && <ErrorAlert details={message.errorDetails} />}

            {message.operations && message.operations.length > 0 && (
                <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <BatchSummaryBar operations={message.operations as DiffOperation[]} />
                    {(message.operations as DiffOperation[]).map((op) => (
                        <DiffReviewCard key={op.id} operation={op} />
                    ))}
                </div>
            )}
        </div>
    );
};
