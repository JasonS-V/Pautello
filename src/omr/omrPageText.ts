import type { Box } from './omrGeometry';
import type { OmrTextRegion } from './omrParts';

export interface PageTextWord {
  text: string;
  confidence: number;
  bbox: Box;
}

export interface PageTextLine {
  id: string;
  page: number;
  text: string;
  bbox: Box;
  confidence: number;
  source: 'pdf' | 'ocr';
  words: PageTextWord[];
  boxed?: boolean;
}

export type BeatUnit = 'w' | 'h' | 'q' | '8' | '16';

export function deriveQuarterBpm(
  unit: BeatUnit | null,
  dots: number,
  perMinute: number
): number | null {
  if (!unit) return null;
  const quarters: Record<BeatUnit, number> = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25 };
  const factor = dots === 2 ? 1.75 : dots === 1 ? 1.5 : 1;
  return Math.round(quarters[unit] * factor * perMinute);
}

/** OCR only the spaces between staff crops; split wide pages to avoid joining unrelated columns. */
export function planTextRegions(width: number, height: number, staffBoxes: Box[]): Box[] {
  const sorted = [...staffBoxes].sort((a, b) => a[1] - b[1]);
  const gaps: Array<[number, number]> = [];
  let previousBottom = 0;
  for (const box of sorted) {
    const top = Math.max(0, Math.floor(box[1]));
    if (top - previousBottom >= 24) gaps.push([previousBottom, top]);
    previousBottom = Math.max(previousBottom, Math.ceil(box[1] + box[3]));
  }
  if (height - previousBottom >= 24) gaps.push([previousBottom, height]);
  if (!gaps.length && !sorted.length) gaps.push([0, height]);
  const xs = [0, Math.floor(width / 4), Math.floor((width * 3) / 4), width];
  return gaps.flatMap(([top, bottom]) =>
    xs.slice(0, -1).map((left, index) => [left, top, xs[index + 1] - left, bottom - top] as Box)
  );
}

function hasInk(gray: Float32Array, width: number, [x, y, w, h]: Box): boolean {
  let dark = 0;
  for (let row = y; row < y + h; row += 2)
    for (let col = x; col < x + w; col += 2)
      if (gray[row * width + col] < 0.8 && ++dark >= 8) return true;
  return false;
}

function intersects(a: Box, b: Box): boolean {
  return a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
}

export function findBoxedMarks(gray: Float32Array, width: number, regions: Box[]): Box[] {
  const marks: Box[] = [];
  const dark = (x: number, y: number) => gray[y * width + x] < 0.65;
  for (const [left, top, regionWidth, regionHeight] of regions) {
    for (let y = top; y < top + regionHeight - 19; y++)
      for (let x = left; x < left + regionWidth - 21; x++) {
        if (!dark(x, y) || (x > left && dark(x - 1, y))) continue;
        let run = 0;
        while (run < 70 && x + run < left + regionWidth && dark(x + run, y)) run++;
        if (run < 22 || run > 60) continue;
        for (let height = 20; height <= 52 && y + height < top + regionHeight; height++) {
          let bottom = 0,
            sides = 0;
          for (let dx = 0; dx < run; dx++) if (dark(x + dx, y + height)) bottom++;
          if (bottom < run * 0.7) continue;
          for (let dy = 0; dy <= height; dy++) {
            if (dark(x, y + dy)) sides++;
            if (dark(x + run - 1, y + dy)) sides++;
          }
          if (sides < height * 1.3) continue;
          const box: Box = [x, y, run, height + 1];
          if (!marks.some((known) => intersects(known, box))) marks.push(box);
          break;
        }
      }
  }
  return marks;
}

const boxOf = (bbox: { x0: number; y0: number; x1: number; y1: number }): Box => [
  bbox.x0,
  bbox.y0,
  bbox.x1 - bbox.x0,
  bbox.y1 - bbox.y0,
];

