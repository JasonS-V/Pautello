import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { readNativeMusicXml } from './omr-engine-comparison';
import { alignSequences, extractReferenceEvents, evaluateAgainstReference } from './omr-metrics';
import type { NormalizedEvalEvent } from './omr-metrics';
import type { OmrCorpusManifest } from './omr-corpus-check';
import { importMusicXmlToScore } from '../src/utils/musicxml';

const option = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const home = option('--audiveris-home'),
  tessdata = option('--tessdata'),
  out = option('--out');
assert(
  home && tessdata && out && !fs.existsSync(out),
  'Uso: --audiveris-home carpeta-portable --tessdata carpeta --out carpeta-nueva'
);
assert(
  fs.existsSync(path.join(tessdata, 'eng.traineddata')),
  'Falta OCR eng.traineddata preparado localmente.'
);
const java = path.resolve(home, 'runtime/bin/java.exe');
assert(fs.existsSync(java), 'Falta el runtime local de Audiveris.');
fs.mkdirSync(out, { recursive: true });
const corpus: OmrCorpusManifest = JSON.parse(fs.readFileSync('tasks/omr-corpus.json', 'utf8'));
const samples = corpus.entries.filter((e) =>
  [
    'pdmx-line-clean',
    'qdrt-guitarron-pdf',
    'usted-es-la-culpable-jpeg',
    'el-rey-guitarron-pdf',
  ].includes(e.id)
);
const dom = new JSDOM('');
globalThis.DOMParser = dom.window.DOMParser;
const hash = (file: string) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const nativeKey = (e: NormalizedEvalEvent, exact: boolean) =>
  `${e.pitch}|${exact ? e.accidental : ''}|${e.duration.join('/')}|${e.dots}|${exact ? e.tiedOut : ''}`;
const rows: object[] = [];
const persist = () =>
  fs.writeFileSync(
    path.join(out, 'results.json'),
    JSON.stringify(
      {
        version: 1,
        confidenceIsAccuracy: false,
        engine: 'Audiveris 5.11.0',
        maxHeapMiB: 2048,
        network: 'HTTP and HTTPS unavailable through localhost:9; inputs and eng OCR local',
        resources: [
          { path: 'app/audiveris.jar', sha256: hash(path.join(home, 'app/audiveris.jar')) },
          { path: 'eng.traineddata', sha256: hash(path.join(tessdata, 'eng.traineddata')) },
        ],
        rows,
      },
      null,
      2
    ) + '\n'
  );
