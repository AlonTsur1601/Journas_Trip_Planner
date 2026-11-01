// Firebase CLI and Superstatic still call minimatch's pre-v9 CommonJS export.
// Keep those two imports compatible with the patched minimatch release.
const fs = require('node:fs');

for (const [packageName, entry] of [
  ['firebase-tools', 'firebase-tools/lib/fsAsync.js'],
  ['superstatic', 'superstatic/lib/utils/patterns.js'],
]) {
  try {
    require.resolve(`${packageName}/package.json`);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') continue; // Production-only install.
    throw error;
  }
  const file = require.resolve(entry);
  const original = 'const minimatch = require("minimatch");';
  const patched = 'const { minimatch } = require("minimatch");';
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(patched) && !source.includes(original)) continue;
  if (source.split(original).length !== 2) {
    throw new Error(`Review the minimatch compatibility patch for ${entry}.`);
  }
  fs.writeFileSync(file, source.replace(original, patched));
}