async function boxedLetterImage(imageUrl: string, [x, y, w, h]: Box): Promise<string> {
  const image = new Image();
  image.src = imageUrl;
  await image.decode();
  const inset = Math.max(2, Math.round(Math.min(w, h) * 0.12));
  const canvas = document.createElement('canvas');
  canvas.width = (w - inset * 2) * 6;
  canvas.height = (h - inset * 2) * 6;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas no disponible para OCR de ensayo.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.drawImage(
    image,
    x + inset,
    y + inset,
    w - inset * 2,
    h - inset * 2,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas.toDataURL('image/png');
}

export async function recognizePageText(
  pages: Array<{
    pageNumber: number;
    imageUrl: string;
    gray: Float32Array;
    width: number;
    height: number;
    staffBoxes: Box[];
    pdfText?: OmrTextRegion[];
  }>,
  signal?: AbortSignal
): Promise<{ lines: PageTextLine[]; errors: Array<{ page: number; bbox: Box; message: string }> }> {
  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException('Importación cancelada.', 'AbortError');
  };
  checkAbort();
  const lines: PageTextLine[] = [];
  const errors: Array<{ page: number; bbox: Box; message: string }> = [];
  const jobs = pages.flatMap((page) => {
    for (const [index, region] of (page.pdfText ?? []).entries()) {
      if (!region.text.trim()) continue;
      lines.push({
        id: `pdf-${page.pageNumber}-${index}`,
        page: page.pageNumber,
        text: region.text.trim(),
        bbox: region.bbox,
        confidence: 100,
        source: 'pdf',
        words: [{ text: region.text.trim(), confidence: 100, bbox: region.bbox }],
      });
    }
    return planTextRegions(page.width, page.height, page.staffBoxes)
      .filter(
        (bbox) => !page.pdfText?.some((item) => item.text.trim() && intersects(bbox, item.bbox))
      )
      .filter((bbox) => hasInk(page.gray, page.width, bbox))
      .map((bbox) => ({ page, bbox }));
  });
  const boxedJobs = pages.flatMap((page) =>
    findBoxedMarks(page.gray, page.width, planTextRegions(page.width, page.height, page.staffBoxes))
      .map((bbox) => ({ page, bbox }))
      .filter(({ bbox }) => bbox[1] > Math.min(...page.staffBoxes.map((box) => box[1])))
  );
  if (!jobs.length && !boxedJobs.length) return { lines, errors };

  const { createWorker, PSM } = await import('tesseract.js');
  const base = new URL('./omr/ocr/', window.location.href);
  // shortcut: use the portable LSTM core; add SIMD variants only after measuring OCR cost.
  const worker = await createWorker('eng+spa', 1, {
    workerPath: new URL('worker.min.js', base).href,
    corePath: new URL('tesseract-core-lstm.wasm.js', base).href,
    langPath: base.href,
    workerBlobURL: false,
    cacheMethod: 'none',
    gzip: true,
  });
  const onAbort = () => {
    void worker.terminate();
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    checkAbort();
    for (const { page, bbox } of jobs) {
      checkAbort();
      try {
        const recognized = await worker.recognize(
          page.imageUrl,
          { rectangle: { left: bbox[0], top: bbox[1], width: bbox[2], height: bbox[3] } },
          { blocks: true }
        );
        for (const block of recognized.data.blocks ?? [])
          for (const paragraph of block.paragraphs)
            for (const line of paragraph.lines) {
              const text = line.text.trim();
              if (line.confidence < 45 || !/[\p{L}\p{N}]{2,}/u.test(text)) continue;
              lines.push({
                id: `ocr-${page.pageNumber}-${lines.length}`,
                page: page.pageNumber,
                text,
                bbox: boxOf(line.bbox),
                confidence: line.confidence,
                source: 'ocr',
                words: line.words.map((word) => ({
                  text: word.text,
                  confidence: word.confidence,
                  bbox: boxOf(word.bbox),
                })),
              });
            }
      } catch (error) {
        checkAbort();
        errors.push({
          page: page.pageNumber,
          bbox,
          message: error instanceof Error ? error.message : 'Falló el OCR local.',
        });
      }
    }
    if (boxedJobs.length) await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR });
    for (const { page, bbox } of boxedJobs) {
      checkAbort();
      try {
        const recognized = await worker.recognize(await boxedLetterImage(page.imageUrl, bbox));
        const letter = recognized.data.text.trim();
        if (!/^[A-Z]$/.test(letter) || recognized.data.confidence < 60) continue;
        lines.push({
          id: `box-${page.pageNumber}-${lines.length}`,
          page: page.pageNumber,
          text: letter,
          bbox,
          confidence: recognized.data.confidence,
          source: 'ocr',
          words: [{ text: letter, confidence: recognized.data.confidence, bbox }],
          boxed: true,
        });
      } catch (error) {
        checkAbort();
        errors.push({
          page: page.pageNumber,
          bbox,
          message: error instanceof Error ? error.message : 'No se pudo leer el recuadro.',
        });
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await worker.terminate();
  }
  return { lines, errors };
}

