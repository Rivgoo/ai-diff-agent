const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../resources/grammars');
const destDir = path.resolve(__dirname, '../out/extension/grammars');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// 1. Копіюємо граматики мов (C#, TS, і т.д.)
if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
        if (file.endsWith('.wasm')) {
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
            console.log(`Copied language grammar: ${file}`);
        }
    }
} else {
    console.warn(`Warning: Directory not found - ${srcDir}`);
}

// 2. Копіюємо базовий рушій (core engine) з node_modules
try {
    // Знаходимо, де фізично лежить бібліотека web-tree-sitter
    const webTreeSitterDir = path.dirname(require.resolve('web-tree-sitter'));
    
    // Різні версії бібліотеки називають цей файл по-різному
    const coreWasmFiles = ['tree-sitter.wasm', 'web-tree-sitter.wasm'];
    
    let foundCore = false;
    for (const wasmName of coreWasmFiles) {
        const corePath = path.join(webTreeSitterDir, wasmName);
        if (fs.existsSync(corePath)) {
            // Зберігаємо під обома іменами для абсолютної сумісності
            fs.copyFileSync(corePath, path.join(destDir, 'web-tree-sitter.wasm'));
            fs.copyFileSync(corePath, path.join(destDir, 'tree-sitter.wasm'));
            console.log(`Copied core engine: ${wasmName} -> web-tree-sitter.wasm`);
            foundCore = true;
            break;
        }
    }
    
    if (!foundCore) {
        console.warn('Warning: Could not find core web-tree-sitter.wasm in node_modules');
    }
} catch (e) {
    console.warn('Warning: Could not resolve web-tree-sitter module path', e);
}