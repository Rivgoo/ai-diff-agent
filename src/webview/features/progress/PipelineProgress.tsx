import { useAgentStore } from '@/webview/store/agentStore';
import type { PipelineStage } from '@/shared/ipc';
import styles from './PipelineProgress.module.css';

const STAGE_LABELS: Record<PipelineStage, string> = {
    idle: '',
    parsing: 'Parsing payload...',
    validating: 'Validating limits...',
    resolving: 'Normalizing paths...',
    applying: 'Applying transaction...',
    error: 'Processing failed'
};

export const PipelineProgress = () => {
    const { stage } = useAgentStore((state) => state.pipelineProgress);
    if (stage === 'idle') return null;

    return (
        <div className={`${styles.bar} ${stage === 'error' ? styles.error : ''}`} role="status">
            {stage !== 'error' && <span className={styles.spinner} aria-hidden="true" />}
            <span>{STAGE_LABELS[stage]}</span>
        </div>
    );
};
