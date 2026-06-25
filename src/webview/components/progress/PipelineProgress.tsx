import { useAgentStore } from '../../store/agentStore';
import { PipelineStage } from '../../../shared/ipc';

const STAGE_LABELS: Record<PipelineStage, string> = {
    idle: '',
    parsing: 'Parsing payload...',
    validating: 'Validating operations...',
    resolving: 'Resolving file paths...',
    staging: 'Staging changes to editor...',
    reviewing: 'Ready for review',
    error: 'Processing failed'
};

export const PipelineProgress = () => {
    const { stage, current, total } = useAgentStore((state) => state.pipelineProgress);

    if (stage === 'idle' || stage === 'reviewing') return null;

    const label = STAGE_LABELS[stage];
    const isError = stage === 'error';
    const showCount = total > 0 && (stage === 'staging' || stage === 'validating');

    const progressPct = showCount ? Math.round((current / total) * 100) : undefined;

    return (
        <div style={{
            padding: '6px 12px',
            borderBottom: '1px solid var(--vscode-panel-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            color: isError ? 'var(--vscode-editorError-foreground)' : 'var(--vscode-descriptionForeground)',
            backgroundColor: 'var(--vscode-editor-background)'
        }}>
            {!isError && (
                <span style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    border: '2px solid var(--vscode-textLink-foreground)',
                    borderTopColor: 'transparent',
                    animation: 'spin 0.8s linear infinite'
                }} />
            )}
            <span>{label}{showCount && progressPct !== undefined ? ` (${current}/${total})` : ''}</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};
