import { OPERATION_DESCRIPTORS } from '@/webview/features/operations/constants/descriptors';
import styles from '../styles/OperationLegend.module.css';

export const OperationLegend = () => {
    const descriptors = Object.entries(OPERATION_DESCRIPTORS);

    return (
        <section className={styles.legendContainer} aria-labelledby="op-legend-title">
            <h2 id="op-legend-title" className={styles.legendTitle}>
                Available Commands
            </h2>
            
            <ul className={styles.list} role="list">
                {descriptors.map(([key, desc]) => (
                    <li key={key} className={styles.item}>
                        <span 
                            className={styles.prefix} 
                            style={{ color: desc.themeColorVar }}
                            aria-hidden="true"
                        >
                            {desc.prefix}
                        </span>
                        <div className={styles.details}>
                            <span className={styles.label}>{desc.label}</span>
                            <span className={styles.description}>{desc.description}</span>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
};
