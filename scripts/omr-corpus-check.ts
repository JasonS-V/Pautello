import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkReference, type MusicalReference } from './omr-reference-check';

export type CorpusPartition = 'training' | 'validation' | 'acceptance' | 'control';
export type CorpusAvailability = 'public-repo' | 'public-generated' | 'local-private';
export type CorpusRedistribution = 'public-domain' | 'synthetic-mit' | 'private-no-redistribution';
export type CorpusClef = 'F4' | 'G2' | 'multi' | 'none';
export type CorpusCondition =
  | 'clean'
  | 'low-contrast'
  | 'rotated'
  | 'compressed'
  | 'low-resolution'
  | 'short-system'
  | 'uneven-contrast'
  | 'broken-lines'
  | 'stains'
  | 'clipped-border'
  | 'large-header'
  | 'perspective'
  | 'non-music'
  | 'lossless-metadata';

export interface OmrCorpusEntry {
  id: string;
  workId: string;
  editionId: string;
  partition: CorpusPartition;
  availability: CorpusAvailability;
  redistribution: CorpusRedistribution;
  provenance: string;
  source: {
    path: string;
    sha256: string;
    format: 'pdf' | 'png' | 'jpeg' | 'webp' | 'svg';
    sourceType: 'lossless-metadata' | 'pdf-text' | 'pdf-image' | 'image';
    pages: number;
  };
  category: {
    clef: CorpusClef;
    density: 'low' | 'medium' | 'high' | 'none';
    condition: CorpusCondition;
    features: string[];
  };
  label: {
    referencePath?: string;
    expectedStaves?: number;
    expectedSystems?: number;
    expectedMeasures?: number;
    expectedNotes?: number;
    emptyPage?: boolean;
  };
}

export interface OmrCorpusManifest {
  version: number;
  policy: {
    acceptanceReservedWorkIds: string[];
    splitUnit: 'work-and-edition';
    notes: string;
  };
  entries: OmrCorpusEntry[];
}

interface CanvasModule {
  createCanvas: (
    width: number,
    height: number
  ) => {
    width: number;
    height: number;
    getContext: (type: '2d') => {
      fillStyle: string;
      strokeStyle: string;
      lineWidth: number;
      font: string;
      fillRect: (x: number, y: number, w: number, h: number) => void;
      strokeRect: (x: number, y: number, w: number, h: number) => void;
      fillText: (text: string, x: number, y: number) => void;
      translate: (x: number, y: number) => void;
      rotate: (angle: number) => void;
      drawImage: (...args: unknown[]) => void;
      getImageData: (
        x: number,
        y: number,
        w: number,
        h: number
      ) => {
        data: Uint8ClampedArray;
        width: number;
        height: number;
      };
      putImageData: (imageData: unknown, x: number, y: number) => void;
    };
    toBuffer: (mime: string, quality?: number) => Buffer;
  };
  loadImage: (source: Buffer | string) => Promise<{ width: number; height: number }>;
}

function loadCanvasModule(): CanvasModule {
  const require = createRequire(import.meta.url);
  const pdfjsEntry = require.resolve('pdfjs-dist/package.json');
  const pdfjsNodeModules = path.resolve(path.dirname(pdfjsEntry), '..');
  return require(require.resolve('@napi-rs/canvas', { paths: [pdfjsNodeModules] })) as CanvasModule;
}

const sha256Hex = (bytes: Uint8Array | string) =>
  crypto.createHash('sha256').update(bytes).digest('hex');

