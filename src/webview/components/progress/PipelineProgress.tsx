import { useAgentStore } from '../../store/agentStore';
import { PipelineStage } from '../../../shared/ipc';

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
        <div style={{
            padding: '6px 12px', borderBottom: '1px solid var(--vscode-panel-border)',
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px',
            color: stage === 'error' ? 'var(--vscode-editorError-foreground)' : 'var(--vscode-descriptionForeground)'
        }}>
            {stage !== 'error' && (
                <span style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    border: '2px solid var(--vscode-textLink-foreground)', borderTopColor: 'transparent',
                    animation: 'spin 0.8s linear infinite'
                }} />
            )}
            <span>{STAGE_LABELS[stage]}</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};
