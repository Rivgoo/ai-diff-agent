import { useState } from 'react';
import type { ConflictDetails } from '@/shared/models';
import { IconCopy, IconCheck, IconCode, IconAlertTriangle, IconHelpCircle } from '@tabler/icons-react';
import styles from './ConflictDetailsPanel.module.css';

interface ConflictDetailsPanelProps {
    readonly conflict: ConflictDetails;
}

export const ConflictDetailsPanel = ({ conflict }: ConflictDetailsPanelProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevents focusing the parent card element on click
        try {
            await navigator.clipboard.writeText(conflict.originalSearchBlock);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy conflict search block:', err);
        }
    };

    const getHumanReadableReason = () => {
        switch (conflict.reason) {
            case 'NOT_FOUND':
                return `The search pattern was not found in the target file (Block ${conflict.blockIndex} of ${conflict.totalBlocks}). This usually indicates the original code has been modified.`;
            case 'AMBIGUOUS_MATCH':
                return `Multiple matching blocks were found (${conflict.matchesFound ?? 2} matches) for search block ${conflict.blockIndex}. Extend the surrounding code context to make the search query unique.`;
            case 'PATH_TRAVERSAL':
                return `Path validation failure. The operation path attempts to traverse outside the validated sandbox boundary of the active workspace folder.`;
            case 'FILE_NOT_FOUND':
                return `The target workspace file does not exist on disk. Check if it was renamed, deleted, or moved manually.`;
            default:
                return `An unexpected matching mismatch was encountered during the atomic verification check.`;
        }
    };

    const getResolutionStep = () => {
        switch (conflict.reason) {
            case 'NOT_FOUND':
                return 'Verify if the file content changed or copy the correct updated code snippet directly from the active editor.';
            case 'AMBIGUOUS_MATCH':
                return 'Add 2-3 lines of preceding or succeeding code inside the search block to distinguish this exact block.';
            case 'PATH_TRAVERSAL':
                return 'Ensure target file paths resolve strictly inside the active project workspace root directory.';
            case 'FILE_NOT_FOUND':
                return 'Verify that the target file exists or use a <create_file> block if you intended to scaffold a new module.';
            default:
                return 'Re-generate the change payload or review the output logs for diagnostic warnings.';
        }
    };

    return (
        <div className={styles.container} role="alert" aria-live="assertive">
            <div className={styles.header}>
                <IconAlertTriangle size={14} className={styles.errorIcon} aria-hidden="true" />
                <span className={styles.reasonTitle}>Matching Failure (Block {conflict.blockIndex}/{conflict.totalBlocks})</span>
            </div>
            
            <p className={styles.description}>{getHumanReadableReason()}</p>

            <div className={styles.resolutionBox}>
                <IconHelpCircle size={13} className={styles.helpIcon} aria-hidden="true" />
                <span className={styles.resolutionText}><strong>How to resolve:</strong> {getResolutionStep()}</span>
            </div>

            {conflict.searchExcerpt && (
                <div className={styles.codeSnippetContainer}>
                    <div className={styles.snippetHeader}>
                        <span className={styles.snippetLabel}><IconCode size={10} aria-hidden="true" /> Expected search pattern:</span>
                        <button 
                            type="button" 
                            className={styles.copyBtn} 
                            onClick={handleCopy}
                            aria-label="Copy exact search query to clipboard"
                        >
                            {copied ? (
                                <><IconCheck size={11} className={styles.successIcon} aria-hidden="true" /> Copied</>
                            ) : (
                                <><IconCopy size={11} aria-hidden="true" /> Copy block</>
                            )}
                        </button>
                    </div>
                    <pre className={styles.pre}><code>{conflict.searchExcerpt}</code></pre>
                </div>
            )}
        </div>
    );
};
