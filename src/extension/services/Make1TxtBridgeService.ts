import * as vscode from 'vscode';
import * as http from 'http';
import * as crypto from 'crypto';
import { SettingsManager } from '../settings/settingsManager';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';

interface BridgePayload {
    projectName: string;
    files: {
        path: string;
        content: string;
        size: number;
    }[];
}

export class Make1TxtBridgeService {
    private activeServer: http.Server | null = null;
    private timeoutHandle: NodeJS.Timeout | null = null;

    constructor(private readonly settingsManager: SettingsManager) {}

    public async startSync(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage('Make1Txt Bridge: No workspace folder is open.');
            return;
        }

        const settings = this.settingsManager.getSettings().bridge;
        if (!settings.enableBridge) {
            vscode.window.showErrorMessage('Make1Txt Bridge is disabled in settings.');
            return;
        }

        const rootUri = workspaceFolders[0].uri;
        const projectName = workspaceFolders[0].name;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Make1Txt Local Bridge",
            cancellable: true
        }, async (progress, token) => {
            
            progress.report({ message: "Scanning workspace files..." });
            
            try {
                const payload = await this.scanWorkspace(rootUri, projectName, token);
                if (token.isCancellationRequested) return;

                if (payload.files.length === 0) {
                    vscode.window.showWarningMessage('Make1Txt Bridge: No valid files found to export.');
                    return;
                }

                progress.report({ message: "Starting secure local server..." });
                await this.launchEphemeralServer(payload);
            } catch (error) {
                OutputLogger.log(`Bridge Sync Failed: ${error instanceof Error ? error.message : String(error)}`, 'ERROR');
                vscode.window.showErrorMessage(`Failed to export project: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }

    private async scanWorkspace(rootUri: vscode.Uri, projectName: string, cancelToken: vscode.CancellationToken): Promise<BridgePayload> {
        const settings = this.settingsManager.getSettings().bridge;
        const rootPath = rootUri.fsPath.replace(/\\/g, '/');
        
        // Пошук файлів (vscode.workspace.findFiles поважає .gitignore, якщо не передано кастомний патерн виключень)
        const excludePattern = settings.respectGitIgnore ? undefined : '';
        const allFiles = await vscode.workspace.findFiles('**/*', excludePattern, 100000, cancelToken);

        const ignoredDirs = new Set(settings.ignoredDirectories.map(d => d.toLowerCase()));
        const ignoredExts = new Set(settings.ignoredExtensions.map(e => e.toLowerCase()));
        
        const maxFileSizeBytes = settings.maxFileSizeKb === 0 ? Infinity : settings.maxFileSizeKb * 1024;
        const maxProjectSizeBytes = settings.maxProjectSizeMb * 1024 * 1024;

        let totalSize = 0;
        const validFiles: BridgePayload['files'] = [];

        for (const fileUri of allFiles) {
            if (cancelToken.isCancellationRequested) break;

            const filePath = fileUri.fsPath.replace(/\\/g, '/');
            const relativePath = filePath.startsWith(rootPath) ? filePath.substring(rootPath.length + 1) : filePath;

            // Фільтрація по директоріях
            const pathSegments = relativePath.split('/');
            const isInIgnoredDir = pathSegments.some(segment => ignoredDirs.has(segment.toLowerCase()));
            if (isInIgnoredDir) continue;

            // Фільтрація по розширеннях
            const dotIndex = relativePath.lastIndexOf('.');
            const ext = dotIndex !== -1 ? relativePath.substring(dotIndex).toLowerCase() : '';
            if (ext && ignoredExts.has(ext)) continue;

            try {
                // Фільтрація по розміру файлу
                const stat = await vscode.workspace.fs.stat(fileUri);
                if (stat.size > maxFileSizeBytes) {
                    OutputLogger.log(`[Bridge] Skipped ${relativePath} (exceeds file size limit: ${stat.size} bytes)`);
                    continue;
                }

                // Захист від OOM на рівні проєкту
                if (totalSize + stat.size > maxProjectSizeBytes) {
                    throw new Error(`Total payload exceeded the ${settings.maxProjectSizeMb}MB safety limit. Please adjust your Exclusions or Limits in settings.`);
                }

                // Читання контенту та фільтрація бінарників
                const fileData = await vscode.workspace.fs.readFile(fileUri);
                const content = new TextDecoder('utf-8').decode(fileData);

                // Евристика: якщо файл містить нульовий байт, це бінарник, відкидаємо
                if (content.indexOf('\0') !== -1) {
                    OutputLogger.log(`[Bridge] Skipped ${relativePath} (detected binary content)`);
                    continue;
                }

                validFiles.push({
                    path: relativePath,
                    content,
                    size: stat.size
                });

                totalSize += stat.size;
            } catch (error) {
                if (error instanceof Error && error.message.includes('safety limit')) {
                    throw error;
                }
                // Пропускаємо файли, до яких немає доступу
            }
        }

        OutputLogger.log(`[Bridge] Scanned ${validFiles.length} files. Total payload: ${(totalSize / 1024 / 1024).toFixed(2)} MB`, 'INFO');

        return {
            projectName,
            files: validFiles
        };
    }

    private async launchEphemeralServer(payload: BridgePayload): Promise<void> {
        this.killExistingServer();

        const secretToken = crypto.randomUUID();
        const settings = this.settingsManager.getSettings().bridge;
        
        let targetOrigin = settings.useCustomUrl ? settings.customUrl.trim() : 'https://make1txt.vercel.app';
        if (targetOrigin.endsWith('/')) targetOrigin = targetOrigin.slice(0, -1);

        const server = http.createServer((req, res) => {
            res.setHeader('Access-Control-Allow-Origin', targetOrigin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Authorization');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            if (req.method === 'GET' && req.url?.startsWith('/api/context')) {
                const authHeader = req.headers['authorization'];
                const expectedAuth = `Bearer ${secretToken}`;

                if (authHeader !== expectedAuth) {
                    OutputLogger.log(`[Bridge] Rejected unauthorized connection attempt.`, 'WARN');
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                try {
                    const jsonResponse = JSON.stringify(payload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(jsonResponse, () => {
                        OutputLogger.log(`[Bridge] Successfully transmitted context to Make1Txt. Closing server.`, 'INFO');
                        vscode.window.showInformationMessage('Project context successfully synced with Make1Txt!');
                        this.killExistingServer(); // Вбиваємо сервер одразу після успішної віддачі
                    });
                } catch (error) {
                    res.writeHead(500);
                    res.end();
                }
                return;
            }

            res.writeHead(404);
            res.end();
        });

        this.activeServer = server;

        return new Promise((resolve, reject) => {
            server.on('error', (err) => {
                this.killExistingServer();
                reject(err);
            });

            // Слухаємо порт 0 (ОС видасть випадковий вільний порт) прив'язаний строго до localhost
            server.listen(0, '127.0.0.1', async () => {
                const address = server.address();
                if (address && typeof address !== 'string') {
                    const port = address.port;
                    OutputLogger.log(`[Bridge] Ephemeral server listening on 127.0.0.1:${port}`, 'INFO');
                    
                    const syncUrl = `${targetOrigin}/sync?port=${port}&token=${secretToken}`;
                    await vscode.env.openExternal(vscode.Uri.parse(syncUrl));

                    // Тайм-аут: сервер живе максимум 60 секунд
                    this.timeoutHandle = setTimeout(() => {
                        if (this.activeServer) {
                            OutputLogger.log(`[Bridge] Connection timed out after 60s. Closing server for safety.`, 'WARN');
                            vscode.window.showWarningMessage('Make1Txt Bridge connection timed out.');
                            this.killExistingServer();
                        }
                    }, 60000);

                    resolve();
                } else {
                    reject(new Error("Failed to obtain dynamic port."));
                }
            });
        });
    }

    private killExistingServer(): void {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }
        if (this.activeServer) {
            this.activeServer.close();
            this.activeServer = null;
        }
    }
}