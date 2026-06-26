const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Executes a shell command synchronously and returns clean, stripped stdout.
 * Safely catch failures to allow fail-safe default versions.
 * @param {string} command 
 * @returns {string|null}
 */
function executeCommand(command) {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return null;
    }
}

/**
 * Retrieves raw Git metadata using tag descriptors and commit logs.
 * Falls back to project repository depths if no tags are defined.
 * @returns {object}
 */
function getGitMetadata() {
    // Attempt to describe the current commit state using tags.
    // Format output: v1.2.0-5-gabc123
    const describeStr = executeCommand('git describe --tags --long --always');
    if (!describeStr) {
        const commitCount = executeCommand('git rev-list --count HEAD');
        const shortSha = executeCommand('git rev-parse --short HEAD') || 'unknown';
        const parsedCount = commitCount ? parseInt(commitCount, 10) : 0;
        return {
            latestTag: '0.1.0',
            commitsSinceTag: parsedCount,
            currentSha: shortSha,
            isExactTag: false
        };
    }

    // Standard git describe regex check
    const regex = /^v?(\d+\.\d+\.\d+)-(\d+)-g([a-f0-9]+)$/;
    const match = describeStr.match(regex);

    if (match) {
        return {
            latestTag: match[1],
            commitsSinceTag: parseInt(match[2], 10),
            currentSha: match[3],
            isExactTag: parseInt(match[2], 10) === 0
        };
    }

    // Repository has tags but describe output is a raw tag or hash
    const commitCount = executeCommand('git rev-list --count HEAD') || '0';
    return {
        latestTag: '0.1.0',
        commitsSinceTag: parseInt(commitCount, 10),
        currentSha: describeStr,
        isExactTag: false
    };
}

/**
 * Calculates a valid SemVer 2.0.0 compliant version string for VS Code Packaging.
 * If commits exist since the last tag, increments patch version and adds a pre-release dev suffix.
 * @returns {string}
 */
function calculateSemVer() {
    const meta = getGitMetadata();
    if (!meta) {
        return '0.1.0-dev.unknown';
    }

    if (meta.isExactTag) {
        return meta.latestTag;
    }

    const parts = meta.latestTag.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        return '0.1.0-dev.unknown';
    }

    const major = parts[0];
    const minor = parts[1];
    const patch = parts[2] + 1; // Increment patch to represent unreleased development builds

    return `${major}.${minor}.${patch}-dev.${meta.commitsSinceTag}`;
}

const version = calculateSemVer();
console.log(version);

// Output to GitHub Actions environment runner file if active
if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `DYNAMIC_VERSION=${version}\n`, 'utf8');
}
