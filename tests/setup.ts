/// <reference types="node" />

/**
 * Global Test Bootstrap Module.
 * Hooks into Node.js runtime require API to handle path aliases and absolute 'vscode' dependency injection.
 * Removes repetitive, fragile require overrides in individual specification files.
 * Uses triple-slash directive at the top to load global Node environment definitions.
 */

import * as path from 'path';

const Module = require('module');

const originalRequire = Module.prototype.require;

Module.prototype.require = function (this: any, id: string) {
    // Gracefully resolve local module path aliases to pure runtime source directories
    if (id.startsWith('@/')) {
        const relativePart = id.substring(2);
        const targetPath = path.resolve(__dirname, '../src', relativePart);
        return originalRequire.call(this, targetPath);
    }

    // Intercept standard VS Code extensions import and inject stateful Mock Engine
    if (id === 'vscode') {
        const mockPath = path.resolve(__dirname, './mocks/vscode.mock');
        return originalRequire.call(this, mockPath);
    }

    return originalRequire.apply(this, arguments);
};
