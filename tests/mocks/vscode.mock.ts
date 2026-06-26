import * as path from 'path';

/**
 * Stateful Centralized VS Code API Mock Engine.
 * Upgraded in Phase 4 to subclass Map and parse advanced case-insensitive bracket glob queries.
 */

class MockFilesystemMap extends Map<string, string> {
    public override set(key: string, value: string): this {
        super.set(key, value);
        
        // Auto-register parent directory segments to mimic physical OS folder structures
        if (!key.endsWith('/')) {
            const parts = key.split('/');
            for (let i = 4; i < parts.length; i++) {
                const parentDir = parts.slice(0, i).join('/') + '/';
                if (!super.has(parentDir)) {
                    super.set(parentDir, 'DIRECTORY_MARKER');
                }
            }
        }
        return this;
    }
}

export const mockFilesystem = new MockFilesystemMap();
export const mockLiveDocuments: any[] = [];
export const mockAppliedEdits: any[] = [];
export let mockApplyEditCallCount = 0;

/**
 * Resets all shared virtual states to guarantee isolation between unit test suites.
 */
export function resetMockState(): void {
    mockFilesystem.clear();
    mockLiveDocuments.length = 0;
    mockAppliedEdits.length = 0;
    mockApplyEditCallCount = 0;
    mockOutputChannels.clear();
}

export class Position {
    constructor(
        public readonly line: number,
        public readonly character: number
    ) {}

    public compareTo(other: Position): number {
        if (this.line !== other.line) {
            return this.line - other.line;
        }
        return this.character - other.character;
    }

    public isBefore(other: Position): boolean {
        return this.compareTo(other) < 0;
    }

    public isBeforeOrEqual(other: Position): boolean {
        return this.compareTo(other) <= 0;
    }

    public isAfter(other: Position): boolean {
        return this.compareTo(other) > 0;
    }

    public isAfterOrEqual(other: Position): boolean {
        return this.compareTo(other) >= 0;
    }

    public isEqual(other: Position): boolean {
        return this.compareTo(other) === 0;
    }

    public translate(lineDelta?: number, characterDelta?: number): Position {
        return new Position(this.line + (lineDelta ?? 0), this.character + (characterDelta ?? 0));
    }

    public with(line?: number, character?: number): Position {
        return new Position(line ?? this.line, character ?? this.character);
    }
}

export class Range {
    public readonly start: Position;
    public readonly end: Position;

    constructor(start: Position, end: Position);
    constructor(startLine: number, startChar: number, endLine: number, endChar: number);
    constructor(startOrLine: Position | number, endOrChar: Position | number, endLine?: number, endChar?: number) {
        if (
            typeof startOrLine === 'number' &&
            typeof endOrChar === 'number' &&
            typeof endLine === 'number' &&
            typeof endChar === 'number'
        ) {
            this.start = new Position(startOrLine, endOrChar);
            this.end = new Position(endLine, endChar);
        } else if (startOrLine instanceof Position && endOrChar instanceof Position) {
            this.start = startOrLine;
            this.end = endOrChar;
        } else {
            throw new Error('Invalid Range mock constructor signatures.');
        }
    }

    public get isEmpty(): boolean {
        return this.start.isEqual(this.end);
    }

    public get isSingleLine(): boolean {
        return this.start.line === this.end.line;
    }

    public isEqual(other: Range): boolean {
        return this.start.isEqual(other.start) && this.end.isEqual(other.end);
    }

    public with(start?: Position, end?: Position): Range {
        return new Range(start ?? this.start, end ?? this.end);
    }
}

export class Uri {
    private constructor(
        public readonly scheme: string,
        public readonly authority: string,
        public readonly path: string,
        public readonly query: string,
        public readonly fragment: string
    ) {}

    public get fsPath(): string {
        return this.path;
    }

    public toString(): string {
        return `${this.scheme}://${this.authority}${this.path}`;
    }

    public static parse(value: string): Uri {
        const match = value.match(/^([^:]+):\/\/([^\/]*)(.*)$/);
        if (match) {
            return new Uri(match[1], match[2], match[3], '', '');
        }
        return new Uri('file', '', value, '', '');
    }

