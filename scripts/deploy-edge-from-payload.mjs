#!/usr/bin/env node
/**
 * Reads .deploy-payload.json and prints JSON for MCP deploy_edge_function.
 * Usage: node scripts/deploy-edge-from-payload.mjs <function-dir>
 */
import fs from 'node:fs';
import path from 'node:path';

const fnDir = process.argv[2];
if (!fnDir) {
  console.error('Usage: node scripts/deploy-edge-from-payload.mjs <function-dir>');
  process.exit(1);
}

const payloadPath = path.join(fnDir, '.deploy-payload.json');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
process.stdout.write(JSON.stringify(payload));
