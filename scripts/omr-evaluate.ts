import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Score } from '../src/types/music';
import type { OmrScoreIR, OmrWarning } from '../src/omr/omrDecode';
import type { MusicalReference } from './omr-reference-check';
import {
  aggregateMetricsByCategory,
  evaluateAgainstReference,
  type OmrEvaluationReport,
} from './omr-metrics';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const runDir = option('--run');
const referencePath = option('--reference');
const outPath = option('--out');
const sampleId = option('--sample') ?? (runDir ? path.basename(path.resolve(runDir)) : 'sample');
const clef = option('--clef');
const condition = option('--condition') ?? 'clean';
const sourceType = option('--source-type');
const partition = option('--partition') ?? 'validation';

assert(
  runDir && referencePath,
  'Uso: pnpm omr:evaluate --run carpeta-benchmark-o-ui --reference ground-truth.json [--out evaluation.json] [--sample id]'
);

const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8')) as MusicalReference;
const scorePath = path.join(runDir, 'score.json');
assert(fs.existsSync(scorePath), `Falta score.json en ${runDir}`);
const score = JSON.parse(fs.readFileSync(scorePath, 'utf8')) as Score;

const irPath = path.join(runDir, 'ir.json');
const ir = fs.existsSync(irPath)
  ? (JSON.parse(fs.readFileSync(irPath, 'utf8')) as OmrScoreIR)
  : null;

const conversionPath = path.join(runDir, 'conversion.json');
const conversion = fs.existsSync(conversionPath)
  ? (JSON.parse(fs.readFileSync(conversionPath, 'utf8')) as { warnings?: OmrWarning[] })
  : null;

const statsPath = path.join(runDir, 'stats.json');
const stats = fs.existsSync(statsPath)
  ? (JSON.parse(fs.readFileSync(statsPath, 'utf8')) as {
      sourceType?: string;
      score?: { modelConfidence?: number };
    })
  : null;

const externalPath = path.join(runDir, 'external.json');
const external = fs.existsSync(externalPath)
  ? (JSON.parse(fs.readFileSync(externalPath, 'utf8')) as {
      confidence?: number;
      sourceType?: string;
    })
  : null;

const modelConfidence = stats?.score?.modelConfidence ?? external?.confidence ?? null;

const report: OmrEvaluationReport = evaluateAgainstReference({
  sampleId,
  reference,
  score,
  ir,
  warnings: conversion?.warnings ?? ir?.warnings,
  modelConfidence,
  category: {
    clef: clef ?? (reference as { clef?: string }).clef ?? 'unknown',
    condition,
    sourceType: sourceType ?? stats?.sourceType ?? external?.sourceType ?? 'image',
    partition,
  },
});

const categoryBreakdown = aggregateMetricsByCategory([report]);
const output = {
  report,
  categoryBreakdown,
};

if (outPath) {
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
}
console.log(JSON.stringify(output, null, 2));