    public static file(path: string): Uri {
        return new Uri('file', '', path.replace(/\\/g, '/'), '', '');
    }

    public static joinPath(base: Uri, ...parts: string[]): Uri {
        const combinedPath = path.posix.join(base.path, ...parts);
        return new Uri(base.scheme, base.authority, combinedPath, base.query, base.fragment);
    }
}

export class ThemeColor {
    constructor(public readonly id: string) {}
}

export enum OverviewRulerLane {
    Left = 1,
    Center = 2,
    Right = 4,
    Full = 7
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3
}

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64
}

export class WorkspaceEdit {
    public createFile(uri: Uri): void {
        mockAppliedEdits.push({ type: 'create_file', uri });
    }

    public deleteFile(uri: Uri): void {
        mockAppliedEdits.push({ type: 'delete_file', uri });
    }

    public renameFile(oldUri: Uri, newUri: Uri): void {
        mockAppliedEdits.push({ type: 'rename_file', src: oldUri, dest: newUri });
    }

    public replace(uri: Uri, range: Range, newText: string): void {
        mockAppliedEdits.push({ type: 'replace', uri, range, text: newText });
    }
}

export const workspace = {
    workspaceFolders: [
        { uri: Uri.parse('file:///workspace'), name: 'workspace', index: 0 }
    ],

    get textDocuments() {
        return mockLiveDocuments;
    },

    /**
     * Executes indexing scans on virtual mockFilesystem matching globs (Phase 4).
     * Parses advanced case-insensitive bracket patterns securely using Regex translation.
     */
    findFiles: async (include: any, exclude?: any): Promise<Uri[]> => {
        const results: Uri[] = [];
        const globPattern = typeof include === 'string' ? include : (include && typeof include.pattern === 'string' ? include.pattern : String(include));
        
        // Safely translate Glob Pattern to RegExp
        let regexStr = globPattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*');
        if (!regexStr.startsWith('.*')) {
            regexStr = '^' + regexStr;
        }
        regexStr = regexStr + '$';
        
        const regex = new RegExp(regexStr, 'i'); // Case-insensitive matching

        for (const key of mockFilesystem.keys()) {
            const normalized = key.replace(/\\/g, '/');
            
            // Apply mock exclusions
            if (exclude) {
                const excludeStr = typeof exclude === 'string' ? exclude : (exclude.pattern || String(exclude));
                const isExcluded = excludeStr.split(',').some((ex: string) => {
                    const cleanEx = ex.trim().replace(/\*\*/g, '').replace(/\*/g, '');
                    return cleanEx && normalized.includes(cleanEx);
                });
                if (isExcluded) continue;
            }

            if (regex.test(normalized)) {
                results.push(Uri.parse(key));
            }
        }
        return results;
    },

    applyEdit: async (): Promise<boolean> => {
        mockApplyEditCallCount++;
        for (const action of mockAppliedEdits) {
            const uriStr = action.uri?.toString() ?? '';
            if (action.type === 'create_file') {
                if (!mockFilesystem.has(uriStr)) {
                    mockFilesystem.set(uriStr, '');
                }
            } else if (action.type === 'delete_file') {
                mockFilesystem.delete(uriStr);
                for (const k of mockFilesystem.keys()) {
                    if (k.startsWith(uriStr + '/')) {
                        mockFilesystem.delete(k);
                    }
                }
            } else if (action.type === 'rename_file') {
                const srcStr = action.src.toString();
                const destStr = action.dest.toString();
                const content = mockFilesystem.get(srcStr) ?? '';
                mockFilesystem.delete(srcStr);
                mockFilesystem.set(destStr, content);
            } else if (action.type === 'replace') {
                mockFilesystem.set(uriStr, action.text);
            }
        }
        return true;
    },

    openTextDocument: async (uri: Uri) => {
        const uriStr = uri.toString();
        const content = mockFilesystem.get(uriStr);
        if (content === undefined) {
            throw new Error(`Document not found in Mock FS: ${uriStr}`);
        }
        return {
            uri,
            getText: () => content,
            lineCount: content.split(/\r?\n/).length,
            positionAt: (offset: number) => {
                const before = content.substring(0, offset);
                const lines = before.split('\n');
                const line = lines.length - 1;
                const character = lines[lines.length - 1].length;
                return new Position(line, character);
            },
            isDirty: false
        };
    },

    getConfiguration: () => {
        return {
            get: <T>(key: string, defaultValue: T): T => {
                if (!key) {
                    return defaultValue;
                }
                return defaultValue;
            },
            update: async () => {}
        };
    },

    fs: {
        stat: async (uri: Uri): Promise<any> => {
            const uriStr = uri.toString();
            if (mockFilesystem.has(uriStr)) {
                return {};
            }
            const dirPrefix = uriStr.endsWith('/') ? uriStr : uriStr + '/';
            for (const key of mockFilesystem.keys()) {
                if (key.startsWith(dirPrefix)) {
                    return {};
                }
            }
            throw new Error(`File stat failed. Path not found: ${uriStr}`);
        },

        createDirectory: async (uri: Uri): Promise<void> => {
            const uriStr = uri.toString();
            const dirKey = uriStr.endsWith('/') ? uriStr : uriStr + '/';
            mockFilesystem.set(dirKey, 'DIRECTORY_MARKER');
        },

        writeFile: async (uri: Uri, bytes: Uint8Array): Promise<void> => {
            const uriStr = uri.toString();
            mockFilesystem.set(uriStr, new TextDecoder().decode(bytes));
        },

        readFile: async (uri: Uri): Promise<Uint8Array> => {
            const content = mockFilesystem.get(uri.toString());
            if (content === undefined) {
                throw new Error(`File not found: ${uri.toString()}`);
            }
            return new TextEncoder().encode(content);
        },

        readDirectory: async (uri: Uri): Promise<[string, FileType][]> => {
            const uriStr = uri.toString();
            const dirPrefix = uriStr.endsWith('/') ? uriStr : uriStr + '/';
            const entries = new Map<string, FileType>();

            for (const key of mockFilesystem.keys()) {
                if (key.startsWith(dirPrefix) && key !== dirPrefix) {
                    const relativePart = key.substring(dirPrefix.length);
                    const firstSegment = relativePart.split('/')[0];
                    if (firstSegment) {
                        const isSubDir = relativePart.includes('/') || mockFilesystem.get(key) === 'DIRECTORY_MARKER';
                        entries.set(firstSegment, isSubDir ? FileType.Directory : FileType.File);
                    }
                }
            }
            return Array.from(entries.entries());
        },

        delete: async (uri: Uri, options?: { recursive?: boolean }): Promise<void> => {
            const prefix = uri.toString();
            mockFilesystem.delete(prefix);
            const dirPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
            mockFilesystem.delete(dirPrefix);
            
            if (options && options.recursive) {
                for (const key of mockFilesystem.keys()) {
                    if (key.startsWith(dirPrefix)) {
                        mockFilesystem.delete(key);
                    }
                }
            }
        },

        copy: async (src: Uri, dest: Uri): Promise<void> => {
            const content = mockFilesystem.get(src.toString());
            if (content === undefined) {
                throw new Error(`Source not found: ${src.toString()}`);
            }
            mockFilesystem.set(dest.toString(), content);
        }
    }
};

export class MockOutputChannel {
    private logs: string[] = [];
    constructor(public readonly name: string) {}

    public appendLine(value: string): void {
        this.logs.push(value);
    }

    public show(): void {}
    public dispose(): void {}
    public getLogs(): string[] {
        return this.logs;
    }

    public clear(): void {
        this.logs = [];
    }
}

export const mockOutputChannels = new Map<string, MockOutputChannel>();

export const window = {
    createTextEditorDecorationType: () => ({
        dispose: () => {}
    }),
    
    visibleTextEditors: [],
    
    createOutputChannel: (name: string): MockOutputChannel => {
        if (!mockOutputChannels.has(name)) {
            mockOutputChannels.set(name, new MockOutputChannel(name));
        }
        return mockOutputChannels.get(name)!;
    }
};
