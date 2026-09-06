import { useState, useMemo } from 'react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import { 
    IconHistory, IconArrowBackUp, IconGitBranch, IconAlertTriangle, 
    IconArrowLeft, IconSearch, IconFileCode, IconFileArrowRight, 
    IconChevronRight, IconExternalLink, IconGitCompare
} from '@tabler/icons-react';
import type { TransactionSaga } from '@/core/models/saga';
import styles from './HistoryView.module.css';

interface BatchGroup {
    id: string;
    timestamp: number;
    branchName?: string;
    sagas: TransactionSaga[];
    status: 'saved' | 'reverted' | 'partial' | 'pending';
}

export const HistoryView = () => {
    const { sendEvent } = useIPC();
    const history = useAgentStore((state) => state.history);
    const currentBranch = useAgentStore((state) => state.currentBranch);
    const toggleHistoryWindow = useAgentStore((state) => state.toggleHistoryWindow);

    const [searchQuery, setSearchQuery] = useState('');
    const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

    const groupedBatches = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        
        const filteredHistory = history.filter(saga => {
            if (!query) return true;
            return saga.summary.toLowerCase().includes(query) || 
                   (saga.branchName && saga.branchName.toLowerCase().includes(query));
        });

        const groups: BatchGroup[] = [];
        
        for (const saga of filteredHistory) {
            const lastGroup = groups[groups.length - 1];
            
            if (lastGroup && Math.abs(lastGroup.timestamp - saga.timestamp) < 2000) {
                lastGroup.sagas.push(saga);
            } else {
                groups.push({
                    id: `batch-${saga.timestamp}`,
                    timestamp: saga.timestamp,
                    branchName: saga.branchName,
                    sagas: [saga],
                    status: 'pending'
                });
            }
        }

        for (const group of groups) {
            const allReverted = group.sagas.every(s => s.status === 'reverted');
            const someReverted = group.sagas.some(s => s.status === 'reverted');
            const allSaved = group.sagas.every(s => s.status === 'saved');

            if (allReverted) group.status = 'reverted';
            else if (someReverted) group.status = 'partial';
            else if (allSaved) group.status = 'saved';
            else group.status = 'pending';
        }

        return groups;
    }, [history, searchQuery]);

    const handleRevertBatch = (e: React.MouseEvent, sagas: TransactionSaga[]) => {
        e.stopPropagation();
        const idsToRevert = sagas.filter(s => s.status !== 'reverted').map(s => s.transactionId);
        if (idsToRevert.length > 0) {
            sendEvent({ type: 'ROLLBACK_SAGA', transactionIds: idsToRevert });
        }
    };

    const toggleExpand = (batchId: string) => {
        setExpandedBatches(prev => {
            const next = new Set(prev);
            if (next.has(batchId)) next.delete(batchId);
            else next.add(batchId);
            return next;
        });
    };

    const extractFullPath = (summary: string) => {
        return summary.replace(/^(Modified|Created|Deleted|Moved)\s+/i, '').trim();
    };

    const handleOpenFile = (e: React.MouseEvent, summary: string) => {
        e.stopPropagation();
        sendEvent({ type: 'OPEN_FILE_AT_RANGE', path: extractFullPath(summary) });
    };

    const handleHistoryDiff = (e: React.MouseEvent, saga: TransactionSaga) => {
        e.stopPropagation();
        sendEvent({ type: 'OPEN_HISTORY_DIFF', operationId: saga.transactionId, filePath: extractFullPath(saga.summary) });
    };

    const formatDate = (ts: number) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date(ts));
    };

    const extractFilename = (summary: string) => {
        const parts = extractFullPath(summary).split('/');
        return parts.pop() || summary;
    };

    const getStatusDotClass = (status: string) => {
        if (status === 'saved') return styles.dotSaved;
        if (status === 'reverted') return styles.dotReverted;
        if (status === 'partial') return styles.dotPartial;
        return styles.dotPending;
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleGroup}>
                    <button 
                        type="button" 
                        onClick={() => toggleHistoryWindow(false)} 
                        title="Go back"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--vscode-icon-foreground)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px'
                        }}
                    >
                        <IconArrowLeft size={16} />
                    </button>
                    <h2 className={styles.title}>Transaction History</h2>
                </div>
                {currentBranch && (
                    <div className={styles.branchBadge} title="Current Git Branch">
                        <IconGitBranch size={10} /> {currentBranch}
                    </div>
                )}
            </div>

            <div className={styles.searchContainer}>
                <div className={styles.searchInputWrapper}>
                    <IconSearch size={14} className={styles.searchIcon} />
                    <input 
                        type="text" 
                        className={styles.searchInput} 
                        placeholder="Search files or branches..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        spellCheck={false}
                    />
                </div>
            </div>

            <div className={styles.content}>
                {groupedBatches.length === 0 ? (
                    <div className={styles.emptyState}>
                        <IconHistory size={32} />
                        <p>{searchQuery ? 'No transactions match your search.' : 'No transactions recorded yet.'}</p>
                    </div>
                ) : (
                    groupedBatches.map((batch) => {
                        const isBranchMismatch = batch.branchName && currentBranch && batch.branchName !== currentBranch;
                        const isBatchReverted = batch.status === 'reverted';
                        const isExpanded = expandedBatches.has(batch.id);

                        return (
                            <div key={batch.id} className={styles.historyCard}>
                                <div 
                                    className={`${styles.cardHeader} ${isExpanded ? styles.cardHeaderOpen : ''}`}
                                    onClick={() => toggleExpand(batch.id)}
                                >
                                    <div className={styles.headerLeft}>
                                        <IconChevronRight size={16} className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`} />
                                        <div className={`${styles.statusDot} ${getStatusDotClass(batch.status)}`} title={`Status: ${batch.status}`} />
                                        <div className={styles.timeText}>{formatDate(batch.timestamp)}</div>
                                    </div>

                                    <div className={styles.headerLeft}>
                                        <span className={styles.summaryBadge}>
                                            {batch.sagas.length} file{batch.sagas.length > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                                
                                {isExpanded && (
                                    <>
                                        <div className={styles.fileList}>
                                            {batch.sagas.map(saga => {
                                                const isOpReverted = saga.status === 'reverted';
                                                const fullPath = extractFullPath(saga.summary);
                                                
                                                return (
                                                    <div key={saga.transactionId} className={styles.fileRow} style={{ opacity: isOpReverted ? 0.5 : 1 }}>
                                                        <div className={styles.fileRowLeft} style={{ textDecoration: isOpReverted ? 'line-through' : 'none' }}>
                                                            {saga.summary.includes('Created') ? <IconFileCode size={12} color="var(--vscode-gitDecoration-addedResourceForeground)"/> : 
                                                             saga.summary.includes('Moved') ? <IconFileArrowRight size={12} color="var(--vscode-textLink-foreground)"/> :
                                                             <IconFileCode size={12} color="var(--vscode-gitDecoration-modifiedResourceForeground)"/>}
                                                            <span className={styles.fileName} title={fullPath}>
                                                                {extractFilename(saga.summary)}
                                                            </span>
                                                        </div>

                                                        {/* ФІКС: Залишили тільки Diff та Open */}
                                                        <div className={styles.fileRowActions}>
                                                            {!isOpReverted && (
                                                                <button className={styles.fileActionBtn} onClick={(e) => handleHistoryDiff(e, saga)} title="View Diff (Backup vs Current)">
                                                                    <IconGitCompare size={12} /> Diff
                                                                </button>
                                                            )}
                                                            {!saga.summary.includes('Deleted') && (
                                                                <button className={styles.fileActionBtn} onClick={(e) => handleOpenFile(e, saga.summary)} title="Open file in editor">
                                                                    <IconExternalLink size={12} /> Open
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className={styles.actionRow}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {isBranchMismatch ? (
                                                    <div className={styles.branchMismatch}>
                                                        <IconAlertTriangle size={12} />
                                                        Switch to '{batch.branchName}'
                                                    </div>
                                                ) : (
                                                    <span className={styles.statusLabel} style={{ 
                                                        color: batch.status === 'saved' ? 'var(--vscode-testing-iconPassed)' : 
                                                               batch.status === 'reverted' ? 'var(--vscode-editorError-foreground)' : 
                                                               'var(--vscode-editorWarning-foreground)' 
                                                    }}>
                                                        {batch.status}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <button 
                                                className={styles.revertBtn}
                                                onClick={(e) => handleRevertBatch(e, batch.sagas)}
                                                disabled={!!isBranchMismatch || isBatchReverted}
                                                title={isBranchMismatch ? "Cannot revert across different git branches" : "Restore all files in this transaction to their previous state"}
                                            >
                                                <IconArrowBackUp size={12} />
                                                {isBatchReverted ? 'Batch Reverted' : 'Revert Batch'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};