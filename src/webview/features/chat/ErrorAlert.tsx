import styles from './ErrorAlert.module.css';

export const ErrorAlert = ({ details }: { details: string }) => {
    return (
        <div className={styles.alert} role="alert">
            <div className={styles.title}>Parsing Failed</div>
            <div className={styles.details}>{details}</div>
        </div>
    );
};
