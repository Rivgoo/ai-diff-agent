const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../resources/grammars');
const destDir = path.resolve(__dirname, '../../out/extension/grammars');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
        if (file.endsWith('.wasm')) {
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
            console.log(`Copied ${file} to out/extension/grammars`);
        }
    }
} else {
    console.warn(`Warning: Directory not found - ${srcDir}`);
}