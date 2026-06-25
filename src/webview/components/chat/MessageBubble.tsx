import React from 'react';
import { ChatMessage, DiffOperation } from '../../../shared/models';
import { ErrorAlert } from '../review/ErrorAlert';
import { DiffReviewCard } from '../review/DiffReviewCard';

interface MessageBubbleProps {
    readonly message: ChatMessage;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    const containerStyle: React.CSSProperties = isUser
        ? {
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--vscode-button-secondaryBackground)',
            border: '1px solid var(--vscode-panel-border)',
            alignSelf: 'flex-end',
            maxWidth: '90%'
          }
        : isSystem
        ? {
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
            border: '1px solid var(--vscode-inputValidation-errorBorder)'
          }
        : {
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--vscode-editor-background)',
            border: '1px solid var(--vscode-panel-border)'
          };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...containerStyle }}>
            <div style={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word', 
                color: isSystem ? 'var(--vscode-editorError-foreground)' : 'var(--vscode-foreground)', 
                lineHeight: '1.35', 
                fontSize: '12.5px' 
            }}>
                {message.text}
            </div>

            {message.errorDetails && <ErrorAlert details={message.errorDetails} />}

            {message.operations && message.operations.length > 0 && (
                <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {(message.operations as DiffOperation[]).map((op) => (
                        <DiffReviewCard key={op.id} operation={op} />
                    ))}
                </div>
            )}
        </div>
    );
};
