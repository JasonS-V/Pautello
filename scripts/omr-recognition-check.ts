import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as ort from 'onnxruntime-web/wasm';
import { openBenchmarkInput } from './omr-benchmark-input';
import { alignSequences, evaluateAgainstReference, extractReferenceEvents } from './omr-metrics';
import type { MusicalReference } from './omr-reference-check';
import type { OmrCorpusManifest } from './omr-corpus-check';
import { assertOmrCiGate, assertOmrRobustnessGate } from './omr-ci-gate';
import { preprocessPage, resizeBilinear } from '../src/omr/omrPreprocess';
import { mapBox } from '../src/omr/omrGeometry';
import {
  assembleIR,
  decodeLine,
  i2wFromVocab,
  lineFragment,
  type OmrDecodedLine,
  type OmrElementIR,
} from '../src/omr/omrDecode';
import { decodeBeam } from '../src/omr/omrBeam';
import { inspectNotation } from '../src/omr/omrNotationGeometry';
import { mergeStaffWindows } from '../src/omr/omrWindows';
import { assignPartIdentities } from '../src/omr/omrParts';
import { convertOmrIrToScore } from '../src/omr/omrToScore';
import {
  verifyModelOutputCompatibility,
  verifyVocabularyAgainstManifest,
} from '../src/omr/omrModelContract';

const option = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const out = option('--out');
assert(out && !fs.existsSync(out), 'Indica --out con una carpeta nueva.');
fs.mkdirSync(out, { recursive: true });
const hash = (bytes: Uint8Array | string) =>
  crypto.createHash('sha256').update(bytes).digest('hex');
const code = [
  'scripts/omr-recognition-check.ts',
  'scripts/omr-metrics.ts',
  'src/omr/omrBeam.ts',
  'src/omr/omrNotationGeometry.ts',
  'src/omr/omrPreprocess.ts',
  'src/omr/omrDecode.ts',
  'src/omr/omrToScore.ts',
  'src/omr/omrParts.ts',
  'src/omr/omrWindows.ts',
].map((p) => ({ path: p, sha256: hash(fs.readFileSync(p)) }));
const corpusPath =
  option('--corpus') ??
  (fs.existsSync('tasks/omr-corpus.json')
    ? 'tasks/omr-corpus.json'
    : 'src/omr/__tests__/fixtures/omr-corpus.json');
const corpus: OmrCorpusManifest = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
const acceptance = option('--acceptance') === 'true';
const selectedIds = (option('--sample') ?? option('--samples'))?.split(/[\s,]+/);
const publicRobustness = process.argv.includes('--public-robustness');
const samples = corpus.entries.filter((e) =>
  publicRobustness
    ? e.id.startsWith('pdmx-line-') && Boolean(e.label.referencePath)
    : selectedIds
      ? selectedIds.includes(e.id)
      : acceptance
        ? e.id === 'el-rey-guitarron-pdf'
        : e.partition === 'validation' &&
          (e.id.startsWith('pdmx-line-') || e.label.referencePath || e.category.clef === 'F4')
);
assert(samples.length > 0);
const manifest = JSON.parse(fs.readFileSync('public/omr/model-manifest.json', 'utf8'));
const vocab = JSON.parse(fs.readFileSync('public/omr/vocab.json', 'utf8')).tokens;
verifyVocabularyAgainstManifest(vocab, manifest);
const i2w = i2wFromVocab(vocab);
ort.env.wasm.numThreads = 1;
const model = fs.readFileSync(manifest.variants.fp32.path);
assert.equal(hash(model), manifest.variants.fp32.sha256);
assert.equal(hash(fs.readFileSync(manifest.vocabulary.path)), manifest.vocabulary.sha256);
const session = await ort.InferenceSession.create(new Uint8Array(model), {
  executionProviders: ['wasm'],
});
const ablations = acceptance
  ? ['baseline']
  : (option('--variants')?.split(',') ?? [
      'baseline',
      'resolution-075',
      'spacing-8',
      'spacing-12',
      'center-up-4',
      'center-down-4',
      'polarity',
      'margin-10',
      'mask',
      'contrast-original',
      'contrast-local',
      'contrast-adaptive',
    ]);
