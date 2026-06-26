import { type ReactNode, use } from 'react';
import { UserMessageContext } from './UserMessageContext';
import styles from './UserMessage.module.css';

interface UserMessageFrameProps {
    readonly children: ReactNode;
}

export function UserMessageFrame({ children }: UserMessageFrameProps) {
    const context = use(UserMessageContext);
    if (!context) {
        throw new Error('UserMessageFrame must be rendered within a UserMessageProvider');
    }

    return (
        <div className={styles.frame} role="region" aria-label="User request metrics and payload view">
            {children}
        </div>
    );
}
