import type * as vscode from 'vscode';
import type { ChatSession, ChatMessage, OperationStatus } from '@/shared/models';
import { SYSTEM_CONSTANTS } from '@/shared/constants';

export class ChatSessionManager {
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
        const stored = this.storage.get<ChatSession>(SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION);
        if (stored && Array.isArray(stored.messages)) {
            this.session = stored;
        }
    }

    private saveSession(): void {
        this.storage.update(SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION, this.session);
    }
}
