import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { openBenchmarkInput } from '../../../scripts/omr-benchmark-input';
import { formatEmbeddedScoreMarker, injectScoreIntoPngBytes } from '../scorePayloadCodec';
import { normalizeScore } from '../../utils/scoreSchema';

const require = createRequire(import.meta.url);
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

function fixture(name: string, bytes: string | Uint8Array) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pautello-benchmark-test-'));
  folders.push(folder);
  const file = path.join(folder, name);
  fs.writeFileSync(file, bytes);
  return file;
}

function textPdf(text: string) {
  const stream = `BT /F1 0.1 Tf 10 100 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {
    const offset = Buffer.byteLength(pdf);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  return `${pdf}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}

describe('entradas del benchmark OMR', () => {
  const score = normalizeScore({
    title: 'Control',
    staves: [{ clef: 'bass', measures: [{ items: [{ type: 'rest', duration: 'q' }] }] }],
  })!;

  it.each(['svg', 'png', 'pdf'])(
    'restaura %s nativo sin rasterizador ni pesos',
    async (ext) => {
      const marker = formatEmbeddedScoreMarker(score);
      const bytes =
        ext === 'svg'
          ? `<svg xmlns="http://www.w3.org/2000/svg"><metadata>${marker}</metadata></svg>`
          : ext === 'pdf'
            ? textPdf(marker)
            : injectScoreIntoPngBytes(
                fs.readFileSync('src/omr/__tests__/fixtures/line.png'),
                score
              );
      const input = await openBenchmarkInput(
        fixture(`native.${ext}`, bytes),
        'poppler-inexistente'
      );
      expect(input.sourceType).toBe('lossless-metadata');
      expect(input.nativeScore?.title).toBe('Control');
      expect(input.rasterizer).toBeNull();
      const output = path.join(path.dirname(fixture('out-control', '')), 'result');
      const sourceFile = fixture(`cli.${ext}`, bytes);
      execFileSync(
        process.execPath,
        [
          require.resolve('vite-node/vite-node.mjs'),
          'scripts/omr-benchmark.ts',
          '--input',
          sourceFile,
          '--out',
          output,
          '--poppler',
          'poppler-inexistente',
        ],
        { cwd: process.cwd(), stdio: 'pipe', timeout: 25000 }
      );
      const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
      const stats = JSON.parse(fs.readFileSync(path.join(output, 'stats.json'), 'utf8'));
      expect(manifest.model).toBeNull();
      expect(manifest.vocab).toBeNull();
      expect(stats).toMatchObject({
        sourceType: 'lossless-metadata',
        inferenceExecuted: false,
        pagesProcessed: 0,
      });
      expect(fs.existsSync(path.join(output, 'ir.json'))).toBe(false);
    },
    15000
  );

  it.each([
    ['Texto externo', 'pdf-text'],
    ['', 'pdf-image'],
  ])('clasifica PDF con texto "%s"', async (text, kind) => {
    const input = await openBenchmarkInput(
      fixture('external.pdf', textPdf(text)),
      'poppler-inexistente'
    );
    expect(input.sourceType).toBe(kind);
    expect(input.pages).toBe(1);
    expect(input.nativeScore).toBeNull();
  });

  it('rasteriza PNG externa sin escalar una línea de más de 1400 px', async () => {
    const input = await openBenchmarkInput('src/omr/__tests__/fixtures/line.png');
    expect(input.sourceType).toBe('image');
    const raster = await input.rasterize(1);
    expect([raster.width, raster.height]).toEqual([2018, 181]);
    expect(raster.gray.length).toBe(2018 * 181);
    expect(Math.min(...raster.gray.subarray(0, 100))).toBeGreaterThan(0.9);
  });

  it('conserva resolución de imágenes pequeñas y compone su transparencia sobre blanco', async () => {
    const input = await openBenchmarkInput(
      fixture('small.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="5"/>')
    );
    const raster = await input.rasterize(1);
    expect([raster.width, raster.height]).toEqual([10, 5]);
    expect([...raster.gray].every((value) => value === 1)).toBe(true);
  });

  it.each(['jpg', 'jpeg', 'webp'])(
    'decodifica imágenes %s a su resolución original',
    async (format) => {
      const require = createRequire(import.meta.url);
      const { createCanvas } = createRequire(require.resolve('pdfjs-dist/package.json'))(
        '@napi-rs/canvas'
      );
      const canvas = createCanvas(10, 5);
      const context = canvas.getContext('2d');
      context.fillStyle = '#000000';
      context.fillRect(0, 0, 10, 5);
      const bytes = canvas.toBuffer(format === 'webp' ? 'image/webp' : 'image/jpeg');
      const input = await openBenchmarkInput(fixture(`external.${format}`, bytes));
      const raster = await input.rasterize(1);
      expect(input.sourceType).toBe('image');
      expect([raster.width, raster.height]).toEqual([10, 5]);
      expect([...raster.gray].every((value) => value < 0.05)).toBe(true);
    }
  );

  it('rechaza un formato desconocido antes de iniciar inferencia', async () => {
    await expect(openBenchmarkInput(fixture('bad.txt', 'foo'))).rejects.toThrow(/Formato/);
  });

  it('propaga un error de decodificación de imagen', async () => {
    const input = await openBenchmarkInput(fixture('bad.png', 'invalid'));
    await expect(input.rasterize(1)).rejects.toThrow();
  });
});
