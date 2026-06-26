import type { ReactNode } from 'react';
import styles from './composer.module.css';

export const ComposerFrame = ({ children }: { children: ReactNode }) => {
    return <form className={styles.frame}>{children}</form>;
};
