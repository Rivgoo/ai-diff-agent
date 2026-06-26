import { useState } from 'react';
import type { ConflictDetails } from '../../../shared/contracts';
import { IconCopy, IconCheck, IconCode, IconAlertTriangle, IconHelpCircle, IconFile } from '@tabler/icons-react';
import styles from './ConflictDetailsPanel.module.css';

interface ConflictDetailsPanelProps {
    readonly conflict: ConflictDetails;
}

export const ConflictDetailsPanel = ({ conflict }: ConflictDetailsPanelProps) => {
    const [copied, setCopied] = useState(false);
    const [copiedCandidateIndex, setCopiedCandidateIndex] = useState<number | null>(null);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(conflict.originalSearchBlock);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy search blocks:', err);
        }
    };

    const handleCopyCandidate = async (e: React.MouseEvent, index: number, path: string) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(path);
            setCopiedCandidateIndex(index);
            setTimeout(() => setCopiedCandidateIndex(null), 2000);
        } catch (err) {
            console.error('Failed to copy file path:', err);
        }
    };

    const getHumanReadableReason = () => {
        switch (conflict.reason) {
            case 'NOT_FOUND':
                return `The target search pattern was not found inside the active file buffer (Block ${conflict.blockIndex} of ${conflict.totalBlocks}). The code might have been edited.`;
            case 'AMBIGUOUS_MATCH':
                if (conflict.candidatePaths && conflict.candidatePaths.length > 0) {
                    return `Ambiguity conflict: ${conflict.candidatePaths.length} identical file candidates were discovered in other directories of this project. Explicitly define the target directory.`;
                }
                return `Multiple code occurrences (${conflict.matchesFound ?? 2} matches) match the search pattern inside block ${conflict.blockIndex}. Extend the target context blocks.`;
            case 'PATH_TRAVERSAL':
                return `Path validation failure. The operation path violates sandbox constraints, pointing outside the active project directory workspace root.`;
            case 'FILE_NOT_FOUND':
                return `The target file cannot be located on disk. Check if the asset was moved, renamed, or deleted.`;
            default:
                return `An unexpected matching error was encountered during transactional pre-flight checks.`;
        }
    };

    const getResolutionStep = () => {
        switch (conflict.reason) {
            case 'NOT_FOUND':
                return 'Double-check file contents or copy the updated target block directly from your active editor tabs.';
            case 'AMBIGUOUS_MATCH':
                if (conflict.candidatePaths && conflict.candidatePaths.length > 0) {
                    return 'Copy the correct path from the list of alternatives below and paste it directly into your prompt.';
                }
                return 'Provide 2-3 additional surrounding lines of context inside your search tag block to enforce uniqueness.';
            case 'PATH_TRAVERSAL':
                return 'Ensure target paths resolve strictly within your active workspace folder boundaries.';
            case 'FILE_NOT_FOUND':
                return 'Verify that the target file exists or use a <create_file> block to scaffold a brand-new module.';
            default:
                return 'Review output logs for verbose diagnostics or re-generate the payload.';
        }
    };

    return (
        <div className={styles.container} role="alert" aria-live="assertive">
            <div className={styles.header}>
                <IconAlertTriangle size={14} className={styles.errorIcon} aria-hidden="true" />
                <span className={styles.reasonTitle}>
                    {conflict.reason === 'AMBIGUOUS_MATCH' && conflict.candidatePaths ? 'Ambiguous File Conflict' : `Pre-flight Match Mismatch (Block ${conflict.blockIndex}/${conflict.totalBlocks})`}
                </span>
            </div>
            
            <p className={styles.description}>{getHumanReadableReason()}</p>

            <div className={styles.resolutionBox}>
                <IconHelpCircle size={13} className={styles.helpIcon} aria-hidden="true" />
                <span className={styles.resolutionText}><strong>How to resolve:</strong> {getResolutionStep()}</span>
            </div>

            {/* Render Candidates List specifically for Ambiguous Path Resolution conflicts */}
            {conflict.reason === 'AMBIGUOUS_MATCH' && conflict.candidatePaths && conflict.candidatePaths.length > 0 && (
                <div className={styles.candidatesContainer}>
                    <div className={styles.candidatesTitle}>
                        Project Candidates found ({conflict.candidatePaths.length}):
                    </div>
                    <div className={styles.candidatesList}>
                        {conflict.candidatePaths.map((candPath, idx) => (
                            <div key={idx} className={styles.candidateRow}>
                                <div className={styles.candidatePathBox}>
                                    <IconFile size={12} className={styles.candidateDocIcon} />
                                    <span className={styles.candidateText} title={candPath}>{candPath}</span>
                                </div>
                                <button
                                    type="button"
                                    className={styles.copyCandBtn}
                                    onClick={(e) => handleCopyCandidate(e, idx, candPath)}
                                    title="Copy actual path to clipboard"
                                >
                                    {copiedCandidateIndex === idx ? (
                                        <IconCheck size={11} className={styles.successIcon} />
                                    ) : (
                                        <IconCopy size={11} />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {conflict.searchExcerpt && (
                <div className={styles.codeSnippetContainer}>
                    <div className={styles.snippetHeader}>
                        <span className={styles.snippetLabel}><IconCode size={10} aria-hidden="true" /> Expected search pattern:</span>
                        <button 
                            type="button" 
                            className={styles.copyBtn} 
                            onClick={handleCopy}
                            aria-label="Copy search query to clipboard"
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
