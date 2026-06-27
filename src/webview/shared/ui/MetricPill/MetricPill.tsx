import type { ElementType } from 'react';
import styles from './MetricPill.module.css';

export type PillVariant = 'standard' | 'micro';
export type PillIntent = 'add' | 'modify' | 'delete' | 'neutral';

export interface MetricPillProps {
    readonly icon: ElementType;
    readonly count: number;
    readonly label: string;
    readonly intent?: PillIntent;
    readonly variant?: PillVariant;
}

export const MetricPill = ({
    icon: Icon,
    count,
    label,
    intent = 'neutral',
    variant = 'standard'
}: MetricPillProps) => {
    const isMicro = variant === 'micro';
    const ariaText = `${count} ${label}`;

    return (
        <div 
            className={`${styles.pill} ${styles[intent]} ${isMicro ? styles.micro : ''}`}
            title={ariaText}
            aria-label={ariaText}
        >
            <span className={styles.icon} aria-hidden="true">
                <Icon size={isMicro ? 11 : 12} stroke={2.5} />
            </span>
            <span className={styles.count}>{count}</span>
            {(!isMicro) && <span className={styles.label}>{label}</span>}
        </div>
    );
};
