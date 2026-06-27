import { VirtualWorkspace } from './virtualWorkspace';
import { CreateFileOperation, DeletePathOperation, UpdateFileOperation, MovePathOperation } from '../models/operations';
import { CompilerWarning } from './models';
import { SearchEngine } from '../matcher/searchEngine';
import { VirtualDocument } from './virtualDocument';

/**
 * Pure state machine logic for flattening chronological operations into virtual nodes.
 * Isolates conflict resolution rules (Mutual Exclusion, Redundancy, Overwrites).
 */
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

    public applyUpdate(op: UpdateFileOperation): void {
        const node = this.workspace.getNode(op.path);

        if (node.state === 'DELETED') {
            this.warn(op.id, op.path, 'Update after Delete absorbed. No-op.');
            return;
        }

        // If the file was created in this same transaction, perform the update purely in-memory
        if (node.state === 'CREATED') {
            let currentContent = node.contentBuffer || '';
            const searchEngine = new SearchEngine();
            let allApplied = true;

            for (const change of op.changes) {
                const doc = new VirtualDocument(node.currentPath, currentContent);
                const match = searchEngine.findMatch(doc, change.search);
                
                if (match.status === 'MATCHED') {
                    currentContent = doc.applyChange(match.range, change.replace);
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

        // For files existing on disk (UNTOUCHED or MODIFIED), accumulate changes to emit as a single batch
        node.state = 'MODIFIED';
        node.stagedChanges.push(...op.changes);
    }

    public applyMove(op: MovePathOperation): void {
        const node = this.workspace.getNode(op.path);

        if (node.state === 'DELETED') {
            this.warn(op.id, op.path, 'Move after Delete anomaly absorbed. No-op.');
            return;
        }

        // Transfer the node pointer. If updates follow targeting the old path, 
        // the workspace alias engine will safely redirect them to the new node.
        this.workspace.transferNode(op.path, op.destinationPath);
    }

    private warn(operationId: string, path: string, reason: string): void {
        this.warnings.push({ operationId, path, reason });
    }
}
