import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as ort from 'onnxruntime-web/wasm';
import { openBenchmarkInput } from './omr-benchmark-input';
import { evaluateAgainstReference } from './omr-metrics';
import { preprocessPage } from '../src/omr/omrPreprocess';
import { composeTransform, invertTransform, mapBox, rotatePage } from '../src/omr/omrGeometry';
import {
  assembleIR,
  decodeLine,
  i2wFromVocab,
  lineFragment,
  type OmrDecodedLine,
} from '../src/omr/omrDecode';
import { mergeStaffWindows } from '../src/omr/omrWindows';
import { assignPartIdentities } from '../src/omr/omrParts';
import { convertOmrIrToScore } from '../src/omr/omrToScore';

const outputIndex = process.argv.indexOf('--out');
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
assert(output && !fs.existsSync(output), 'Indica --out con un archivo nuevo.');
const corpusPath = fs.existsSync('tasks/omr-corpus.json')
  ? 'tasks/omr-corpus.json'
  : 'src/omr/__tests__/fixtures/omr-corpus.json';
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
const samples = corpus.entries.filter((e: { id: string }) => e.id.startsWith('pdmx-line-'));
ort.env.wasm.numThreads = 1;
const vocab = JSON.parse(fs.readFileSync('public/omr/vocab.json', 'utf8')).tokens;
const i2w = i2wFromVocab(vocab);
const session = await ort.InferenceSession.create(
  new Uint8Array(fs.readFileSync('public/omr/omr-line.fp32.onnx')),
  { executionProviders: ['wasm'] }
);
const rows = [];
try {
  for (const sample of samples) {
    assert(fs.existsSync(sample.source.path), `Falta ${sample.source.path}; prepara el corpus.`);
    const source = await openBenchmarkInput(sample.source.path);
    const raster = await source.rasterize(1);
    for (const variant of [
      'original',
      'local',
      'adaptive',
      'auto',
      'mask-proposals',
      'windows-700',
      'long-line',
    ] as const) {
      if (variant === 'long-line' && sample.id !== 'pdmx-line-clean') continue;
      let inputRaster = raster;
      if (variant === 'long-line') {
        const gray = new Float32Array(raster.width * 4 * raster.height);
        for (let y = 0; y < raster.height; y++)
          for (let copy = 0; copy < 4; copy++)
            gray.set(
              raster.gray.subarray(y * raster.width, (y + 1) * raster.width),
              y * raster.width * 4 + copy * raster.width
            );
        inputRaster = { gray, width: raster.width * 4, height: raster.height };
      }
      const contrast =
        variant === 'original' || variant === 'local' || variant === 'adaptive'
          ? variant
          : undefined;
      const prep = preprocessPage(inputRaster.gray, inputRaster.width, inputRaster.height, {
        contrast,
        maxWidth: variant === 'windows-700' ? 700 : undefined,
      });
      if (variant === 'long-line') {
        assert(prep.inputs.length > 1);
        assert(prep.inputs[0].window.fullWidth > 3600);
        assert.equal(
          prep.inputs[prep.inputs.length - 1].window.end,
          prep.inputs[0].window.fullWidth
        );
      }
      const lines: OmrDecodedLine[] = [];
      const grouped = new Map<number, OmrDecodedLine[]>();
      for (const input of prep.inputs) {
        assert(!input.truncated);
        const data = Float32Array.from(input.data);
        if (variant === 'mask-proposals')
          for (const mask of prep.masks) {
            const toNormalized = composeTransform(
              invertTransform(input.normalizedToOriginal),
              prep.processedToOriginal
            );
            const [x, y, w, h] = mapBox(toNormalized, mask.bbox);
            for (
              let row = Math.max(0, Math.floor(y));
              row < Math.min(input.height, Math.ceil(y + h));
              row++
            )
              for (
                let col = Math.max(0, Math.floor(x));
                col < Math.min(input.width, Math.ceil(x + w));
                col++
              )
                data[row * input.width + col] = 0;
          }
        const tensor = new ort.Tensor('float32', data, [1, 1, input.height, input.width]);
        const result = await session.run({ [session.inputNames[0]]: tensor });
        const logits = result[session.outputNames[0]];
        const tokens = decodeLine(logits.data as Float32Array, logits.dims[1], logits.dims[2], i2w);
        const staff = {
          page: 1,
          system: input.box.system,
          staffIndex: input.box.voice,
          bbox: mapBox(prep.processedToOriginal, [
            input.box.x,
            input.box.y,
            input.box.w,
            input.box.h,
          ]),
          lineSpacingPx: input.box.lineSpacing,
          normSpacing: 10,
          window: input.window,
          normalizedToOriginal: input.normalizedToOriginal,
        };
        const windows = grouped.get(input.box.staff) ?? [];
        windows.push({ staff, elements: lineFragment(tokens, staff) });
        grouped.set(input.box.staff, windows);
        tensor.dispose();
        for (const value of Object.values(result)) value.dispose();
      }
      for (const windows of grouped.values()) lines.push(mergeStaffWindows(windows));
      const ir = assembleIR(assignPartIdentities(lines));
      const converted = convertOmrIrToScore(ir);
      const evaluation =
        sample.label.referencePath && variant !== 'long-line'
          ? evaluateAgainstReference({
              sampleId: sample.id,
              reference: JSON.parse(fs.readFileSync(sample.label.referencePath, 'utf8')),
              score: converted.score,
              ir,
              category: {
                clef: sample.category.clef,
                condition: sample.category.condition,
                sourceType: 'image',
                partition: 'validation',
              },
            })
          : null;
      rows.push({
        sample: sample.id,
        requestedContrast: variant,
        selectedContrast: prep.contrast.selected,
        scores: prep.contrast.scores,
        staves: prep.boxes.length,
        systems: prep.systems.length,
        windows: prep.inputs.length,
        notes: converted.notesCount,
        pendingRegions: prep.regions.filter((r) => r.route === 'review').length,
        exactMatchRate: evaluation?.events.exact.matchRate ?? null,
        pitchDurationRate: evaluation?.events.pitchAndDuration.matchRate ?? null,
        deskew: prep.deskewAngleDeg,
        regionsCovered: prep.regions.length,
        joinWarnings: ir.warnings.filter((w) => w.code === 'window-join-ambiguous').length,
        appliedMasks: variant === 'mask-proposals' ? prep.masks.length : 0,
      });
    }
  }
  const original = rows.find(
    (r) => r.sample === 'pdmx-line-clean' && r.requestedContrast === 'original'
  )!;
  const automatic = rows.find(
    (r) => r.sample === 'pdmx-line-clean' && r.requestedContrast === 'auto'
  )!;
  assert.equal(automatic.exactMatchRate, original.exactMatchRate, 'No degradar la imagen limpia.');
  assert.equal(automatic.notes, 9, 'La línea limpia conserva las 9 notas.');
  assert(rows.filter((r) => r.requestedContrast === 'auto').every((r) => r.appliedMasks === 0));
  const fixture = await (
    await openBenchmarkInput('src/omr/__tests__/fixtures/line.png')
  ).rasterize(1);
  for (const angle of [90, 180, 270]) {
    const rotated = rotatePage(fixture.gray, fixture.width, fixture.height, angle);
    const prep = preprocessPage(rotated.gray, rotated.width, rotated.height, {
      rotation: angle === 180 ? 180 : undefined,
    });
    assert.equal(prep.boxes.length, 1, `Giro ${angle}: pauta completa.`);
  }
  fs.writeFileSync(
    output,
    JSON.stringify({ version: 1, model: 'fp32', confidenceIsAccuracy: false, rows }, null, 2) + '\n'
  );
  console.log(
    JSON.stringify(
      rows.map(({ scores, ...row }) => row),
      null,
      2
    )
  );
} finally {
  await session.release();
}
