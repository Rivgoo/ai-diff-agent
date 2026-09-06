import { useMemo } from 'react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import { IconArrowLeft, IconAlertCircle, IconAlertTriangle, IconInfoCircle, IconCheck } from '@tabler/icons-react';
import type { CoreDiagnostic } from '@/shared/contracts';
import styles from './DiagnosticsView.module.css';

export const DiagnosticsView = () => {
    const { sendEvent } = useIPC();
    const toggleDiagnosticsWindow = useAgentStore((state) => state.toggleDiagnosticsWindow);
    
    const operationsMap = useAgentStore((state) => state.operationsMap);
    const activeSessionId = useAgentStore((state) => state.activeSessionId);
    const session = useAgentStore((state) => state.sessions[activeSessionId]);
    const diagLevel = useAgentStore((state) => state.settings.ui?.diagnosticsLevel || 'all');

    // ФІКС: Збираємо всі діагностики "на льоту" з поточних заблокованих файлів
    const diagnostics = useMemo(() => {
        if (!session || diagLevel === 'none') return [];
        const diags: CoreDiagnostic[] = [];
        
        // Знаходимо останнє повідомлення з операціями
        const latestMsg = [...session.messages].reverse().find(m => m.operations && m.operations.length > 0);
        if (!latestMsg || !latestMsg.operations) return diags;

        for (const opRef of latestMsg.operations) {
            const liveOp = operationsMap[opRef.id] || opRef;
            
            // Якщо файл має статус конфлікту і всередині є збережена діагностика
            if ((liveOp.status === 'conflict' || liveOp.status === 'error') && liveOp.conflict?.diagnostic) {
                const d = liveOp.conflict.diagnostic;
                
                // Враховуємо налаштування користувача (показувати все чи тільки критичні)
                if (diagLevel === 'all' || d.severity === 'critical') {
                    diags.push(d);
                }
            }
        }
        return diags;
    }, [session, operationsMap, diagLevel]);

    const getIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <IconAlertCircle size={16} color="var(--vscode-editorError-foreground)" />;
            case 'warning': return <IconAlertTriangle size={16} color="var(--vscode-editorWarning-foreground)" />;
            default: return <IconInfoCircle size={16} color="var(--vscode-editorInfo-foreground)" />;
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleGroup}>
                    <button type="button" className={styles.backBtn} onClick={() => toggleDiagnosticsWindow(false)} aria-label="Go back">
                        <IconArrowLeft size={16} />
                    </button>
                    <h2 className={styles.title}>Diagnostics Center</h2>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
                    {diagnostics.length} Issues
                </div>
            </div>

            <div className={styles.content}>
                {diagnostics.length === 0 ? (
                    <div className={styles.emptyState}>
                        <IconCheck size={32} color="var(--vscode-testing-iconPassed)" />
                        <p>No diagnostics reported for this transaction.</p>
                    </div>
                ) : (
                    diagnostics.map((diag, idx) => (
                        <div 
                            key={`${diag.operationId}-${idx}`} 
                            className={styles.diagCard}
                            onClick={() => sendEvent({ type: 'OPEN_FILE_AT_RANGE', path: diag.path, range: diag.range })}
                            title="Click to view in editor"
                        >
                            <div className={styles.cardHeader}>
                                {getIcon(diag.severity)}
                                <span className={styles.titleText}>{diag.title}</span>
                            </div>
                            <div className={styles.pathText}>{diag.path}</div>
                            <div className={styles.messageText}>{diag.detailedMessage}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};