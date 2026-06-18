#!/usr/bin/env node
/**
 * Reads .deploy-payload.json and prints JSON args for deploy_edge_function.
 * Usage: node scripts/mcp-deploy-from-payload.mjs <function-dir>
 */
import fs from 'node:fs';
import path from 'node:path';

const fnDir = path.resolve(process.argv[2] ?? '');
const payloadPath = path.join(fnDir, '.deploy-payload.json');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
process.stdout.write(JSON.stringify(payload));