export async function generateControlledCorpusVariants(
  basePngPath: string,
  outDir: string
): Promise<Record<string, { path: string; sha256: string; width: number; height: number }>> {
  const { createCanvas, loadImage } = loadCanvasModule();
  fs.mkdirSync(outDir, { recursive: true });
  const baseBuffer = fs.readFileSync(basePngPath);
  const img = await loadImage(baseBuffer);
  const w = img.width;
  const h = img.height;

  const outputs: Record<string, { path: string; sha256: string; width: number; height: number }> =
    {};
  const savePng = (key: string, name: string, canvas: ReturnType<CanvasModule['createCanvas']>) => {
    const buf = canvas.toBuffer('image/png');
    const outPath = path.join(outDir, name);
    fs.writeFileSync(outPath, buf);
    outputs[key] = {
      path: outPath,
      sha256: sha256Hex(buf),
      width: canvas.width,
      height: canvas.height,
    };
  };

  // 1. Low contrast (faint ink compressed between 135 and 245)
  {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const mapped = Math.round(135 + (lum / 255) * 110);
      d[i] = mapped;
      d[i + 1] = mapped;
      d[i + 2] = mapped;
      d[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    const buf = canvas.toBuffer('image/png');
    const outPath = path.join(outDir, 'line-low-contrast.png');
    fs.writeFileSync(outPath, buf);
    outputs['low-contrast'] = { path: outPath, sha256: sha256Hex(buf), width: w, height: h };
  }

  // 2. Slight rotation (+1.2 degrees)
  {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate((1.2 * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(img, 0, 0);
    const buf = canvas.toBuffer('image/png');
    const outPath = path.join(outDir, 'line-rotated-1p2deg.png');
    fs.writeFileSync(outPath, buf);
    outputs['rotated'] = { path: outPath, sha256: sha256Hex(buf), width: w, height: h };
  }

  // 3. JPEG compression (quality 50)
  {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    const buf = canvas.toBuffer('image/jpeg', 50);
    const outPath = path.join(outDir, 'line-compressed-q50.jpg');
    fs.writeFileSync(outPath, buf);
    outputs['compressed'] = { path: outPath, sha256: sha256Hex(buf), width: w, height: h };
  }

  // 4. Low resolution (0.65x scale)
  {
    const lw = Math.round(w * 0.65);
    const lh = Math.round(h * 0.65);
    const canvas = createCanvas(lw, lh);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lw, lh);
    ctx.drawImage(img, 0, 0, lw, lh);
    const buf = canvas.toBuffer('image/png');
    const outPath = path.join(outDir, 'line-low-res-0p65x.png');
    fs.writeFileSync(outPath, buf);
    outputs['low-resolution'] = { path: outPath, sha256: sha256Hex(buf), width: lw, height: lh };
  }

  // 5. Short final system (first 2 measures cropped: 820 x 181)
  {
    const sw = 820;
    const canvas = createCanvas(sw, h);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sw, h);
    ctx.drawImage(img, 0, 0, sw, h, 0, 0, sw, h);
    const buf = canvas.toBuffer('image/png');
    const outPath = path.join(outDir, 'line-short-system.png');
    fs.writeFileSync(outPath, buf);
    outputs['short-system'] = { path: outPath, sha256: sha256Hex(buf), width: sw, height: h };
  }

  // Independent scan defects; keep the clean image and ground truth unchanged.
  {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const image = ctx.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const strength = 0.12 + 0.75 * (x / w);
        for (let channel = 0; channel < 3; channel++) {
          image.data[i + channel] = Math.round(255 - (255 - image.data[i + channel]) * strength);
        }
      }
    }
    ctx.putImageData(image, 0, 0);
    savePng('uneven-contrast', 'line-uneven-contrast.png', canvas);
  }
  {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = '#ffffff';
    for (const x of [530, 990, 1510])
      for (const y of [55, 73, 91, 109, 127]) ctx.fillRect(x, y, 24, 2);
    savePng('broken-lines', 'line-broken-lines.png', canvas);
  }
  {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = '#777777';
    for (const [x, y, size] of [
      [370, 20, 6],
      [860, 149, 10],
      [1250, 42, 8],
      [1850, 155, 5],
    ]) {
      ctx.fillRect(x, y, size, size);
    }
    savePng('stains', 'line-stains.png', canvas);
  }
  {
    const clipped = 72;
    const canvas = createCanvas(w - clipped, h);
    canvas.getContext('2d').drawImage(img, clipped, 0, w - clipped, h, 0, 0, w - clipped, h);
    savePng('clipped-border', 'line-clipped-border.png', canvas);
  }
  {
    const header = 100;
    const canvas = createCanvas(w, h + header);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h + header);
    ctx.fillStyle = '#222222';
    ctx.font = '64px sans-serif';
    ctx.fillText('Partitura de prueba', 75, 72);
    ctx.drawImage(img, 0, header);
    savePng('large-header', 'line-large-header.png', canvas);
  }
  {
    const canvas = createCanvas(w, h + 40);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h + 40);
    for (let x = 0; x < w; x += 8) {
      const fraction = x / w;
      ctx.drawImage(
        img,
        x,
        0,
        Math.min(8, w - x),
        h,
        x,
        20 * fraction,
        Math.min(8, w - x),
        h * (0.86 + 0.28 * fraction)
      );
    }
    savePng('perspective', 'line-perspective.png', canvas);
  }

  // 6. Empty / non-music page (cover/text blocks without 5-line staves)
  {
    const ew = 1200;
    const eh = 800;
    const canvas = createCanvas(ew, eh);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ew, eh);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, ew - 120, eh - 120);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(420, 140, 360, 18);
    ctx.fillRect(480, 180, 240, 10);
    const buf = canvas.toBuffer('image/png');
    const outPath = path.join(outDir, 'non-music-empty.png');
    fs.writeFileSync(outPath, buf);
    outputs['non-music'] = { path: outPath, sha256: sha256Hex(buf), width: ew, height: eh };
  }

  // 7. Native lossless metadata SVG control
  {
    const controlScore = {
      id: 'corpus-lossless-control',
      title: 'Control Nativo Pautello',
      composer: 'Control',
      tempo: 100,
      timeSignature: { beats: 3, beatType: 4 },
      keySignature: 'C',
      createdAt: 1,
      updatedAt: 1,
      staves: [
        {
          id: 'staff-1',
          name: 'Bajo',
          clef: 'bass',
          measures: [
            {
              id: 'm-1',
              items: [
                {
                  id: 'n-1',
                  type: 'note',
                  duration: 'h',
                  dots: 1,
                  pitch: { step: 'C', octave: 3, accidental: null },
                },
              ],
            },
          ],
        },
      ],
    };
    const payload = Buffer.from(JSON.stringify(controlScore)).toString('base64');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><desc>PAUTELLO_V1:${payload}:END_PAUTELLO</desc></svg>\n`;
    const outPath = path.join(outDir, 'lossless-control.svg');
    fs.writeFileSync(outPath, svg, 'utf8');
    outputs['lossless-metadata'] = {
      path: outPath,
      sha256: sha256Hex(svg),
      width: 400,
      height: 120,
    };
  }

  return outputs;
}

export function checkCorpus(
  manifest: OmrCorpusManifest,
  options: { verifyDiskFiles?: boolean } = {}
) {
  assert.equal(manifest.version, 1, 'Versión de manifiesto de corpus no soportada');
  assert.equal(
    manifest.policy.splitUnit,
    'work-and-edition',
    'El corpus debe dividirse por obra y edición'
  );
  assert(
    manifest.policy.acceptanceReservedWorkIds.includes('el-rey'),
    'El Rey debe declararse reservado para aceptación'
  );
  assert(manifest.entries.length > 0, 'El manifiesto del corpus está vacío');

  const ids = new Set<string>();
  const shaByEntry = new Map<string, string>();
  const workPartitions = new Map<string, CorpusPartition>();
  const editionPartitions = new Map<string, CorpusPartition>();

  let totalPages = 0;
  let verifiedFiles = 0;
  let verifiedReferences = 0;
  const pagesByPartition: Record<CorpusPartition, number> = {
    training: 0,
    validation: 0,
    acceptance: 0,
    control: 0,
  };
  const entriesByClef: Record<CorpusClef, number> = { F4: 0, G2: 0, multi: 0, none: 0 };
  const entriesByCondition: Record<string, number> = {};
  const entriesBySourceType: Record<string, number> = {};

  for (const entry of manifest.entries) {
    assert(entry.id && !ids.has(entry.id), `ID de muestra duplicado o vacío: ${entry.id}`);
    ids.add(entry.id);
    assert(entry.workId.trim() && entry.editionId.trim(), `Falta workId/editionId en ${entry.id}`);
    assert(
      /^[a-f0-9]{64}$/.test(entry.source.sha256),
      `SHA-256 inválido en la muestra: ${entry.id}`
    );
    assert(
      !shaByEntry.has(entry.source.sha256),
      `Imagen/archivo duplicado por SHA-256 entre ${shaByEntry.get(entry.source.sha256)} y ${entry.id}`
    );
    shaByEntry.set(entry.source.sha256, entry.id);

    const priorWorkPartition = workPartitions.get(entry.workId);
    if (priorWorkPartition !== undefined) {
      assert.equal(
        entry.partition,
        priorWorkPartition,
        `La obra ${entry.workId} está dividida entre particiones distintas (${priorWorkPartition} vs ${entry.partition})`
      );
    } else {
      workPartitions.set(entry.workId, entry.partition);
    }

    const editionKey = `${entry.workId}::${entry.editionId}`;
    const priorEditionPartition = editionPartitions.get(editionKey);
    if (priorEditionPartition !== undefined) {
      assert.equal(
        entry.partition,
        priorEditionPartition,
        `La edición ${editionKey} está dividida entre particiones distintas`
      );
    } else {
      editionPartitions.set(editionKey, entry.partition);
    }

    if (manifest.policy.acceptanceReservedWorkIds.includes(entry.workId)) {
      assert.equal(
        entry.partition,
        'acceptance',
        `La obra reservada ${entry.workId} no puede ubicarse en ${entry.partition}`
      );
    }

    if (entry.redistribution === 'private-no-redistribution') {
      const normalizedPath = entry.source.path.replace(/\\/g, '/');
      assert(
        !normalizedPath.startsWith('src/') && !normalizedPath.startsWith('public/'),
        `Muestra sin permiso de redistribución dentro de carpeta pública: ${entry.id}`
      );
    }

    const hasLabel =
      Boolean(entry.label.referencePath) ||
      entry.label.emptyPage === true ||
      typeof entry.label.expectedMeasures === 'number' ||
      typeof entry.label.expectedStaves === 'number';
    assert(hasLabel, `La muestra ${entry.id} carece de etiqueta o referencia declarada`);

    assert(entry.source.pages > 0, `Número de páginas inválido en ${entry.id}`);
    totalPages += entry.source.pages;
    pagesByPartition[entry.partition] += entry.source.pages;
    entriesByClef[entry.category.clef] += 1;
    entriesByCondition[entry.category.condition] =
      (entriesByCondition[entry.category.condition] ?? 0) + 1;
    entriesBySourceType[entry.source.sourceType] =
      (entriesBySourceType[entry.source.sourceType] ?? 0) + 1;

    if (options.verifyDiskFiles) {
      if (fs.existsSync(entry.source.path)) {
        const diskHash = sha256Hex(fs.readFileSync(entry.source.path));
        assert.equal(
          diskHash,
          entry.source.sha256,
          `SHA-256 discrepante en disco para ${entry.id} (${entry.source.path})`
        );
        verifiedFiles += 1;
      } else if (entry.availability === 'public-repo') {
        throw new Error(`Falta fixture público obligatorio: ${entry.source.path}`);
      }

      if (entry.label.referencePath && fs.existsSync(entry.label.referencePath)) {
        const ref = JSON.parse(
          fs.readFileSync(entry.label.referencePath, 'utf8')
        ) as MusicalReference;
        const refSummary = checkReference(ref);
        assert.equal(
          refSummary.status,
          'reviewed',
          `La referencia ${entry.label.referencePath} asociada a ${entry.id} no está aprobada`
        );
        verifiedReferences += 1;
      }
    }
  }

  const validationClefs = new Set(
    manifest.entries.filter((e) => e.partition === 'validation').map((e) => e.category.clef)
  );
  assert(
    validationClefs.has('G2') && validationClefs.has('F4'),
    'La partición de validación debe cubrir obras independientes tanto en clave de Sol (G2) como en clave de Fa (F4)'
  );

  return {
    entries: manifest.entries.length,
    distinctWorks: workPartitions.size,
    totalPages,
    pagesByPartition,
    entriesByClef,
    entriesByCondition,
    entriesBySourceType,
    verifiedFiles,
    verifiedReferences,
  };
}
