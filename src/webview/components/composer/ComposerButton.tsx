import React, { useState } from 'react';

interface ComposerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    appearance?: 'primary' | 'icon' | 'danger';
    children: React.ReactNode;
}

export const ComposerButton = ({ appearance = 'icon', children, disabled, style, ...props }: ComposerButtonProps) => {
    const [isHovered, setIsHovered] = useState(false);

    const baseStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        border: 'none',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--vscode-font-family)',
        fontSize: '11px',
        fontWeight: 600,
        padding: appearance === 'icon' ? '4px' : '4px 10px',
        height: '24px',
        transition: 'background-color 0.15s ease, opacity 0.15s ease',
        opacity: disabled ? 0.5 : 1,
        ...style
    };

    let appearanceStyle: React.CSSProperties = {};
    if (appearance === 'primary') {
        appearanceStyle = {
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
        };
        if (isHovered && !disabled) appearanceStyle.backgroundColor = 'var(--vscode-button-hoverBackground)';
    } else if (appearance === 'danger') {
        appearanceStyle = {
            backgroundColor: isHovered && !disabled ? 'var(--vscode-errorForeground)' : 'var(--vscode-button-secondaryBackground)',
            color: isHovered && !disabled ? '#FFFFFF' : 'var(--vscode-button-secondaryForeground)',
        };
    } else {
        // Icon appearance
        appearanceStyle = {
            backgroundColor: isHovered && !disabled ? 'var(--vscode-toolbar-hoverBackground)' : 'transparent',
            color: 'var(--vscode-icon-foreground)',
        };
    }

    return (
        <button
            style={{ ...baseStyle, ...appearanceStyle }}
            disabled={disabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            {...props}
        >
            {children}
        </button>
    );
};
