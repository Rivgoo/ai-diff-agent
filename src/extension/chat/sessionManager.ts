import * as vscode from 'vscode';
import { ChatSession, ChatMessage, OperationStatus } from '../../shared/models';

/**
 * Manages the persistence of the chat session across VS Code reloads.
 * Uses workspaceState to keep the session bound to the current project.
 */
export class ChatSessionManager {
    private static readonly STORAGE_KEY = 'ai-diff-agent.chatSession';
    private session: ChatSession = { messages: [] };

    constructor(private readonly storage: vscode.Memento) {
        this.loadSession();
    }

    public getSession(): ChatSession {
        return this.session;
    }

    public addMessage(message: ChatMessage): void {
        this.session.messages.push(message);
        this.saveSession();
    }

    public updateOperationStatus(operationId: string, status: OperationStatus): void {
        for (const msg of this.session.messages) {
            if (msg.operations) {
                const op = msg.operations.find(o => o.id === operationId);
                if (op) {
                    op.status = status;
                    this.saveSession();
                    return;
                }
            }
        }
    }

    public clearSession(): void {
        this.session = { messages: [] };
        this.saveSession();
    }

    private loadSession(): void {
        const stored = this.storage.get<ChatSession>(ChatSessionManager.STORAGE_KEY);
        if (stored && Array.isArray(stored.messages)) {
            this.session = stored;
        }
    }

    private saveSession(): void {
        this.storage.update(ChatSessionManager.STORAGE_KEY, this.session);
    }
}
