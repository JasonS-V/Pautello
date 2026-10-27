import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { checkReference, type MusicalReference } from './omr-reference-check';

const input = process.argv[process.argv.indexOf('--input') + 1];
assert(
  process.argv.includes('--input') && input,
  'Uso: pnpm omr:reference --input ground-truth.json'
);
const reference = JSON.parse(fs.readFileSync(input, 'utf8')) as MusicalReference;
const summary = checkReference(reference);
for (const source of [reference.source, reference.source.raster]) {
  if (!source.path) continue;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(source.path)).digest('hex');
  assert.equal(hash, source.sha256, `Hash de fuente discrepante: ${source.path}`);
}
console.log(JSON.stringify(summary, null, 2));
