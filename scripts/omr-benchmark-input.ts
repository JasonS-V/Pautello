import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import type { Score } from '../src/types/music';
import { grayFromBytes, rgbaToGray } from '../src/omr/omrPreprocess';
import { decodeScorePayloadFromText, extractScoreFromPngBytes } from '../src/omr/scorePayloadCodec';

const require = createRequire(import.meta.url);
const pdfRequire = createRequire(require.resolve('pdfjs-dist/package.json'));

export interface BenchmarkInput {
  bytes: Buffer;
  format: string;
  pages: number;
  textCharacters: number;
  sourceType: 'lossless-metadata' | 'pdf-text' | 'pdf-image' | 'image';
  nativeScore: Score | null;
  rasterizer: string | null;
  rasterize(
    page: number,
    temp?: string
  ): Promise<{ width: number; height: number; gray: Float32Array }>;
}

function readPgm(file: string) {
  const buffer = fs.readFileSync(file);
  let cursor = 0;
  const next = (): string => {
    while (cursor < buffer.length) {
      if (buffer[cursor] === 35) {
        while (cursor < buffer.length && buffer[cursor] !== 10) cursor++;
      }
      if (buffer[cursor] > 32) break;
      cursor++;
    }
    const start = cursor;
    while (cursor < buffer.length && buffer[cursor] > 32) cursor++;
    return buffer.toString('ascii', start, cursor);
  };
  if (next() !== 'P5') throw new Error('Poppler no produjo un PGM binario P5');
  const width = Number(next());
  const height = Number(next());
  const max = Number(next());
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    max !== 255
  ) {
    throw new Error('Cabecera PGM inválida');
  }
  cursor++;
  const pixels = buffer.subarray(cursor);
  if (pixels.length !== width * height) throw new Error('Tamaño de raster PGM inválido');
  return { width, height, gray: grayFromBytes(pixels) };
}

export async function openBenchmarkInput(
  file: string,
  poppler = 'pdftoppm'
): Promise<BenchmarkInput> {
  const format = path.extname(file).slice(1).toLowerCase();
  if (!['pdf', 'png', 'jpg', 'jpeg', 'webp', 'svg'].includes(format))
    throw new Error(`Formato no admitido: ${format}`);
  const bytes = fs.readFileSync(file);
  let nativeScore =
    format === 'png'
      ? extractScoreFromPngBytes(bytes)
      : format === 'svg'
        ? decodeScorePayloadFromText(bytes.toString('utf8'))
        : null;
  let pages = 1;
  let textCharacters = 0;
  if (format === 'pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
    try {
      const pdf = await task.promise;
      pages = pdf.numPages;
      if (pages > 20)
        throw new Error(`PDF de ${pages} páginas: el benchmark admite 20 como máximo.`);
      let text = '';
      for (let p = 1; p <= pages; p++) {
        const content = await (await pdf.getPage(p)).getTextContent();
        text += content.items.map((item) => ('str' in item ? item.str : '')).join('');
      }
      textCharacters = text.trim().length;
      nativeScore = decodeScorePayloadFromText(text);
    } finally {
      await task.destroy();
    }
  }
  return {
    bytes,
    format,
    pages,
    textCharacters,
    nativeScore,
    sourceType: nativeScore
      ? 'lossless-metadata'
      : format === 'pdf'
        ? textCharacters
          ? 'pdf-text'
          : 'pdf-image'
        : 'image',
    rasterizer: nativeScore ? null : format === 'pdf' ? 'pdftoppm -gray' : '@napi-rs/canvas',
    async rasterize(page, temp) {
      if (nativeScore) throw new Error('Una restauración nativa no debe rasterizarse');
      if (page < 1 || page > pages) throw new Error('Página fuera de rango');
      if (format === 'pdf') {
        if (!temp) throw new Error('Falta la carpeta temporal de rasterización');
        const prefix = path.join(temp, 'page');
        execFileSync(poppler, [
          '-f',
          String(page),
          '-l',
          String(page),
          '-r',
          '172.8',
          '-gray',
          '-singlefile',
          file,
          prefix,
        ]);
        return readPgm(`${prefix}.pgm`);
      }
      // Reutiliza el decodificador opcional instalado por PDF.js; no añade otra dependencia.
      const { createCanvas, loadImage } = pdfRequire('@napi-rs/canvas');
      const image = await loadImage(bytes);
      const scale = image.width < 1400 ? 2 : 1;
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      return {
        width,
        height,
        gray: rgbaToGray(context.getImageData(0, 0, width, height).data, width, height),
      };
    },
  };
}

export function imageDecoderVersion(): string {
  return pdfRequire('@napi-rs/canvas/package.json').version;
}