for (const sample of samples) {
  assert.equal(hash(sample.source.path), sample.source.sha256);
  const dir = path.resolve(out, sample.id);
  fs.mkdirSync(dir);
  const started = performance.now();
  const args = [
    '-Djpackage.app-version=5.11.0',
    '--add-exports=java.desktop/sun.awt.image=ALL-UNNAMED',
    '--enable-native-access=ALL-UNNAMED',
    '-Dfile.encoding=UTF-8',
    '-Dhttp.proxyHost=127.0.0.1',
    '-Dhttp.proxyPort=9',
    '-Dhttps.proxyHost=127.0.0.1',
    '-Dhttps.proxyPort=9',
    '-Xmx2G',
    '-cp',
    path.resolve(home, 'app/*'),
    'Audiveris',
    '-batch',
    '-transcribe',
    '-export',
    '-output',
    dir,
    '--',
    path.resolve(sample.source.path),
  ];
  const run = spawnSync(java, args, {
    env: { ...process.env, TESSDATA_PREFIX: path.resolve(tessdata) },
    timeout: 120000,
    maxBuffer: 32 * 1024 * 1024,
    encoding: 'utf8',
    windowsHide: true,
  });
  const log = (run.stdout ?? '') + (run.stderr ?? '');
  const elapsedMs = performance.now() - started;
  fs.writeFileSync(path.join(dir, 'run.log'), log);
  if (run.status !== 0 || run.error) {
    rows.push({
      sample: sample.id,
      work: sample.workId,
      status: 'failed',
      elapsedMs,
      sourceSha256: sample.source.sha256,
      exitCode: run.status,
      error:
        run.error?.message ??
        log
          .split('\n')
          .filter((l) => /WARN|Error|interline/.test(l))
          .join('\n'),
      cli: args,
    });
    persist();
    console.log(`${sample.id}: failed, exit ${run.status}`);
    continue;
  }
  assert(
    !log.includes('No installed OCR languages') && !log.includes("Missing support for 'eng'"),
    'Audiveris no cargó los idiomas preparados.'
  );
  const mxl = fs.readdirSync(dir).filter((f) => f.endsWith('.mxl'));
  assert.equal(mxl.length, 1, `Salida MusicXML ausente/ambigua en ${sample.id}`);
  // Read a named member without extracting any archive path to disk.
  const xml = execFileSync(
    'python',
    [
      '-c',
      'import sys,zipfile,xml.etree.ElementTree as E; z=zipfile.ZipFile(sys.argv[1]); c=E.fromstring(z.read("META-INF/container.xml")); n=next(e.attrib["full-path"] for e in c.iter() if e.tag.split("}")[-1]=="rootfile"); sys.stdout.buffer.write(z.read(n))',
      path.join(dir, mxl[0]),
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true }
  );
  fs.writeFileSync(path.join(dir, 'native.musicxml'), xml);
  const native = readNativeMusicXml(xml, new DOMParser());
  const score = importMusicXmlToScore(xml);
  fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(score));
  const reference = sample.label.referencePath
    ? JSON.parse(fs.readFileSync(sample.label.referencePath, 'utf8'))
    : null;
  const category = {
    ...sample.category,
    sourceType: sample.source.sourceType,
    partition: sample.partition,
  };
  const imported = reference
    ? evaluateAgainstReference({ sampleId: sample.id, reference, score, category })
    : null;
  const nativeMetric = (exact: boolean) =>
    reference
      ? alignSequences(
          extractReferenceEvents(reference),
          native.events,
          (a, b) => nativeKey(a, exact) === nativeKey(b, exact),
          {
            definition: exact
              ? 'Eventos nativos con alteración impresa, figura, puntillos y ligadura.'
              : 'Altura, figura y puntillos nativos.',
            denominator: 'Eventos de la referencia aprobada',
            sourceOfTruth: reference.id,
          }
        )
      : null;
  const exact = nativeMetric(true),
    pitchDuration = nativeMetric(false);
  const row = {
    sample: sample.id,
    work: sample.workId,
    category,
    elapsedMs,
    sourceSha256: sample.source.sha256,
    outputSha256: hash(path.join(dir, mxl[0])),
    native: {
      exact: exact?.matchRate ?? null,
      pitchDuration: pitchDuration?.matchRate ?? null,
      eventEdits: exact ? exact.substitutions + exact.deletions + exact.insertions : null,
      events: native.events.length,
      measures: native.measures,
      systems: native.systems,
      parts: native.parts,
      directions: native.directions,
      skippedVoices: native.skippedVoices,
      unsupportedRhythms: native.unsupportedRhythms,
    },
    imported: imported
      ? {
          exact: imported.events.exact.matchRate,
          pitchDuration: imported.events.pitchAndDuration.matchRate,
          eventEdits: imported.humanEffort.estimatedEventEdits,
          estimatedEdits: imported.humanEffort.totalEstimatedEdits,
          measures: imported.structure.detectedMeasures,
        }
      : { measures: score.staves[0]?.measures.length },
    actualCorrectionSeconds: null,
  };
  rows.push(row);
  fs.writeFileSync(
    path.join(dir, 'evaluation.json'),
    JSON.stringify({ row, exact, pitchDuration, imported }, null, 2)
  );
  persist();
  console.log(
    `${sample.id}: native=${row.native.exact}, imported=${row.imported.exact}, ${Math.round(elapsedMs)}ms`
  );
}
dom.window.close();
