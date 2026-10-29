import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import * as ort from 'onnxruntime-web/wasm';
import { imageDecoderVersion, openBenchmarkInput } from './omr-benchmark-input';
import {
  INK_THRESHOLD,
  MAX_WIDTH,
  TARGET_HEIGHT,
  TARGET_SPACING,
  preprocessPage,
} from '../src/omr/omrPreprocess';
import {
  IR_VERSION,
  assembleIR,
  decodeLine,
  i2wFromVocab,
  lineFragment,
} from '../src/omr/omrDecode';
import { convertOmrIrToScore } from '../src/omr/omrToScore';
import { mapBox } from '../src/omr/omrGeometry';
import { mergeStaffWindows } from '../src/omr/omrWindows';
import { withNotationEvidence } from '../src/omr/omrNotationGeometry';
import { assignPartIdentities } from '../src/omr/omrParts';
import type { OmrDecodedLine } from '../src/omr/omrDecode';
import {
  type OmrModelManifest,
  verifyModelOutputCompatibility,
  verifyVocabularyAgainstManifest,
} from '../src/omr/omrModelContract';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const input = option('--input');
const output = option('--out');
const variant = option('--variant') ?? 'fp32';
const poppler = option('--poppler') ?? 'pdftoppm';
const maxWidth = Number(option('--max-width') ?? MAX_WIDTH);
if (!input || !output || !['fp32', 'int8'].includes(variant)) {
  throw new Error(
    'Uso: pnpm omr:benchmark --input archivo.pdf|png|jpg|jpeg|webp|svg --out carpeta-nueva [--variant fp32|int8] [--poppler ruta]'
  );
}
if (fs.existsSync(output)) throw new Error(`La carpeta de salida ya existe: ${output}`);

const sha256 = (data: Uint8Array | string) =>
  crypto.createHash('sha256').update(data).digest('hex');
const asset = (name: string) => {
  const bytes = fs.readFileSync(path.join('public', 'omr', name));
  return { path: `public/omr/${name}`, bytes: bytes.length, sha256: sha256(bytes) };
};
const version = (name: string) =>
  JSON.parse(fs.readFileSync(path.join('node_modules', name, 'package.json'), 'utf8'))
    .version as string;
