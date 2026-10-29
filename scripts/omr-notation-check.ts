import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { openBenchmarkInput } from './omr-benchmark-input';
import { preprocessPage } from '../src/omr/omrPreprocess';
import { mapPoint } from '../src/omr/omrGeometry';
import { inspectNotation, withNotationEvidence } from '../src/omr/omrNotationGeometry';
import type { OmrScoreIR } from '../src/omr/omrDecode';

const option = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const run = option('--run'),
  out = option('--out');
assert(run && out && !fs.existsSync(out), 'Uso: --run carpeta-ablaciones --out archivo-nuevo');
const ref = JSON.parse(
  fs.readFileSync('src/omr/__tests__/fixtures/line-visual-reference.json', 'utf8')
);
const source = await openBenchmarkInput('src/omr/__tests__/fixtures/line.png');
assert.equal(crypto.createHash('sha256').update(source.bytes).digest('hex'), ref.sourceSha256);
const raster = await source.rasterize(1);
const prep = preprocessPage(raster.gray, raster.width, raster.height);
const result: { ir: OmrScoreIR } = JSON.parse(
  fs.readFileSync(`${run}/pdmx-line-clean-baseline-greedy.json`, 'utf8')
);
const line = result.ir.lines![0],
  inp = prep.inputs[0];
const evidence = inspectNotation(inp.data, inp.width, inp.height, 10, line.elements);
const geometricBars = evidence.bars
  .map((b) => mapPoint(inp.normalizedToOriginal, b.x, 64)[0])
  .filter((x) => x > 100);
const ctcBars = line.elements
  .filter((e) => e.kind === 'barline' && e.src && e.src.bbox[0] > 100)
  .map((e) => e.src!.bbox[0] + e.src!.bbox[2] / 2);
const match = (predicted: number[]) => {
  const remaining = new Set<number>(predicted.map((_, i) => i));
  let matched = 0;
  for (const x of ref.bars) {
    const candidates = [...remaining]
      .filter((i) => Math.abs(predicted[i] - x) <= ref.barTolerancePx)
      .sort((a, b) => Math.abs(predicted[a] - x) - Math.abs(predicted[b] - x));
    if (candidates.length) {
      matched++;
      remaining.delete(candidates[0]);
    }
  }
  return {
    matched,
    expected: ref.bars.length,
    predicted: predicted.length,
    recall: matched / ref.bars.length,
    falsePositives: remaining.size,
  };
};
const geometric = match(geometricBars),
  ctc = match(ctcBars);
const attached = withNotationEvidence(inp.data, inp.width, inp.height, line.staff, line.elements);
assert.deepEqual(
  attached.elements,
  line.elements,
  'Los diagnósticos no deben modificar notas o duraciones.'
);
const report = {
  version: 1,
  reference: 'line-visual-reference.json',
  tolerancePx: ref.barTolerancePx,
  geometric,
  ctc,
  geometricBars,
  ctcBars,
  alternatives: evidence.alternatives,
  headMatched: evidence.alternatives.filter((a) => {
    const notes = line.elements.filter((e) => e.kind === 'note');
    const note = line.elements[a.element];
    const index = notes.indexOf(note);
    return index >= 0 && a.head === ref.heads[index]?.head;
  }).length,
  sourceNotes: ref.heads.length,
  notesAdded: 0,
  durationsChanged: 0,
  decision:
    'Geometría como evidencia y avisos; sin reparaciones automáticas de barras o duraciones.',
};
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    geometric,
    ctc,
    headMatched: report.headMatched,
    sourceNotes: report.sourceNotes,
  })
);
