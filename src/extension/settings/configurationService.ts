import * as vscode from "vscode";
import { SYSTEM_CONSTANTS } from "@/shared/constants";
import type { UiSettings, WorkflowSettings, EngineSettings, AstSettings, AiSettings, BridgeSettings } from "@/shared/models";

export class ConfigurationService {
  public getUiSettings(): UiSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const ui = config.get<Partial<UiSettings>>("ui") || {};
    
    return {
      autoScroll: ui.autoScroll ?? true,
      compactMode: ui.compactMode ?? false,
      showConfidenceBadges: ui.showConfidenceBadges ?? true,
      enableCodeLens: ui.enableCodeLens ?? true,
      enableWalkthroughMode: ui.enableWalkthroughMode ?? false,
      diagnosticsLevel: ui.diagnosticsLevel ?? 'all',
    };
  }

  public getWorkflowSettings(): WorkflowSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const workflow = config.get<Partial<WorkflowSettings>>("workflow") || {};

    return {
      chatHistoryMode: workflow.chatHistoryMode ?? 'workspace',
      autoSaveMode: workflow.autoSaveMode ?? 'on_accept',
      formatBehavior: workflow.formatBehavior ?? 'onSaveOnly',
      cleanupEmptyDirectories: workflow.cleanupEmptyDirectories ?? true,
      ignoredCleanupDirs: workflow.ignoredCleanupDirs ?? ['.ds_store', 'thumbs.db', 'desktop.ini'],
      backupRetentionDays: workflow.backupRetentionDays ?? 7,
      executionMode: workflow.executionMode ?? 'tolerant',
      clipboardWatcher: workflow.clipboardWatcher ?? false,
      historyBranchAwareness: workflow.historyBranchAwareness ?? true,
      historyKeepCount: workflow.historyKeepCount ?? 50,
    };
  }

  public getEngineSettings(): EngineSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const engine = config.get<Partial<EngineSettings>>("engine") || {};
    
    return {
      payloadRecoveryMode: engine.payloadRecoveryMode ?? 'aggressive',
      fallbackMatchLevel: engine.fallbackMatchLevel ?? 'safe',
      maxFileSizeMb: engine.maxFileSizeMb ?? 5,
      maxGlobalSearchCandidates: engine.maxGlobalSearchCandidates ?? 5,
      useUnsavedBuffers: engine.useUnsavedBuffers ?? true,
      polyglotParsing: engine.polyglotParsing ?? true,
      strictParsing: engine.strictParsing ?? false,
      allowCdataUnwrap: engine.allowCdataUnwrap ?? true,
      allowFuzzyMatching: engine.allowFuzzyMatching ?? true,
      allowSlidingWindow: engine.allowSlidingWindow ?? true,
      blockOnSyntaxErrors: engine.blockOnSyntaxErrors ?? false,
      respectGitIgnore: engine.respectGitIgnore ?? true,
    };
  }

  public getAstSettings(): AstSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const ast = config.get<Partial<AstSettings>>("ast") || {};

    return {
      enableAstMatching: ast.enableAstMatching ?? true,
      enabledLanguages: ast.enabledLanguages ?? ['javascript', 'typescript', 'tsx', 'python', 'java', 'c_sharp', 'cpp', 'json', 'html', 'css', 'bash', 'c'],
      sanityStrictness: ast.sanityStrictness ?? 'warn',
      validateEmbeddedScripts: ast.validateEmbeddedScripts ?? true,
      queryTolerance: ast.queryTolerance ?? 'allow_signature_drift',
      strictSyntaxValidation: ast.strictSyntaxValidation ?? false,
      autoFixSyntax: ast.autoFixSyntax ?? true,
      lspValidation: ast.lspValidation ?? false,
      autoStitchImports: ast.autoStitchImports ?? false,
      blastRadiusAnalysis: ast.blastRadiusAnalysis ?? true,
      parserTimeoutMs: ast.parserTimeoutMs ?? 100,
      lspTimeoutMs: ast.lspTimeoutMs ?? 2000,
    };
  }

  public getAiSettings(): AiSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const ai = config.get<Partial<AiSettings>>("ai") || {};

    return {
      customPrompts: ai.customPrompts ?? [],
    };
  }

  public getBridgeSettings(): BridgeSettings {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    const bridge = config.get<Partial<BridgeSettings>>("bridge") || {};

    return {
      enableBridge: bridge.enableBridge ?? true,
      useCustomUrl: bridge.useCustomUrl ?? false,
      customUrl: bridge.customUrl ?? 'https://make1txt.vercel.app',
      maxFileSizeKb: bridge.maxFileSizeKb ?? 10240,
      maxProjectSizeMb: bridge.maxProjectSizeMb ?? 50,
      respectGitIgnore: bridge.respectGitIgnore ?? true,
      ignoredExtensions: bridge.ignoredExtensions ?? ['.exe', '.dll', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff', '.raw', '.heic', '.psd', '.ai', '.xd', '.sketch', '.fig', '.fbx', '.blend', '.stl', '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.pdf', '.zip', '.rar', '.7z', '.tar', '.gz', '.iso', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
      ignoredDirectories: bridge.ignoredDirectories ?? ['.git', '.svn', '.hg', '.bzr', 'node_modules', 'bower_components', 'jspm_packages', '.npm', '.yarn', '.pnpm-store', 'venv', '.venv', 'env', '.env', '__pycache__', '.pytest_cache', '.tox', '.nox', '.mypy_cache', 'build', 'dist', 'out', 'target', 'bin', 'obj', '.next', '.nuxt', '.vue', '.svelte-kit', '.svelte', '.angular', 'coverage', '.nyc_output', 'vendor', 'var', '.cache', '.parcel-cache', '.vite', '.webpack', '.rollup.cache']
    };
  }

  public async updateSetting(category: "ui" | "workflow" | "engine" | "ast" | "ai" | "bridge", key: string, value: any): Promise<void> {
    const config = vscode.workspace.getConfiguration(SYSTEM_CONSTANTS.CONFIG_SECTION);
    
    const currentSection = { ...(config.get<Record<string, any>>(category) || {}) };
    currentSection[key] = value;

    const inspection = config.inspect(category);
    let target = vscode.ConfigurationTarget.Global;
    
    if (inspection?.workspaceValue !== undefined) {
        target = vscode.ConfigurationTarget.Workspace;
    }

    await config.update(category, currentSection, target);
  }
}