const valid = new Set([
  'baseline',
  'resolution-075',
  'spacing-8',
  'spacing-12',
  'center-up-4',
  'center-down-4',
  'polarity',
  'margin-10',
  'mask',
  'contrast-original',
  'contrast-local',
  'contrast-adaptive',
]);
assert(
  ablations.every((v) => valid.has(v)),
  'Ablación desconocida.'
);

const kernPitch = (step: string, octave: number) =>
  octave >= 4 ? step.toLowerCase().repeat(octave - 3) : step.repeat(4 - octave);
const eventRecord = (e: OmrElementIR) =>
  e.kind === 'barline'
    ? '='
    : e.kind === 'note' || e.kind === 'rest'
      ? `${e.duration.base}${'.'.repeat(e.duration.dots)}${e.pitch ? kernPitch(e.pitch.step, e.pitch.octave) : 'r'}${e.tokens?.filter((t) => ['#', '-', 'n', '##', '--'].includes(t)).join('') ?? ''}`
      : null;
const referenceRecords = (ref: MusicalReference) =>
  ref.systems.flatMap((s) =>
    s.measures.flatMap((m) => [
      ...m.events.map(
        (e) =>
          `${e.duration[1]}${'.'.repeat(e.dots)}${e.pitch ? kernPitch(e.pitch[0], Number(e.pitch[1])) : 'r'}${e.accidental === 'b' ? '-' : (e.accidental ?? '')}`
      ),
      '=',
    ])
  );
