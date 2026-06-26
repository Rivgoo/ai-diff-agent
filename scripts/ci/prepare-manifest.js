const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve(__dirname, '../../package.json');

/**
 * Safely parses the package.json file, replaces the version parameter,
 * and overwrites the file back to disk while preserving formatting styles.
 */
function updateManifest() {
    const targetVersion = process.env.DYNAMIC_VERSION || process.argv[2];
    if (!targetVersion) {
        console.error('Error: Dynamic version metadata was not supplied via GITHUB_ENV or process arguments.');
        process.exit(1);
    }

    if (!fs.existsSync(manifestPath)) {
        console.error(`Error: package.json manifest not found at: ${manifestPath}`);
        process.exit(1);
    }

    try {
        const rawContent = fs.readFileSync(manifestPath, 'utf8');
        const parsedManifest = JSON.parse(rawContent);

        const oldVersion = parsedManifest.version;
        parsedManifest.version = targetVersion;

        // Stringify back with 2-space indentation and preserve trailing newline
        fs.writeFileSync(manifestPath, JSON.stringify(parsedManifest, null, 2) + '\n', 'utf8');
        console.log(`Successfully updated package.json version: ${oldVersion} -> ${targetVersion}`);
    } catch (error) {
        console.error(`Failed to update package.json manifest: ${error.message}`);
        process.exit(1);
    }
}

updateManifest();
