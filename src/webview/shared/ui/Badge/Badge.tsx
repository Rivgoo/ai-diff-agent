import type { ReactNode } from 'react';
import styles from './Badge.module.css';

interface BadgeProps {
    children: ReactNode;
    backgroundColor?: string;
    color?: string;
}

export const Badge = ({ children, backgroundColor = 'var(--vscode-badge-background)', color = 'var(--vscode-badge-foreground)' }: BadgeProps) => {
    return (
        <span className={styles.badge} style={{ backgroundColor, color }}>
            {children}
        </span>
    );
};
