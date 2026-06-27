import { VirtualFileNode } from './models';

/**
 * In-Memory Virtual File System (VFS).
 * Acts as a registry for file states during transaction compilation.
 * Handles path aliasing to automatically route operations targeting moved files.
 */
export class VirtualWorkspace {
    private readonly nodes = new Map<string, VirtualFileNode>();
    private readonly aliases = new Map<string, string>();

    /**
     * Resolves a path through the alias graph. 
     * Prevents "Stale Reference" conflicts (e.g., Update old path after Move).
     */
    public resolvePath(path: string): string {
        let current = path;
        const visited = new Set<string>();

        while (this.aliases.has(current)) {
            if (visited.has(current)) break; // Break infinite loops
            visited.add(current);
            current = this.aliases.get(current)!;
        }

        return current;
    }

    public getNode(rawPath: string): VirtualFileNode {
        const resolvedPath = this.resolvePath(rawPath);

        if (!this.nodes.has(resolvedPath)) {
            this.nodes.set(resolvedPath, {
                originalPath: resolvedPath,
                currentPath: resolvedPath,
                state: 'UNTOUCHED',
                stagedChanges: []
            });
        }

        return this.nodes.get(resolvedPath)!;
    }

    /**
     * Transfers a node to a new path entirely. Updates references and aliases.
     * Crucial for correctly handling Move operations without duplicating objects.
     */
    public transferNode(oldRawPath: string, newRawPath: string): void {
        const resolvedOld = this.resolvePath(oldRawPath);
        const resolvedNew = this.resolvePath(newRawPath);
        
        if (resolvedOld === resolvedNew) return;

        const node = this.getNode(resolvedOld);
        node.currentPath = resolvedNew;

        // Move the physical pointer in the Map
        this.nodes.delete(resolvedOld);
        this.nodes.set(resolvedNew, node);
        
        // Link all future requests for the old path to the new path
        this.aliases.set(resolvedOld, resolvedNew);
    }

    public getAllNodes(): VirtualFileNode[] {
        return Array.from(this.nodes.values());
    }
}