export type EditorialField =
  | 'title'
  | 'composer'
  | 'arranger'
  | 'part'
  | 'style'
  | 'copyright'
  | 'level'
  | 'collection'
  | 'dedication'
  | 'editorialKey';

export function classifyPageText(
  lines: PageTextLine[],
  pageWidth: number,
  firstStaffTop: number,
  pageHeight = firstStaffTop * 4
) {
  const fields: Partial<Record<EditorialField, string>> = {};
  const proposals: Array<{
    field: EditorialField;
    value: string;
    confidence: number;
    source: { page: number; bbox: Box };
  }> = [];
  const classified = new Set<string>();
  const firstPage = Math.min(...lines.map((line) => line.page));
  const header = lines.filter((line) => line.page === firstPage && line.bbox[1] < firstStaffTop);
  const accept = (
    field: EditorialField,
    line: PageTextLine,
    value = line.text,
    reliability = 1
  ) => {
    if (!fields[field] && value.trim()) {
      fields[field] = value.trim();
      classified.add(line.id);
      proposals.push({
        field,
        value: value.trim(),
        confidence: Math.round(line.confidence * reliability) / 100,
        source: { page: line.page, bbox: line.bbox },
      });
    }
  };
  for (const line of lines) {
    if (/^(?:arr\.?|arranged\s+by|arreglo\s+de)\s*/i.test(line.text))
      accept('arranger', line, line.text.replace(/^(?:arr\.?|arranged\s+by|arreglo\s+de)\s*/i, ''));
    else if (
      /[©]|copyright/i.test(line.text) ||
      (/\b(?:19|20)\d{2}\b/.test(line.text) && line.bbox[1] > pageHeight * 0.8)
    )
      accept('copyright', line);
  }
  for (const line of header) {
    if (
      /^(?:bajo|bass|guitarr[oó]n|viol[ií]n|violin|piano|trompeta|trumpet|flauta|flute|cello|tuba)$/i.test(
        line.text
      )
    )
      accept('part', line);
    else if (/\b(?:ranchera|valseada|vals|waltz|lenta|allegro|andante)\b/i.test(line.text))
      accept('style', line, line.text.replace(/\s+\S{1,2}\s*=\s*\d{2,3}.*/, ''));
    else if (/^(?:level|nivel|grado)\s*\d+/i.test(line.text)) accept('level', line);
    else if (/^for\s+.*(?:college|mariachis|ensemble|school)/i.test(line.text))
      accept('collection', line);
    else if (/^["“](?:Do|Re|Mi|Fa|Sol|La|Si|[A-G])["”]/i.test(line.text))
      accept('editorialKey', line);
    else if (/^(?:for|para|dedicado\s+a)\b/i.test(line.text)) accept('dedication', line);
    else if (/^(?:composed\s+by|music\s+by|m[úu]sica\s+de|compositor\s*:)\s*/i.test(line.text))
      accept(
        'composer',
        line,
        line.text.replace(/^(?:composed\s+by|music\s+by|m[úu]sica\s+de|compositor\s*:)\s*/i, '')
      );
  }
  const title = header
    .filter((line) => !classified.has(line.id) && line.text.length < 90)
    .filter(
      (line) =>
        line.bbox[0] + line.bbox[2] / 2 > pageWidth * 0.3 &&
        line.bbox[0] + line.bbox[2] / 2 < pageWidth * 0.7
    )
    .sort((a, b) => b.bbox[3] - a.bbox[3])[0];
  if (title && title.bbox[3] >= 22) accept('title', title);
  if (!fields.composer && title) {
    const author = header
      .filter((line) => !classified.has(line.id))
      .filter((line) => /^[\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,3}$/u.test(line.text))
      .filter((line) => line.bbox[1] >= title.bbox[1] && line.bbox[1] < firstStaffTop)
      .sort((a, b) => a.bbox[1] - b.bbox[1])[0];
    if (author) accept('composer', author, author.text, 0.85);
  }
  return { fields, proposals, unclassified: lines.filter((line) => !classified.has(line.id)) };
}
