import React from 'react';
import { DiffOperation } from '../../../shared/models';
import { useIPC } from '../../hooks/useIPC';
import { 
    IconCheck, 
    IconX, 
    IconArrowsDiff,
    IconPlus,
    IconMinus,
    IconAlertCircle,
    IconFilePlus,
    IconFileText,
    IconFileMinus,
    IconFolderPlus,
    IconExternalLink,
    IconEdit
} from '@tabler/icons-react';

interface DiffReviewCardProps {
    readonly operation: DiffOperation;
}

const TYPE_COLORS: Record<string, string> = {
    create_file: 'var(--vscode-testing-iconPassed)',
    update_file: 'var(--vscode-textLink-foreground)',
    delete_path: 'var(--vscode-testing-iconFailed)',
    move_path: 'var(--vscode-editorWarning-foreground)',
    create_dir: 'var(--vscode-badge-background)'
};

export const DiffReviewCard = ({ operation }: DiffReviewCardProps) => {
    const { sendEvent } = useIPC();

    const typeColor = TYPE_COLORS[operation.type] ?? 'var(--vscode-badge-background)';
    const canInteract = operation.status === 'pending' || operation.status === 'reviewing';
    const isConflict = operation.status === 'conflict';
    const isManualModified = operation.status === 'manual_modified';
    const isApplied = operation.status === 'applied';
    const isRejected = operation.status === 'rejected';

    const pathParts = operation.path.split('/');
    const fileName = pathParts.pop() ?? operation.path;
    const parentPath = pathParts.join('/');

    const renderTypeIcon = () => {
        const size = 15;
        switch (operation.type) {
            case 'create_file': return <IconFilePlus size={size} style={{ color: typeColor }} />;
            case 'delete_path': return <IconFileMinus size={size} style={{ color: typeColor }} />;
            case 'create_dir': return <IconFolderPlus size={size} style={{ color: typeColor }} />;
            case 'move_path': return <IconExternalLink size={size} style={{ color: typeColor }} />;
            default: return <IconFileText size={size} style={{ color: typeColor }} />;
        }
    };

    const renderStatusIcon = () => {
        const size = 14;
        if (isApplied) return <IconCheck size={size} style={{ color: 'var(--vscode-testing-iconPassed)' }} title="Applied Successfully" />;
        if (isRejected) return <IconX size={size} style={{ color: 'var(--vscode-descriptionForeground)' }} title="Rejected" />;
        if (isManualModified) return <IconEdit size={size} style={{ color: 'var(--vscode-editorWarning-foreground)' }} title="Modified Manually" />;
        if (isConflict) return <IconAlertCircle size={size} style={{ color: 'var(--vscode-testing-iconFailed)' }} title="Conflict Detected" />;
        return null;
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        
        if (operation.type === 'update_file') {
            sendEvent({ type: 'OPEN_DIFF', operationId: operation.id });
        }
    };

    return (
        <div 
            onClick={handleCardClick}
            style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '6px 8px',
                backgroundColor: 'var(--vscode-editor-background)',
                border: `1px solid ${isConflict ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-panel-border)'}`,
                borderLeft: `3px solid ${typeColor}`,
                borderRadius: '4px',
                marginBottom: '4px',
                cursor: operation.type === 'update_file' ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease',
                userSelect: 'none'
            }}
            onMouseEnter={(e) => {
                if (operation.type === 'update_file') {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--vscode-editor-background)';
            }}
        >
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto',
                alignItems: 'center',
                gap: '8px',
                width: '100%'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {renderTypeIcon()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{
                            fontFamily: 'var(--vscode-font-family)',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--vscode-foreground)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }} title={operation.path}>
                            {fileName}
                        </span>
                    </div>
                    {parentPath && (
                        <span style={{
                            fontSize: '10px',
                            color: 'var(--vscode-descriptionForeground)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }} title={parentPath}>
                            {parentPath}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontSize: '11px' }}>
                    {operation.stats && (
                        <>
                            {operation.stats.additions > 0 && (
                                <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)', display: 'flex', alignItems: 'center' }}>
                                    <IconPlus size={10} strokeWidth={3} />{operation.stats.additions}
                                </span>
                            )}
                            {operation.stats.deletions > 0 && (
                                <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)', display: 'flex', alignItems: 'center' }}>
                                    <IconMinus size={10} strokeWidth={3} />{operation.stats.deletions}
                                </span>
                            )}
                        </>
                    )}
                    {renderStatusIcon()}
                </div>

                {canInteract && (
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        {operation.type === 'update_file' && operation.status === 'reviewing' && (
                            <button
                                title="Open Diff"
                                onClick={() => sendEvent({ type: 'OPEN_DIFF', operationId: operation.id })}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--vscode-icon-foreground)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '3px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <IconArrowsDiff size={14} />
                            </button>
                        )}
                        <button
                            title="Reject Change"
                            onClick={() => sendEvent({ type: 'ACTION_REJECT', operationId: operation.id })}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--vscode-gitDecoration-deletedResourceForeground)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '3px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <IconX size={14} />
                        </button>
                        <button
                            title="Accept Change"
                            onClick={() => sendEvent({ type: 'ACTION_ACCEPT', operationId: operation.id })}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--vscode-gitDecoration-addedResourceForeground)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '3px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <IconCheck size={14} />
                        </button>
                    </div>
                )}
            </div>

            {isConflict && operation.errorMessage && (
                <div style={{
                    marginTop: '4px',
                    fontSize: '10.5px',
                    color: 'var(--vscode-editorError-foreground)',
                    backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
                    border: '1px solid var(--vscode-inputValidation-errorBorder)',
                    padding: '3px 6px',
                    borderRadius: '3px',
                    fontFamily: 'var(--vscode-editor-font-family)'
                }}>
                    {operation.errorMessage}
                </div>
            )}
        </div>
    );
};