const codePaths = [
  'scripts/omr-benchmark.ts',
  'scripts/omr-benchmark-input.ts',
  'src/omr/omrPreprocess.ts',
  'src/omr/omrGeometry.ts',
  'src/omr/omrContrast.ts',
  'src/omr/omrParts.ts',
  'src/omr/omrWindows.ts',
  'src/omr/omrNotationGeometry.ts',
  'src/omr/omrDecode.ts',
  'src/omr/omrModelContract.ts',
  'src/omr/omrToScore.ts',
  'src/omr/scorePayloadCodec.ts',
  'src/types/music.ts',
  'src/constants/pitches.ts',
  'src/utils/scoreSchema.ts',
  'src/utils/measureTiming.ts',
  'src/utils/keyDetection.ts',
  'src/utils/chordUtils.ts',
];
const write = (name: string, value: unknown) =>
  fs.writeFileSync(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`);
const now = () => performance.now();

// Score genera IDs y fechas; estos campos no forman parte de la comparación musical.
function semantic(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(semantic);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
        .map(([key, child]) => [key, semantic(child)])
    );
  }
  return value;
}

const inspectStart = now();
const source = await openBenchmarkInput(input, poppler);
const inspectionMs = now() - inspectStart;
const { nativeScore } = source;
let popplerVersion: string | null = null;
if (source.rasterizer === 'pdftoppm -gray') {
  const result = spawnSync(poppler, ['-v'], { encoding: 'utf8' });
  if (result.error || result.status !== 0)
    throw new Error(`No se pudo ejecutar Poppler: ${result.error ?? result.stderr}`);
  popplerVersion = (result.stderr || result.stdout).trim().split(/\r?\n/)[0];
}
const manifest = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  code: codePaths.map((file) => ({ path: file, sha256: sha256(fs.readFileSync(file)) })),
  node: process.version,
  lockfileSha256: sha256(fs.readFileSync('pnpm-lock.yaml')),
  platform: {
    os: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
  },
  versions: {
    pdfjs: version('pdfjs-dist'),
    ort: version('onnxruntime-web'),
    poppler: popplerVersion,
    imageDecoder: source.rasterizer === '@napi-rs/canvas' ? imageDecoderVersion() : null,
  },
  input: {
    path: path.resolve(input),
    bytes: source.bytes.length,
    sha256: sha256(source.bytes),
    format: source.format,
    pages: source.pages,
    textCharacters: source.textCharacters,
    sourceType: source.sourceType,
  },
  model: nativeScore ? null : asset(`omr-line.${variant}.onnx`),
  vocab: nativeScore ? null : asset('vocab.json'),
  modelManifest: nativeScore ? null : asset('model-manifest.json'),
  preprocessing: nativeScore
    ? null
    : {
        inkThreshold: INK_THRESHOLD,
        targetSpacing: TARGET_SPACING,
        targetHeight: TARGET_HEIGHT,
        maxWidth,
        deskew: true,
        rasterDpi: source.format === 'pdf' ? 172.8 : null,
        rasterizer: source.rasterizer,
        smallImageScale: null,
      },
  irVersion: IR_VERSION,
  runtime: nativeScore
    ? null
    : { executionProvider: 'wasm', numThreads: 1, graphOptimizationLevel: 'all' },
};
fs.mkdirSync(output, { recursive: true });
write('manifest.json', manifest);
if (nativeScore) {
  write('score.json', nativeScore);
  write('semantic.json', semantic(nativeScore));
  write('stats.json', {
    sourceType: source.sourceType,
    inferenceExecuted: false,
    inspectionMs,
    pagesProcessed: 0,
    modelLoadMs: null,
    modelWarmLoadMs: null,
    semanticSha256: sha256(JSON.stringify(semantic(nativeScore))),
  });
  console.log('Restauración nativa detectada; no se ejecutó OMR.');
} else {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pautello-omr-'));
  try {
    const modelManifest = JSON.parse(
      fs.readFileSync(path.join('public', 'omr', 'model-manifest.json'), 'utf8')
    ) as OmrModelManifest;
    const vocab = JSON.parse(fs.readFileSync(path.join('public', 'omr', 'vocab.json'), 'utf8'))
      .tokens as string[];
    verifyVocabularyAgainstManifest(vocab, modelManifest);
    const i2w = i2wFromVocab(vocab);
    ort.env.wasm.numThreads = 1;
    const modelBytes = new Uint8Array(
      fs.readFileSync(path.join('public', 'omr', `omr-line.${variant}.onnx`))
    );
    const loadStart = now();
    const session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    const modelLoadMs = now() - loadStart;
    const lines: OmrDecodedLine[] = [];
    const decodedLines = [];
    const pages = [];
    try {
      for (let pageNumber = 1; pageNumber <= source.pages; pageNumber++) {
        const rasterStart = now();
        const raster = await source.rasterize(pageNumber, temp);
        const rasterMs = now() - rasterStart;
        const preprocessStart = now();
        const prepared = preprocessPage(raster.gray, raster.width, raster.height, { maxWidth });
        const preprocessMs = now() - preprocessStart;
        const lineStats = [];
        const staffWindows = new Map<number, OmrDecodedLine[]>();
        for (const staffInput of prepared.inputs) {
          const inferenceStart = now();
          const tensor = new ort.Tensor('float32', staffInput.data, [
            1,
            1,
            staffInput.height,
            staffInput.width,
          ]);
          const result = await session.run({ [session.inputNames[0]]: tensor });
          const logits = result[session.outputNames[0]];
          verifyModelOutputCompatibility({
            vocabTokensCount: vocab.length,
            outputDims: logits.dims,
            inputNames: session.inputNames,
            outputNames: session.outputNames,
            manifest: modelManifest,
          });
          const inferenceMs = now() - inferenceStart;
          const decodeStart = now();
          const tokens = decodeLine(
            logits.data as Float32Array,
            logits.dims[1],
            logits.dims[2],
            i2w
          );
          tensor.dispose();
          for (const value of Object.values(result)) value.dispose();
          const staff = {
            page: pageNumber,
            system: staffInput.box.system,
            staffIndex: staffInput.box.voice,
            bbox: mapBox(prepared.processedToOriginal, [
              staffInput.box.x,
              staffInput.box.y,
              staffInput.box.w,
              staffInput.box.h,
            ]),
            lineSpacingPx: staffInput.box.lineSpacing,
            normSpacing: TARGET_SPACING,
            truncated: staffInput.truncated,
            window: staffInput.window,
            normalizedToOriginal: staffInput.normalizedToOriginal,
          };
          const elements = lineFragment(tokens, staff);
          const windows = staffWindows.get(staffInput.box.staff) ?? [];
          windows.push(
            withNotationEvidence(
              staffInput.data,
              staffInput.width,
              staffInput.height,
              staff,
              elements
            )
          );
          staffWindows.set(staffInput.box.staff, windows);
          decodedLines.push({ staff, tokens });
          lineStats.push({
            system: staff.system,
            staff: staff.staffIndex,
            tokens: tokens.length,
            records: tokens.filter((token) => token.token === '<b>').length,
            elements: elements.length,
            unparseable: elements.filter((element) => element.kind === 'unparseable').length,
            truncated: staff.truncated,
            tensor: [staffInput.height, staffInput.width],
            inferenceMs,
            decodeMs: now() - decodeStart,
          });
        }
        for (const windows of staffWindows.values()) lines.push(mergeStaffWindows(windows));
        pages.push({
          page: pageNumber,
          raster: [raster.width, raster.height],
          graySha256: sha256(
            new Uint8Array(raster.gray.buffer, raster.gray.byteOffset, raster.gray.byteLength)
          ),
          rasterMs,
          preprocessMs,
          threshold: prepared.usedThreshold,
          deskewDeg: prepared.deskewAngleDeg,
          systems: prepared.systems.length,
          staves: prepared.boxes.length,
          boxes: prepared.boxes,
          contrast: prepared.contrast,
          orientation: prepared.orientation,
          originalToProcessed: prepared.originalToProcessed,
          regions: prepared.regions,
          masks: prepared.masks,
          lineStats,
        });
      }
    } finally {
      await session.release();
    }
    const warmLoadStart = now();
    const warmSession = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    const modelWarmLoadMs = now() - warmLoadStart;
    await warmSession.release();
    const assembleStart = now();
    const ir = assembleIR(assignPartIdentities(lines));
    const assembleMs = now() - assembleStart;
    const convertStart = now();
    const converted = convertOmrIrToScore(ir, {
      title: path.parse(input).name.replace(/[_-]+/g, ' ').trim(),
    });
    const convertMs = now() - convertStart;
    const semanticScore = semantic(converted.score);
    write('decoded-lines.json', decodedLines);
    write('ir.json', ir);
    write('score.json', converted.score);
    write('conversion.json', {
      warnings: converted.warnings,
      proposals: converted.proposals,
      report: converted.report,
      sourceLinks: converted.sourceLinks,
      metadataHints: converted.metadataHints,
    });
    write('semantic.json', semanticScore);
    write('stats.json', {
      sourceType: source.sourceType,
      inferenceExecuted: true,
      inspectionMs,
      modelLoadMs,
      modelWarmLoadMs,
      pages,
      assembleMs,
      convertMs,
      ir: {
        parts: ir.parts.length,
        measures: ir.parts.map((part) => part.measures.length),
        events: ir.parts
          .flatMap((part) => part.measures)
          .reduce((sum, measure) => sum + measure.events.length, 0),
        warnings: ir.warnings,
      },
      score: {
        staves: converted.stavesCount,
        measures: converted.measuresCount,
        notes: converted.notesCount,
        modelConfidence: converted.averageConfidence,
      },
      semanticSha256: sha256(JSON.stringify(semanticScore)),
    });
    console.log(
      `OMR ${variant}: ${converted.measuresCount} compases, ${converted.notesCount} notas; resultados en ${path.resolve(output)}`
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
