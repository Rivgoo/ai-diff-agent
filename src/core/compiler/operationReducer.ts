import { VirtualWorkspace } from './virtualWorkspace';
import type { CreateFileOperation, DeletePathOperation, UpdateFileOperation, MovePathOperation } from '../models/operations';
import type { CompilerWarning } from './models';
import { SearchEngine } from '../matcher/searchEngine';
import { VirtualDocument } from './virtualDocument';

export class OperationReducer {
    constructor(
        private readonly workspace: VirtualWorkspace,
        private readonly warnings: CompilerWarning[]
    ) {}

    public applyCreate(op: CreateFileOperation): void {
        const node = this.workspace.getNode(op.path);

        if (node.state === 'DELETED') {
            this.warn(op.id, op.path, 'Create after Delete collision absorbed. Converted to direct overwrite.');
        } else if (node.state === 'CREATED') {
            this.warn(op.id, op.path, 'Duplicate Create operation absorbed. Utilizing latest content payload.');
        }

        node.state = 'CREATED';
        node.contentBuffer = op.content;
        node.stagedChanges = [];
    }

    public applyDelete(op: DeletePathOperation): void {
        const node = this.workspace.getNode(op.path);

        if (node.state === 'CREATED') {
            this.warn(op.id, op.path, 'Delete after Create anomaly absorbed. Resulting in No-op.');
        } else if (node.state === 'MODIFIED') {
            this.warn(op.id, op.path, 'Delete after Update anomaly absorbed. Updates discarded.');
        }

        node.state = 'DELETED';
        node.contentBuffer = undefined;
        node.stagedChanges = [];
    }

    public async applyUpdate(op: UpdateFileOperation): Promise<void> {
        const node = this.workspace.getNode(op.path);

        if (node.state === 'DELETED') {
            this.warn(op.id, op.path, 'Update after Delete absorbed. No-op.');
            return;
        }

        if (node.state === 'CREATED') {
            let currentContent = node.contentBuffer || '';
            const searchEngine = new SearchEngine(); // БЕЗ КОНФІГУ
            let allApplied = true;

            for (const change of op.changes) {
                const doc = new VirtualDocument(node.currentPath, currentContent);
                // ПЕРЕДАЄМО FALSE для AST
                const match = await searchEngine.findMatch(doc, change.search, change.replace, false, undefined);
                
                if (match.status === 'MATCHED') {
                    const cleanReplacement = match.cleanReplaceBlock !== undefined ? match.cleanReplaceBlock : change.replace;
                    currentContent = doc.applyChange(match.range, cleanReplacement);
                    
                    if (match.hoistedImports && match.hoistedImports.length > 0) {
                        const importsText = match.hoistedImports.join('\n') + '\n';
                        currentContent = importsText + currentContent;
                    }
                } else {
                    allApplied = false;
                }
            }

            if (allApplied) {
                node.contentBuffer = currentContent;
                this.warn(op.id, op.path, 'Updates applied seamlessly in-memory to newly created file.');
            } else {
                node.contentBuffer = currentContent;
                this.warn(op.id, op.path, 'Some update blocks failed to match in-memory. Dropped partial updates.');
            }
            return;
        }

        node.state = 'MODIFIED';
        node.stagedChanges.push(...op.changes);
    }

    public applyMove(op: MovePathOperation): void {
        const node = this.workspace.getNode(op.path);

        if (node.state === 'DELETED') {
            this.warn(op.id, op.path, 'Move after Delete anomaly absorbed. No-op.');
            return;
        }

        this.workspace.transferNode(op.path, op.destinationPath);
    }

    private warn(operationId: string, path: string, reason: string): void {
        this.warnings.push({ operationId, path, reason });
    }
}