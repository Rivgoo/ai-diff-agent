import type { ReactNode } from 'react';
import styles from './composer.module.css';

export const ComposerActionBar = ({ children }: { children: ReactNode }) => {
    return <div className={styles.actionBar}>{children}</div>;
};

export const ComposerLeftGroup = ({ children }: { children: ReactNode }) => {
    return <div className={styles.leftGroup}>{children}</div>;
};

export const ComposerRightGroup = ({ children }: { children: ReactNode }) => {
    return <div className={styles.rightGroup}>{children}</div>;
};
