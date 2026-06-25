import React from 'react';

interface ActionHintsProps {
    isFocused: boolean;
    isProcessing: boolean;
}

export const ActionHints = ({ isFocused, isProcessing }: ActionHintsProps) => {
    if (isProcessing) return null;

    return (
        <div style={{
            display: 'flex',
            gap: '12px',
            fontSize: '10px',
            color: 'var(--vscode-descriptionForeground)',
            opacity: isFocused ? 1 : 0.4,
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none',
            userSelect: 'none'
        }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <kbd style={{ fontFamily: 'var(--vscode-editor-font-family)' }}>↵</kbd> Apply
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <kbd style={{ fontFamily: 'var(--vscode-editor-font-family)' }}>⇧↵</kbd> Newline
            </span>
        </div>
    );
};
