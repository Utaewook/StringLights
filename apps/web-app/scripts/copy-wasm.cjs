const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist');
const destDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    files.forEach(file => {
        if (file.endsWith('.wasm')) {
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied ${file} to public/`);
        }
    });
    console.log('ONNX Runtime WASM assets copy completed.');
} else {
    console.error(`Source directory not found: ${srcDir}`);
}
