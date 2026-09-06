import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { SettingsManager } from '../settings/settingsManager';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';

export class ClipboardObserverService implements vscode.Disposable {
    private lastHash: string | null = null;
    private isPrompting: boolean = false;
    private readonly disposable: vscode.Disposable;

    constructor(
        private readonly settingsManager: SettingsManager,
        private readonly onPayloadAccepted: (payload: string) => void
    ) {
        this.disposable = vscode.window.onDidChangeWindowState(this.handleWindowStateChange.bind(this));
    }

    private handleWindowStateChange(e: vscode.WindowState): void {
        // Реагуємо лише тоді, коли вікно VS Code отримує фокус (користувач перемкнувся з браузера)
        if (!e.focused) return;
        
        if (!this.settingsManager.getSettings().workflow.clipboardWatcher) return;
        if (this.isPrompting) return;

        // Даємо ОС 500мс на синхронізацію буфера обміну з VS Code після зміни фокусу вікна
        setTimeout(async () => {
            try {
                const text = await vscode.env.clipboard.readText();
                
                // Перевіряємо, чи є потрібний тег будь-де у тексті
                if (!text || !text.includes('<workspace_edit>')) {
                    return;
                }

                // Хешуємо payload, щоб не пропонувати один і той самий код двічі
                const hash = crypto.createHash('md5').update(text).digest('hex');
                if (this.lastHash === hash) {
                    return;
                }

                this.lastHash = hash;
                this.isPrompting = true;

                const action = await vscode.window.showInformationMessage(
                    '✨ AI Payload detected in clipboard. Do you want to apply it?',
                    'Apply',
                    'Ignore'
                );

                if (action === 'Apply') {
                    OutputLogger.log('User accepted AI payload from clipboard.', 'INFO');
                    this.onPayloadAccepted(text);
                } else {
                    OutputLogger.log('User ignored clipboard payload.', 'INFO');
                }
            } catch (error) {
                OutputLogger.log(`Clipboard observation failed: ${error instanceof Error ? error.message : String(error)}`, 'WARN');
            } finally {
                this.isPrompting = false;
            }
        }, 500);
    }

    public dispose(): void {
        this.disposable.dispose();
    }
}