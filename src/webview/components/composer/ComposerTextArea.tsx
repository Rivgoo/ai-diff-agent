import React, { forwardRef } from 'react';

interface ComposerTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
}

export const ComposerTextArea = forwardRef<HTMLTextAreaElement, ComposerTextAreaProps>(({ style, ...props }, ref) => {
    const defaultStyle: React.CSSProperties = {
        width: '100%',
        minHeight: '40px',
        maxHeight: '300px',
        padding: '10px 12px',
        backgroundColor: 'transparent',
        color: 'var(--vscode-input-foreground)',
        fontFamily: 'var(--vscode-editor-font-family)',
        fontSize: '13px',
        lineHeight: '1.5',
        border: 'none',
        outline: 'none',
        resize: 'none',
        boxSizing: 'border-box',
        overflowY: 'auto'
    };

    return (
        <textarea
            ref={ref}
            style={{ ...defaultStyle, ...style }}
            spellCheck={false}
            {...props}
        />
    );
});

ComposerTextArea.displayName = 'ComposerTextArea';
