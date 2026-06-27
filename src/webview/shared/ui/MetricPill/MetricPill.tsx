import type { ElementType } from 'react';
import styles from './MetricPill.module.css';

interface MetricPillProps {
    readonly icon: ElementType;
    readonly count: number;
    readonly label: string;
    readonly intent?: 'add' | 'modify' | 'delete' | 'neutral';
}

export const MetricPill = ({ icon: Icon, count, label, intent = 'neutral' }: MetricPillProps) => {
    return (
        <div className={`${styles.pill} ${styles[intent]}`} title={`${count} ${label}`}>
            <span className={styles.icon} aria-hidden="true">
                <Icon size={12} stroke={2.5} />
            </span>
            <span className={styles.count}>{count}</span>
            <span className={styles.label}>{label}</span>
        </div>
    );
};
