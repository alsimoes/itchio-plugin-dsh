#!/usr/bin/env node
/**
 * Example post-release hook.
 *
 * Pass it explicitly when running a release:
 *   node release.js push --source ./dist --target user/game \
 *     --hook ./examples/post-release-hook.js
 *
 * The CLI exposes the release details as environment variables:
 *   RELEASE_SOURCE, RELEASE_TARGET, RELEASE_CHANNEL, RELEASE_VERSION
 */
import { existsSync, readdirSync } from 'node:fs';

const { RELEASE_TARGET, RELEASE_CHANNEL, RELEASE_VERSION } = process.env;

console.log('========================================');
console.log('itch.io release hook - running...');
console.log('========================================');
console.log(`target:  ${RELEASE_TARGET ?? '(unknown)'}`);
console.log(`channel: ${RELEASE_CHANNEL ?? '(unknown)'}`);
console.log(`version: ${RELEASE_VERSION || '(auto)'}`);

if (existsSync('dist')) {
  console.log('\nbuild directory found: dist/');
  for (const entry of readdirSync('dist', { withFileTypes: true })) {
    console.log(`  ${entry.isDirectory() ? 'dir ' : 'file'} ${entry.name}`);
  }
}

// Add your own post-release tasks here.
// Examples: send a notification, update a changelog, open the game page.

console.log('\n========================================');
console.log('hook finished.');
console.log('========================================');