const compareRecords = (ref: string[], pred: string[]) => {
  // Initial/final staff bars and attributes are excluded on both sides.
  const clean = (records: string[]) =>
    records.filter((r, i) => !(r === '=' && (!i || records[i - 1] === '=')));
  const m = alignSequences(clean(ref), clean(pred), (a, b) => a === b, {
    definition:
      'Registros kern musicales sin cabeceras, barras iniciales, beaming ni ligaduras; antes/después del parser.',
    denominator: 'Eventos y límites de compás de la referencia',
    sourceOfTruth: 'Referencia F0 aprobada',
  });
  return {
    reference: m.referenceCount,
    predicted: m.predictedCount,
    matches: m.matches,
    edits: m.substitutions + m.deletions + m.insertions,
    matchRate: m.matchRate,
  };
};
const rows: Parameters<typeof assertOmrCiGate>[0] = [];
try {
  for (const sample of samples) {
    const input = await openBenchmarkInput(sample.source.path);
    assert.equal(hash(input.bytes), sample.source.sha256, `Fuente modificada: ${sample.id}`);
    const raster = await input.rasterize(1, out);
    const reference: MusicalReference | null = sample.label.referencePath
      ? JSON.parse(fs.readFileSync(sample.label.referencePath, 'utf8'))
      : null;
    for (const variant of ablations) {
      const started = performance.now();
      const scale = variant === 'resolution-075' ? 0.75 : 1;
      const w = Math.round(raster.width * scale),
        h = Math.round(raster.height * scale);
      const gray =
        scale === 1 ? raster.gray : resizeBilinear(raster.gray, raster.height, raster.width, h, w);
      const spacing = variant === 'spacing-8' ? 8 : variant === 'spacing-12' ? 12 : 10;
      const prep = preprocessPage(gray, w, h, {
        targetSpacing: spacing,
        contrast:
          variant === 'contrast-original'
            ? 'original'
            : variant === 'contrast-local'
              ? 'local'
              : variant === 'contrast-adaptive'
                ? 'adaptive'
                : undefined,
      });
      const decoded = new Map<string, Map<number, OmrDecodedLine[]>>();
      const rawRecords = new Map<string, string[]>();
      const geometry: object[] = [];
      const decodeMs: Record<string, number> = {};
      let inferenceMs = 0;
      for (const inp of prep.inputs) {
        let data = Float32Array.from(inp.data);
        if (variant === 'polarity') data = data.map((v) => 1 - v);
        if (variant.startsWith('center-')) {
          const shifted = new Float32Array(data.length),
            delta = variant === 'center-up-4' ? -4 : 4;
          for (let y = 0; y < inp.height; y++)
            if (y + delta >= 0 && y + delta < inp.height)
              shifted.set(
                data.subarray(y * inp.width, (y + 1) * inp.width),
                (y + delta) * inp.width
              );
          data = shifted;
        }
        if (variant === 'margin-10')
          for (let y = 0; y < inp.height; y++)
            if (y < 10 || y >= inp.height - 10) data.fill(0, y * inp.width, (y + 1) * inp.width);
        if (variant === 'mask') {
          // Same peripheral bands as F2; the full source remains intact.
          for (let y = 0; y < inp.height; y++)
            if (
              y < (128 - 4 * spacing) / 2 - spacing * 1.8 ||
              y > (128 + 4 * spacing) / 2 + spacing * 1.8
            )
              data.fill(0, y * inp.width, (y + 1) * inp.width);
        }
        const tensor = new ort.Tensor('float32', data, [1, 1, inp.height, inp.width]);
        const t = performance.now();
        const outputs = await session.run({ [session.inputNames[0]]: tensor });
        inferenceMs += performance.now() - t;
        try {
          const logits = outputs[session.outputNames[0]];
          verifyModelOutputCompatibility({
            vocabTokensCount: vocab.length,
            outputDims: logits.dims,
          });
          const staff = {
            page: 1,
            system: inp.box.system,
            staffIndex: inp.box.voice,
            bbox: mapBox(prep.processedToOriginal, [inp.box.x, inp.box.y, inp.box.w, inp.box.h]),
            lineSpacingPx: inp.box.lineSpacing,
            normSpacing: spacing,
            window: inp.window,
            normalizedToOriginal: inp.normalizedToOriginal,
          };
          for (const decoder of variant === 'baseline' &&
          !acceptance &&
          !process.argv.includes('--greedy-only')
            ? ['greedy', 'beam', 'grammar']
            : ['greedy']) {
            const begin = performance.now();
            const tokens =
              decoder === 'greedy'
                ? decodeLine(logits.data as Float32Array, logits.dims[1], logits.dims[2], i2w)
                : decodeBeam(logits.data as Float32Array, logits.dims[1], logits.dims[2], i2w, {
                    grammarPenalty: decoder === 'grammar' ? 2 : 0,
                  }).events;
            decodeMs[decoder] = (decodeMs[decoder] ?? 0) + performance.now() - begin;
            const records = tokens
              .map((e) => e.token)
              .join(' ')
              .split('<b>')
              .map((r) =>
                r
                  .trim()
                  .split(' ')
                  .filter((t) => !['L', 'J', 'K', 'k', '[', ']', '_'].includes(t))
                  .join('')
              )
              .filter((r) => r && !r.startsWith('*') && !r.startsWith('!'));
            rawRecords.set(decoder, [
              ...(rawRecords.get(decoder) ?? []),
              ...records.map((r) => (r.startsWith('=') ? '=' : r)),
            ]);
            const elements = lineFragment(tokens, staff);
            const grouped = decoded.get(decoder) ?? new Map<number, OmrDecodedLine[]>();
            grouped.set(inp.box.staff, [
              ...(grouped.get(inp.box.staff) ?? []),
              { staff, elements },
            ]);
            decoded.set(decoder, grouped);
            if (decoder === 'greedy' && variant === 'baseline') {
              const offset = inp.window.start - (inp.window.contextPrefix ?? 0);
              const local = elements.map((e) =>
                e.src?.normalizedRange
                  ? {
                      ...e,
                      src: {
                        ...e.src,
                        normalizedRange: e.src.normalizedRange.map((v) => v - offset) as [
                          number,
                          number,
                        ],
                      },
                    }
                  : e
              );
              geometry.push({
                system: inp.box.system,
                window: inp.window.index,
                ...inspectNotation(
                  data,
                  inp.width,
                  inp.height,
                  spacing,
                  local,
                  sample.category.clef === 'F4' ? 'F4' : 'G2'
                ),
              });
            }
          }
        } finally {
          tensor.dispose();
          for (const tensor of Object.values(outputs)) tensor.dispose();
        }
      }
      if (!decoded.size) {
        rows.push({
          sample: sample.id,
          variant,
          decoder: 'greedy',
          staves: prep.boxes.length,
          systems: prep.systems.length,
          measures: 0,
          exact: reference ? 0 : null,
          barMeasure: reference ? 0 : null,
          status: 'no-staff-detected',
        });
        console.log(`${sample.id} ${variant}: no se detectaron pautas; exact=0`);
      }
      for (const [decoder, grouped] of decoded) {
        const lines = [...grouped.values()].map(mergeStaffWindows);
        const ir = assembleIR(assignPartIdentities(lines));
        const converted = convertOmrIrToScore(ir);
        const evaluation = reference
          ? evaluateAgainstReference({
              sampleId: sample.id,
              reference,
              score: converted.score,
              ir,
              category: {
                ...sample.category,
                sourceType: sample.source.sourceType,
                partition: sample.partition,
              },
            })
          : null;
        const stem = `${sample.id}-${variant}-${decoder}`;
        const referenceEvents = reference ? extractReferenceEvents(reference) : [];
        const categories: Array<[string, (e: (typeof referenceEvents)[number]) => boolean]> = [
          ['hollow-head', (e) => e.pitch !== null && e.duration[1] <= 2],
          ['filled-head', (e) => e.pitch !== null && e.duration[1] >= 4],
          ['dotted', (e) => e.dots > 0],
          ['undotted', (e) => e.dots === 0],
          ['rests', (e) => e.pitch === null],
        ];
        const notationCategories = evaluation
          ? Object.fromEntries(
              categories.map(([category, predicate]) => {
                const operations = evaluation.events.exact.operations.filter(
                  (op) => op.refIndex !== undefined && predicate(referenceEvents[op.refIndex])
                );
                return [
                  category,
                  {
                    reference: operations.length,
                    matches: operations.filter((op) => op.type === 'match').length,
                    errors: operations.filter((op) => op.type !== 'match').length,
                  },
                ];
              })
            )
          : null;
        fs.writeFileSync(
          path.join(out, `${stem}.json`),
          JSON.stringify({ ir, score: converted.score, evaluation, geometry })
        );
        const row = {
          sample: sample.id,
          work: sample.workId,
          category: sample.category,
          partition: sample.partition,
          pagesProcessed: 1,
          sourceSha256: sample.source.sha256,
          variant,
          decoder,
          notationCategories,
          totalMs: performance.now() - started,
          inferenceMs,
          decodeMs: decodeMs[decoder],
          staves: prep.boxes.length,
          systems: prep.systems.length,
          windows: prep.inputs.length,
          recordsBeforeParser: reference
            ? compareRecords(referenceRecords(reference), rawRecords.get(decoder) ?? [])
            : null,
          recordsAfterParser: reference
            ? compareRecords(
                referenceRecords(reference),
                lines.flatMap((l) =>
                  l.elements.map(eventRecord).filter((e): e is string => e !== null)
                )
              )
            : null,
          exact: evaluation?.events.exact.matchRate ?? null,
          pitchDuration: evaluation?.events.pitchAndDuration.matchRate ?? null,
          duration: evaluation?.components.exactDuration.rate ?? null,
          measures: converted.score.staves[0]?.measures.length ?? 0,
          barMeasure: evaluation?.components.barlineAndMeasure.rate ?? null,
          eventEdits: evaluation?.humanEffort.estimatedEventEdits ?? null,
          estimatedEdits: evaluation?.humanEffort.totalEstimatedEdits ?? null,
          actualCorrectionSeconds: null,
          unparseable: lines.flatMap((l) => l.elements).filter((e) => e.kind === 'unparseable')
            .length,
          geometryDisagreements: geometry.reduce(
            (n, g) => n + (g as { disagreements: unknown[] }).disagreements.length,
            0
          ),
        };
        rows.push(row);
        console.log(
          `${sample.id} ${variant}/${decoder}: exact=${row.exact}, measures=${row.measures}, decode=${row.decodeMs.toFixed(0)}ms`
        );
      }
      fs.writeFileSync(
        path.join(out, 'results.json'),
        JSON.stringify(
          {
            version: 1,
            confidenceIsAccuracy: false,
            runtime: process.version,
            modelSha256: hash(model),
            vocabSha256: manifest.vocabulary.sha256,
            parameters: { beamWidth: 8, topK: 4, grammarPenalty: 2, ablations },
            code,
            rows,
          },
          null,
          2
        ) + '\n'
      );
    }
  }
  if (process.argv.includes('--gate')) assertOmrCiGate(rows);
  if (process.argv.includes('--robustness-gate')) assertOmrRobustnessGate(rows);
} finally {
  await session.release();
}
