export interface OperationDescriptor {
    readonly prefix: string;
    readonly label: string;
    readonly description: string;
    readonly themeColorVar: string;
}

export const OPERATION_DESCRIPTORS: Record<string, OperationDescriptor> = {
    create_file: {
        prefix: '[A]',
        label: 'Add',
        description: 'Create a new file',
        themeColorVar: 'var(--vscode-gitDecoration-addedResourceForeground)'
    },
    update_file: {
        prefix: '[M]',
        label: 'Modify',
        description: 'Edit an existing file',
        themeColorVar: 'var(--vscode-gitDecoration-modifiedResourceForeground)'
    },
    delete_path: {
        prefix: '[D]',
        label: 'Delete',
        description: 'Remove file or folder',
        themeColorVar: 'var(--vscode-gitDecoration-deletedResourceForeground)'
    },
    move_path: {
        prefix: '[R]',
        label: 'Rename',
        description: 'Move or rename file or folder',
        themeColorVar: 'var(--vscode-textLink-foreground)'
    },
    create_dir: {
        prefix: '[+]',
        label: 'Folder',
        description: 'Create a new folder',
        themeColorVar: 'var(--vscode-descriptionForeground)'
    }
} as const;
