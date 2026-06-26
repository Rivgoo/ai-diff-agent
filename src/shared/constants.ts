/**
 * Centralized system constants to avoid magic strings across the application.
 */
export const SYSTEM_CONSTANTS = {
    BACKUP_FOLDER_NAME: '.vscode/.ai-backups',
    TRASH_FOLDER_NAME: '.vscode/.ai-diff-trash',
    STORAGE_KEY_CHAT_SESSION: 'ai-diff-agent.chatSession',
    STORAGE_KEY_TRANSACTIONS: 'ai-diff-agent.transactions',
    CONFIG_SECTION: 'aiDiffAgent'
} as const;
