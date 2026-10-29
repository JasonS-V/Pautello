import { Score } from '../types/music';
import {
  TARGET_SPACING,
  preprocessPage,
  rgbaToGray,
  type OmrRegion,
  type OmrMask,
} from './omrPreprocess';
import {
  checkOmrFileType,
  checkPixelBudget,
  choosePdfScale,
  inspectPageInk,
  selectPdfPages,
} from './omrInput';
import { mapBox, type Transform } from './omrGeometry';
import { abortOmr, createOmrCompute } from './omrCompute';
import { resolvePublicAssetUrl } from './omrRuntime';
import { mergeStaffWindows } from './omrWindows';
import { withNotationEvidence } from './omrNotationGeometry';
import { assignPartIdentities, findStaffLabel, type OmrTextRegion } from './omrParts';
import {
  classifyPageText,
  recognizePageText,
  type EditorialField,
  type PageTextLine,
} from './omrPageText';
import { readTextIndications, type OmrIndication } from './omrIndications';
import {
  OmrDecodedLine,
  OmrScoreIR,
  OmrStaffMeta,
  OmrWarning,
  assembleIR,
  decodeLine,
  i2wFromVocab,
  lineFragment,
} from './omrDecode';
import {
  OmrConversionSummary,
  OmrMeasureProposal,
  OmrMetadataHints,
  OmrSourceLink,
  convertOmrIrToScore,
} from './omrToScore';
import { decodeScorePayloadFromText, extractScoreFromPngBytes } from './scorePayloadCodec';
import { OmrActiveModelContract, verifyModelOutputCompatibility } from './omrModelContract';

export type OmrStage =
  | 'loading-file'
  | 'extracting-pages'
  | 'detecting-staves'
  | 'reading-text'
  | 'loading-model'
  | 'running-inference'
  | 'building-score';

export interface OmrProgress {
  stage: OmrStage;
  message: string;
  percent: number;
  currentPage?: number;
  totalPages?: number;
}

export interface OmrPageDiagnostic {
  pageNumber: number;
  width: number;
  height: number;
  usedThreshold: number;
  deskewAngleDeg: number;
  systemsCount: number;
  stavesCount: number;
  inkQuality: 'empty' | 'faint' | 'visible';
  rasterScale?: number;
  orientation: { quarterTurn: number; halfTurnAmbiguous: boolean };
  originalToProcessed: Transform;
  regions: OmrRegion[];
  masks: OmrMask[];
  contrast: { selected: string; scores: Record<string, number> };
  windowsCount: number;
  boxes: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    lineSpacing: number;
    system: number;
    voice: number;
  }>;
}

export interface OmrResult {
  score: Score;
  confidence: number;
  pagesProcessed: number;
  stavesDetected: number;
  systemsDetected?: number;
  partsDetected?: number;
  windowsProcessed?: number;
  measuresDetected: number;
  notesDetected: number;
  sourceType: 'lossless-metadata' | 'neural-onnx';
  ir: OmrScoreIR | null;
  sourceLinks: OmrSourceLink[];
  warnings: OmrWarning[];
  proposals?: OmrMeasureProposal[];
  report?: OmrConversionSummary['report'];
  sourcePages?: OmrSourcePage[];
  recognizedScore?: Score;
  acceptedProposals?: OmrMeasureProposal[];
  metadataHints?: OmrMetadataHints;
  textLines?: PageTextLine[];
  editorial?: {
    proposals: Array<{
      field: EditorialField;
      value: string;
      confidence: number;
      source: { page: number; bbox: [number, number, number, number] };
    }>;
    unclassified: PageTextLine[];
  };
  indications?: OmrIndication[];
  indicationPlans?: OmrConversionSummary['indicationPlans'];
  reviewStatus?: 'automatic' | 'confirmed-with-pending' | 'reviewed';
  reviewedWarningIds?: string[];
  reviewedMeasureIds?: string[];
  manualEditMeasureIds?: string[];
  acceptedIndicationIds?: string[];
  rejectedIndicationIds?: string[];
  stageTrace?: OmrProgress[];
  pageDiagnostics?: OmrPageDiagnostic[];
  modelContract?: OmrActiveModelContract | null;
}

export interface OmrSourcePage {
  pageNumber: number;
  width: number;
  height: number;
  imageUrl: string;
  deskewAngleDeg: number;
  coordinates?: 'original';
}

interface PageGrayBuffer {
  pageNumber: number;
  width: number;
  height: number;
  gray: Float32Array;
  imageUrl: string;
  rasterScale?: number;
  textRegions?: OmrTextRegion[];
  load?: () => Promise<PageGrayBuffer>;
}

export interface OmrImportOptions {
  pdfPageRange?: string;
  rotation?: 0 | 90 | 180 | 270;
  signal?: AbortSignal;
}

function extractHintsFromPdfTextItems(
  items: Array<{ str: string; x: number; y: number; fontSize: number }>,
  pageWidth: number,
  pageHeight: number,
  fallbackFileName: string
): OmrMetadataHints {
  const hints: OmrMetadataHints = {};
  const cleanTitleFallback = fallbackFileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  const fullText = items.map((i) => i.str).join(' ');
  hints.fullText = fullText;

  // 1. Detección de Tempo / BPM
  // Busca expresiones como 'd. = 60', '♩ = 90', 'q = 120', 'Tempo = 60', '= 60', '60 BPM', etc.
  const bpmMatch =
    /(?:♩|♪|𝅗𝅥|𝅘𝅥|𝅗𝅥\.|q|h|d|j|\u2669|\u266A|[\uE1D0-\uE1EF])?\s*=\s*(\d{2,3})/i.exec(fullText) ||
    /\b(?:tempo|m\.m\.|bpm)\s*[:=]?\s*(\d{2,3})\b/i.exec(fullText) ||
    /(?:^|\s)=\s*(\d{2,3})\b/.exec(fullText);
  if (bpmMatch) {
    const parsedBpm = parseInt(bpmMatch[1], 10);
    if (parsedBpm >= 30 && parsedBpm <= 300) {
      hints.tempo = parsedBpm;
    }
  }

  // 2. Detección de Compás (Métrica / Time Signature)
  // Expresiones de género como "Ranchera Valseada", "Vals" o "Waltz" indican compás ternario 3/4
  if (/\b(valseada|vals|waltz)\b/i.test(fullText)) {
    hints.timeSignature = { beats: 3, beatType: 4 };
    hints.genre = 'vals';
  } else if (/\b3\/4\b/.test(fullText)) {
    hints.timeSignature = { beats: 3, beatType: 4 };
  } else if (/\b2\/4\b/.test(fullText)) {
    hints.timeSignature = { beats: 2, beatType: 4 };
  } else if (/\b6\/8\b/.test(fullText)) {
    hints.timeSignature = { beats: 6, beatType: 8 };
  } else if (/\b4\/4\b/.test(fullText)) {
    hints.timeSignature = { beats: 4, beatType: 4 };
  }

  // 3. Detección de Tonalidad (Key Signature)
  // Ejemplos comunes en partituras de mariachi y ensambles vocales:
  // '"Do" - Male Singer', '"Sol"', 'Tono: Do', 'Key: C', 'Do Mayor', etc.
  const keyLabelMatch =
    /["“](Do|Re|Mi|Fa|Sol|La|Si|[A-G])([#b♯♭]?)(m|min|menor|minor)?["”]/i.exec(fullText) ||
    /\b(?:tono|ton|key|tonalidad)\s*[:=]?\s*([A-Ga-g]|Do|Re|Mi|Fa|Sol|La|Si)([#b♯♭]?)(m|min|menor|minor|maj|mayor|major)?\b/i.exec(
      fullText
    ) ||
    /\b(Do|Re|Mi|Fa|Sol|La|Si)\s+(Mayor|Menor)\b/i.exec(fullText);

  if (keyLabelMatch) {
    const noteRoot = keyLabelMatch[1].toLowerCase();
    const rawAcc = keyLabelMatch[2] || '';
    const isMin = Boolean(keyLabelMatch[3] && /m|min|menor|minor/i.test(keyLabelMatch[3]));
    const ROOT_MAP: Record<string, string> = {
      do: 'C',
      c: 'C',
      re: 'D',
      d: 'D',
      mi: 'E',
      e: 'E',
      fa: 'F',
      f: 'F',
      sol: 'G',
      g: 'G',
      la: 'A',
      a: 'A',
      si: 'B',
      b: 'B',
    };
    const letter = ROOT_MAP[noteRoot];
    if (letter) {
      let accStr = '';
      if (rawAcc === '#' || rawAcc === '♯') accStr = '#';
      else if (rawAcc === 'b' || rawAcc === '♭') accStr = 'b';
      const keyCandidate = `${letter}${accStr}${isMin ? 'm' : ''}`;
      const validKeys = new Set([
        'C',
        'G',
        'D',
        'A',
        'E',
        'B',
        'F#',
        'C#',
        'F',
        'Bb',
        'Eb',
        'Ab',
        'Db',
        'Gb',
        'Cb',
        'Am',
        'Em',
        'Bm',
        'F#m',
        'C#m',
        'G#m',
        'D#m',
        'Dm',
        'Gm',
        'Cm',
        'Fm',
        'Bbm',
        'Ebm',
      ]);
      if (validKeys.has(keyCandidate)) {
        hints.keySignature = keyCandidate as import('../types/music').KeySignature;
      }
    }
  }

  // En coordenadas PDF estándar (y crece hacia arriba), la cabecera está en y > pageHeight * 0.55
  const headerItems = items
    .map((it) => ({ ...it, str: it.str.trim() }))
    .filter(
      (it) =>
        it.str.length >= 2 &&
        !/^PAUTELLO_V1:/i.test(it.str) &&
        !/^\d+$/.test(it.str) &&
        it.y >= pageHeight * 0.55
    );

  if (headerItems.length > 0) {
    const sortedByFont = [...headerItems].sort((a, b) => b.fontSize - a.fontSize || b.y - a.y);
    const titleCandidate = sortedByFont[0];
    if (titleCandidate && titleCandidate.str.length <= 90) {
      hints.title = titleCandidate.str;
    }

    const rightItems = headerItems
      .filter((it) => it !== titleCandidate && it.x > pageWidth * 0.5)
      .filter((it) => /^(?:[\p{Lu}][\p{L}'’-]+\s+){1,3}[\p{Lu}][\p{L}'’-]+$/u.test(it.str))
      .sort((a, b) => b.y - a.y);
    if (rightItems.length > 0 && rightItems[0].str.length <= 80) {
      hints.composer = rightItems[0].str;
    }
  }

  if (!hints.title && cleanTitleFallback) {
    hints.title = cleanTitleFallback;
  }

  // Detección de instrumento o parte vocal/instrumental (ej. "Bajo", "Violín")
  const instMatch =
    /\b(bajo|bass|contrabajo|double\s*bass|guitarron|guitarr[oó]n|cello|violonch?elo|tuba|fagot|bassoon|tromb[oó]n|trombone|bar[ií]tono|baritone|viol[ií]n|violin|viola|flauta|flute|clarinete|trompeta|trumpet|guitarra|piano)\b/i.exec(
      fullText || fallbackFileName
    );
  if (instMatch) {
    const rawWord = instMatch[1];
    hints.subtitle = rawWord.charAt(0).toUpperCase() + rawWord.slice(1).toLowerCase();
  }

  return hints;
}

/**
 * Procesa un archivo PDF:
 * 1. Verifica si contiene una firma sin pérdida `PAUTELLO_V1:` en su capa de texto.
 * 2. Si es externo, mide las pautas en una vista previa y elige escala dentro del presupuesto.
 */
async function extractPdfPagesAndMetadata(
  file: File,
  onProgress?: (progress: OmrProgress) => void,
  pageRange = '',
  signal?: AbortSignal,
  previewSpacing?: (gray: Float32Array, width: number, height: number) => Promise<number[]>
): Promise<{
  losslessScore: Score | null;
  pages: PageGrayBuffer[];
  hints: OmrMetadataHints;
  omittedPages: number;
  close?: () => Promise<void>;
}> {
  const pdfjs = await import('pdfjs-dist');
  if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = resolvePublicAssetUrl('./omr/pdf.worker.min.mjs');
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const onAbort = () => {
    void loadingTask.destroy();
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  const close = async () => {
    signal?.removeEventListener('abort', onAbort);
    await loadingTask.destroy();
  };
  try {
    const pdfDoc = await loadingTask.promise;
    if (signal?.aborted) throw abortOmr();
    const firstPageText = await (await pdfDoc.getPage(1)).getTextContent();
    const nativeScore = decodeScorePayloadFromText(
      firstPageText.items.map((item) => ('str' in item ? item.str : '')).join('')
    );
    if (nativeScore) {
      await close();
      return { losslessScore: nativeScore, pages: [], hints: {}, omittedPages: 0 };
    }
    const selectedPages = selectPdfPages(pdfDoc.numPages, pageRange);
    const omittedPages = pdfDoc.numPages - selectedPages.length;
    const allTextChunks: string[] = [];
    const textByPage = new Map<number, OmrTextRegion[]>();
    let page1Hints: OmrMetadataHints = {
      title: file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .trim(),
    };

    for (const p of selectedPages) {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();
      const viewport1x = page.getViewport({ scale: 1.0 });

      const pageItems: Array<{ str: string; x: number; y: number; fontSize: number }> = [];
      const textRegions: OmrTextRegion[] = [];
      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          allTextChunks.push(item.str);
          const tr = Array.isArray(item.transform) ? item.transform : [12, 0, 0, 12, 0, 0];
          const fontSize = Math.hypot(tr[0] || 12, tr[1] || 0);
          textRegions.push({
            text: item.str,
            bbox: mapBox(viewport1x.transform as Transform, [tr[4], tr[5], item.width, fontSize]),
          });
          pageItems.push({
            str: item.str,
            x: tr[4] || 0,
            y: tr[5] || 0,
            fontSize,
          });
        }
      }
      textByPage.set(p, textRegions);

      if (p === selectedPages[0]) {
        page1Hints = extractHintsFromPdfTextItems(
          pageItems,
          viewport1x.width,
          viewport1x.height,
          file.name
        );
      }
    }

    const joinedText = allTextChunks.join('');
    const lossless = decodeScorePayloadFromText(joinedText);
    if (lossless) {
      await close();
      return { losslessScore: lossless, pages: [], hints: page1Hints, omittedPages: 0 };
    }

    // Comprobar todas las dimensiones antes de reservar incluso los lienzos de inspección.
    for (const p of selectedPages) {
      const viewport = (await pdfDoc.getPage(p)).getViewport({ scale: 1 });
      checkPixelBudget(Math.ceil(viewport.width), Math.ceil(viewport.height));
    }
    let usedPixels = 0;
    const scales = new Map<number, number>();
    for (const p of selectedPages) {
      const page = await pdfDoc.getPage(p),
        viewport = page.getViewport({ scale: 1 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inspeccionar la resolución del PDF.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      const gray = rgbaToGray(
        ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height
      );
      const spacings = (await previewSpacing!(gray, canvas.width, canvas.height)).sort(
        (a, b) => a - b
      );
      const scale =
        choosePdfScale(viewport.width, viewport.height, spacings[0] ?? null, usedPixels) *
        (1 - 1e-6);
      const finalViewport = page.getViewport({ scale });
      usedPixels = checkPixelBudget(
        Math.round(finalViewport.width),
        Math.round(finalViewport.height),
        usedPixels
      );
      scales.set(p, scale);
      canvas.width = 0;
      canvas.height = 0;
    }

    const pages: PageGrayBuffer[] = [];
    for (const [index, p] of selectedPages.entries()) {
      const rasterScale = scales.get(p)!;
      pages.push({
        pageNumber: p,
        width: 0,
        height: 0,
        gray: new Float32Array(0),
        imageUrl: '',
        rasterScale,
        textRegions: textByPage.get(p)?.map((region) => ({
          text: region.text,
          bbox: region.bbox.map((v) => v * rasterScale) as OmrTextRegion['bbox'],
        })),
        load: async () => {
          if (signal?.aborted) throw abortOmr();
          onProgress?.({
            stage: 'extracting-pages',
            message: `Rasterizando página ${p} (${index + 1} de ${selectedPages.length} seleccionadas)...`,
            percent: Math.round(10 + ((index + 1) / selectedPages.length) * 20),
            currentPage: p,
            totalPages: pdfDoc.numPages,
          });
          const page = await pdfDoc.getPage(p);
          const viewport = page.getViewport({ scale: rasterScale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          try {
            const ctx = canvas.getContext('2d');
            if (!ctx)
              throw new Error(
                'No se pudo inicializar el contexto Canvas 2D para renderizar el PDF.'
              );
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const renderTask = page.render({ canvasContext: ctx, canvas, viewport });
            const cancel = () => renderTask.cancel();
            signal?.addEventListener('abort', cancel, { once: true });
            try {
              await renderTask.promise;
            } finally {
              signal?.removeEventListener('abort', cancel);
            }
            const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return {
              pageNumber: p,
              width: canvas.width,
              height: canvas.height,
              gray: rgbaToGray(rgba.data, canvas.width, canvas.height),
              imageUrl: canvas.toDataURL('image/png'),
              rasterScale,
              textRegions: textByPage.get(p)?.map((region) => ({
                text: region.text,
                bbox: region.bbox.map((v) => v * rasterScale) as OmrTextRegion['bbox'],
              })),
            };
          } finally {
            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();
          }
        },
      });
    }

    return { losslessScore: null, pages, hints: page1Hints, omittedPages, close };
  } catch (error) {
    await close();
    throw error;
  }
}

/**
 * Rasteriza una imagen (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) a un buffer de luminancia Float32.
 */
async function rasterizeImageFile(file: File, signal?: AbortSignal): Promise<PageGrayBuffer> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortOmr());
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
      URL.revokeObjectURL(url);
    };
    const onAbort = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      cleanup();
      reject(abortOmr());
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        checkPixelBudget(width, height);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('No se pudo inicializar el lienzo Canvas 2D.'));
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        cleanup();

        const imgData = ctx.getImageData(0, 0, width, height);
        const gray = rgbaToGray(imgData.data, width, height);
        const imageUrl = canvas.toDataURL('image/png');
        canvas.width = 0;
        canvas.height = 0;
        resolve({
          pageNumber: 1,
          width,
          height,
          gray,
          imageUrl,
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('No se pudo decodificar el archivo de imagen seleccionado.'));
    };

    img.src = url;
  });
}

function summarizeLosslessScore(score: Score): OmrResult {
  const stavesDetected = score.staves.length;
  const measuresDetected = score.staves[0]?.measures.length || 0;
  const notesDetected = score.staves.reduce(
    (acc, st) =>
      acc +
      st.measures.reduce((mAcc, m) => mAcc + m.items.filter((it) => it.type === 'note').length, 0),
    0
  );

  return {
    score,
    confidence: 100,
    pagesProcessed: 1,
    stavesDetected,
    measuresDetected,
    notesDetected,
    sourceType: 'lossless-metadata',
    ir: null,
    sourceLinks: [],
    warnings: [],
  };
}

function recordBrowserOmrRun(result: OmrResult): OmrResult {
  if (typeof window !== 'undefined') {
    const win = window as Window & {
      __PAUTELLO_LAST_OMR_RUN__?: Omit<OmrResult, 'sourcePages'>;
    };
    const { sourcePages: _omittedPages, ...rest } = result;
    void _omittedPages;
    win.__PAUTELLO_LAST_OMR_RUN__ = rest;
  }
  return result;
}

/**
 * Ejecuta el pipeline OMR completo sobre un archivo PDF, PNG, JPG, WEBP o SVG.
 */
async function recognizeScoreFromFileOnce(
  file: File,
  onProgress?: (progress: OmrProgress) => void,
  options: OmrImportOptions = {},
  forceInt8 = false
): Promise<OmrResult> {
  const compute = createOmrCompute(options.signal, forceInt8);
  let pdfClose: (() => Promise<void>) | undefined;
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const stageTrace: OmrProgress[] = [];
    const emitProgress = (progress: OmrProgress) => {
      if (options.signal?.aborted) throw abortOmr();
      stageTrace.push(progress);
      onProgress?.(progress);
    };

    emitProgress({
      stage: 'loading-file',
      message: 'Inspeccionando estructura del documento musical...',
      percent: 5,
    });
    checkOmrFileType(ext, new Uint8Array(await file.slice(0, 1024).arrayBuffer()));

    // 1. Verificar firma sin pérdida en SVG
    if (ext === 'svg') {
      const svgText = await file.text();
      const losslessSvg = decodeScorePayloadFromText(svgText);
      if (losslessSvg) {
        emitProgress({
          stage: 'building-score',
          message: 'Partitura vectorial Pautello restaurada al 100%.',
          percent: 100,
        });
        return recordBrowserOmrRun({
          ...summarizeLosslessScore(losslessSvg),
          stageTrace,
          pageDiagnostics: [],
        });
      }
    }

    // 2. Verificar firma sin pérdida en PNG (chunk tEXt)
    if (ext === 'png') {
      const buf = await file.arrayBuffer();
      const losslessPng = extractScoreFromPngBytes(new Uint8Array(buf));
      if (losslessPng) {
        emitProgress({
          stage: 'building-score',
          message: 'Metadatos musicales PNG restaurados al 100%.',
          percent: 100,
        });
        return recordBrowserOmrRun({
          ...summarizeLosslessScore(losslessPng),
          stageTrace,
          pageDiagnostics: [],
        });
      }
    }

    let pages: PageGrayBuffer[];
    let omittedPages = 0;
    let hints: OmrMetadataHints = {
      title: file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .trim(),
    };

    if (ext === 'pdf') {
      const pdfData = await extractPdfPagesAndMetadata(
        file,
        emitProgress,
        options.pdfPageRange,
        options.signal,
        compute.previewSpacing
      );
      pdfClose = pdfData.close;
      if (pdfData.losslessScore) {
        emitProgress({
          stage: 'building-score',
          message: 'Partitura PDF de Pautello restaurada al 100%.',
          percent: 100,
        });
        return recordBrowserOmrRun({
          ...summarizeLosslessScore(pdfData.losslessScore),
          stageTrace,
          pageDiagnostics: [],
        });
      }
      pages = pdfData.pages;
      hints = pdfData.hints;
      omittedPages = pdfData.omittedPages;
    } else {
      emitProgress({
        stage: 'extracting-pages',
        message: 'Procesando imagen de la partitura en alta densidad...',
        percent: 20,
        currentPage: 1,
        totalPages: 1,
      });
      const pageBuf = await rasterizeImageFile(file, options.signal);
      pages = [pageBuf];
    }

    const preprocessedPages: Array<{
      pageNumber: number;
      inkQuality: ReturnType<typeof inspectPageInk>;
      result: ReturnType<typeof preprocessPage>;
      windowsCount: number;
    }> = [];
    const inputWarnings: OmrWarning[] = [];
    const textResult: Awaited<ReturnType<typeof recognizePageText>> = { lines: [], errors: [] };
    const indications: OmrIndication[] = [];
    const decodedLines: OmrDecodedLine[] = [];
    let totalStaves = 0;
    let totalWindows = 0;
    let processedStaves = 0;
    let modelContract: OmrActiveModelContract | null = null;
    let tokenMap: Record<number, string> | null = null;
    if (omittedPages > 0)
      inputWarnings.push({
        code: 'pages-omitted',
        severity: 'warning',
        provenance: 'observed',
        message: `Se procesaron ${pages.length} páginas; ${omittedPages} quedaron fuera del rango elegido.`,
      });
    for (const [index, source] of pages.entries()) {
      const p = source.load ? await source.load() : source;
      pages[index] = p;
      emitProgress({
        stage: 'detecting-staves',
        message: `Detectando pentagramas de la página ${p.pageNumber}...`,
        percent: Math.round(35 + (index / pages.length) * 10),
        currentPage: p.pageNumber,
        totalPages: pages.length,
      });
      const inkQuality = inspectPageInk(p.gray);
      const processed = await compute.preprocess(p.gray, p.width, p.height, options.rotation);
      p.gray = processed.gray;
      const pageObj = {
        pageNumber: p.pageNumber,
        inkQuality,
        result: processed.result,
        windowsCount: processed.result.inputs.length,
      };
      preprocessedPages.push(pageObj);
      totalStaves += pageObj.result.boxes.length;
      totalWindows += pageObj.windowsCount;
      for (const page of [pageObj]) {
        for (const bbox of page.result.systemGroupingAmbiguities)
          inputWarnings.push({
            code: 'system-grouping-ambiguous',
            severity: 'warning',
            provenance: 'inferred',
            page: page.pageNumber,
            src: {
              page: page.pageNumber,
              system: 0,
              staff: 0,
              bbox: mapBox(page.result.processedToOriginal, bbox),
            },
            message:
              'Pautas próximas sin unión visual suficiente: se conservan separadas; revisa si pertenecen al mismo sistema o a instrumentos distintos.',
          });
        if (page.result.orientation.halfTurnAmbiguous)
          inputWarnings.push({
            code: 'orientation-180-ambiguous',
            severity: 'warning',
            provenance: 'inferred',
            page: page.pageNumber,
            message: `Se usa un giro de ${page.result.orientation.quarterTurn}°. Las pautas no distinguen el sentido de lectura (0°/180°); verifica la fuente o selecciona un giro explícito al importar.`,
          });
        for (const region of page.result.regions.filter((r) => r.route === 'review')) {
          inputWarnings.push({
            code: 'source-region-pending',
            severity: 'warning',
            provenance: 'unsupported',
            page: page.pageNumber,
            src: {
              page: page.pageNumber,
              system: region.system ?? 0,
              staff: region.staff ?? 0,
              bbox: mapBox(page.result.processedToOriginal, region.bbox),
            },
            message:
              'Región conservada para revisar indicaciones, texto o notas adicionales; no se da por reconocida.',
          });
        }
        const label =
          page.inkQuality === 'empty'
            ? 'vacía'
            : page.inkQuality === 'faint'
              ? 'de contraste bajo'
              : null;
        if (label || page.result.boxes.length === 0) {
          inputWarnings.push({
            code: label ? `page-${page.inkQuality}` : 'page-no-staves',
            severity: 'warning',
            provenance: 'observed',
            page: page.pageNumber,
            message: label
              ? `La página parece ${label}; comprueba la fuente.`
              : 'No se detectaron pautas en esta página; comprueba orientación y legibilidad.',
          });
        }
        if (page.result.boxes.some((box) => box.lineSpacing < 6)) {
          inputWarnings.push({
            code: 'low-resolution',
            severity: 'warning',
            provenance: 'observed',
            page: page.pageNumber,
            message:
              'Las líneas de la pauta tienen menos de 6 píxeles de separación; ampliar la imagen no recupera detalle.',
          });
        }
      }

      emitProgress({
        stage: 'reading-text',
        message: `Leyendo indicaciones de la página ${p.pageNumber}...`,
        percent: 45,
        currentPage: p.pageNumber,
        totalPages: pages.length,
      });
      const pageText = await recognizePageText(
        [
          {
            ...p,
            staffBoxes: pageObj.result.boxes.map((box) =>
              mapBox(pageObj.result.processedToOriginal, [
                box.x,
                box.y + box.padUp,
                box.w,
                box.h - box.padUp,
              ])
            ),
            pdfText: p.textRegions,
          },
        ],
        options.signal
      ).catch((error) => {
        if (options.signal?.aborted) throw abortOmr();
        return {
          lines: [] as PageTextLine[],
          errors: [
            {
              page: p.pageNumber,
              bbox: [0, 0, p.width, p.height] as [number, number, number, number],
              message: error instanceof Error ? error.message : 'El OCR local no pudo iniciarse.',
            },
          ],
        };
      });
      textResult.lines.push(...pageText.lines);
      textResult.errors.push(...pageText.errors);
      emitProgress({
        stage: 'loading-model',
        message: 'Inicializando red neuronal CRNN-CTC en WebAssembly...',
        percent: 48,
        currentPage: p.pageNumber,
        totalPages: pages.length,
      });
      let processedStavesOnPage = 0;

      const { pageNumber, result } = pageObj;
      const staffWindows = new Map<number, OmrDecodedLine[]>();
      for (const inp of result.inputs) {
        processedStaves++;
        processedStavesOnPage++;
        const pct = Math.round(
          50 + ((index + processedStavesOnPage / pageObj.windowsCount) / pages.length) * 40
        );
        emitProgress({
          stage: 'running-inference',
          message: `Reconociendo símbolos musicales (ventana ${processedStaves} de ${totalWindows})...`,
          percent: pct,
          currentPage: pageNumber,
          totalPages: pages.length,
        });

        const inference = await compute.infer(inp.data, inp.width, inp.height);
        modelContract = inference.modelContract;
        tokenMap ??= i2wFromVocab(inference.vocabTokens);
        const dims = inference.dims; // [1, T, 142]
        verifyModelOutputCompatibility({
          vocabTokensCount: inference.vocabTokens.length,
          outputDims: dims,
          inputNames: inference.inputNames,
          outputNames: inference.outputNames,
          manifest: inference.manifest,
        });
        const T = dims[1];
        const C = dims[2];

        const tokenEvents = decodeLine(inference.logits, T, C, tokenMap);
        const staffMeta: OmrStaffMeta = {
          page: pageNumber,
          system: inp.box.system,
          staffIndex: inp.box.voice,
          bbox: mapBox(result.processedToOriginal, [inp.box.x, inp.box.y, inp.box.w, inp.box.h]),
          lineSpacingPx: inp.box.lineSpacing,
          normSpacing: TARGET_SPACING,
          truncated: inp.truncated,
          window: inp.window,
          normalizedToOriginal: inp.normalizedToOriginal,
          partLabel: findStaffLabel(
            [inp.box.x, inp.box.y, inp.box.w, inp.box.h],
            inp.box.lineSpacing,
            (pages.find((p) => p.pageNumber === pageNumber)?.textRegions ?? []).map((region) => ({
              ...region,
              bbox: mapBox(result.originalToProcessed, region.bbox),
            }))
          ),
        };

        const elements = lineFragment(tokenEvents, staffMeta);
        const windows = staffWindows.get(inp.box.staff) ?? [];
        windows.push(
          withNotationEvidence(inference.input, inp.width, inp.height, staffMeta, elements)
        );
        staffWindows.set(inp.box.staff, windows);
      }
      for (const windows of staffWindows.values()) decodedLines.push(mergeStaffWindows(windows));

      indications.push(
        ...readTextIndications(pageText.lines, [
          {
            page: p.pageNumber,
            gray: p.gray,
            width: p.width,
            height: p.height,
            staffBoxes: pageObj.result.boxes.map((box) => {
              const staffArea = mapBox(pageObj.result.processedToOriginal, [
                box.x,
                box.y + box.padUp,
                box.w,
                4 * box.lineSpacing,
              ]);
              return {
                bbox: mapBox(pageObj.result.processedToOriginal, [box.x, box.y, box.w, box.h]),
                system: box.system,
                staff: box.voice,
                staffTop: staffArea[1],
                lineSpacing: staffArea[3] / 4,
              };
            }),
          },
        ])
      );
      p.gray = new Float32Array(0);
      pageObj.result.inputs = [];
    }
    if (totalStaves === 0)
      throw new Error(
        'No se detectaron pentagramas musicales en el archivo. Asegúrate de subir una partitura legible con pautas de 5 líneas.'
      );
    let editorial: OmrResult['editorial'];
    if (textResult.lines.length) {
      const firstPage = pages[0];
      const firstStaffTop = Math.min(
        firstPage.height,
        ...preprocessedPages[0].result.boxes.map(
          (box) =>
            mapBox(preprocessedPages[0].result.processedToOriginal, [box.x, box.y, box.w, box.h])[1]
        )
      );
      const classified = classifyPageText(
        textResult.lines,
        firstPage.width,
        firstStaffTop,
        firstPage.height
      );
      editorial = { proposals: classified.proposals, unclassified: classified.unclassified };
      hints = {
        ...hints,
        title: classified.fields.title ?? hints.title,
        composer: classified.fields.composer ?? hints.composer,
        arranger: classified.fields.arranger ?? hints.arranger,
        partName: classified.fields.part ?? hints.partName,
        subtitle: classified.fields.style ?? hints.subtitle,
        copyright: classified.fields.copyright ?? hints.copyright,
        level: classified.fields.level ?? hints.level,
        collection: classified.fields.collection ?? hints.collection,
        dedication: classified.fields.dedication ?? hints.dedication,
        editorialKey: classified.fields.editorialKey ?? hints.editorialKey,
      };
    }

    for (const error of textResult.errors)
      inputWarnings.push({
        code: 'ocr-region-pending',
        severity: 'warning',
        provenance: 'unsupported',
        page: error.page,
        src: { page: error.page, system: 0, staff: 0, bbox: error.bbox },
        message: `No se pudo leer el texto de esta región: ${error.message}`,
      });
    emitProgress({
      stage: 'building-score',
      message: 'Reconstruyendo compases, armadura y voces...',
      percent: 95,
    });
    const ir = assembleIR(assignPartIdentities(decodedLines));
    ir.indications = indications;
    const initialMeter = indications.find(
      (indication) =>
        indication.kind === 'meter' &&
        indication.status === 'recognized' &&
        indication.anchor?.measureNumber === 1 &&
        indication.meter
    )?.meter;
    if (initialMeter)
      hints.timeSignature = { beats: initialMeter.beats, beatType: initialMeter.beatType };
    const initialTempo = indications.find(
      (indication) => indication.kind === 'tempo' && indication.tempo?.quarterBpm
    )?.tempo?.quarterBpm;
    if (initialTempo) hints.tempo = initialTempo;
    for (const indication of indications.filter((entry) => entry.status === 'pending'))
      inputWarnings.push({
        code: `${indication.kind}-pending`,
        severity: 'warning',
        provenance: 'unsupported',
        page: indication.src.page,
        src: indication.src,
        message:
          indication.kind === 'tempo'
            ? `Se leyó ${indication.tempo?.perMinute} por minuto, pero la figura no es segura; revisa la marca de tempo.`
            : indication.kind === 'navigation'
              ? 'El destino del salto está ausente o es ambiguo; revisa los signos de navegación.'
              : indication.kind === 'rehearsal' && indication.anchor?.measureNumber === null
                ? `Se leyó el ensayo ${indication.text}, pero su compás no es seguro.`
                : indication.kind === 'equivalence'
                  ? 'La equivalencia de figuras o el tempo anterior no son seguros; revisa esta región.'
                  : 'Indicación conservada en la fuente; revisa su lectura.',
      });
    const summary = convertOmrIrToScore(ir, hints);
    const unmappedWarnings: OmrWarning[] = summary.sourceLinks
      .filter((link) => !link.measureId)
      .map((link) => ({
        code: 'unmapped-event',
        severity: 'error',
        provenance: 'modified',
        message: `Un evento leído no aparece en la partitura editable (parte ${link.sourcePart + 1}, compás ${link.sourceMeasure + 1}).`,
        page: link.src?.page,
        system: link.src?.system,
        staff: link.src?.staff,
        src: link.src,
      }));

    if (summary.notesCount === 0) {
      throw new Error(
        'Se detectaron pentagramas pero no se pudieron extraer notas musicales válidas. Verifica el contraste y nitidez de la partitura.'
      );
    }

    emitProgress({
      stage: 'building-score',
      message: 'Lectura OMR completada.',
      percent: 100,
    });

    const pageDiagnostics: OmrPageDiagnostic[] = pages.map((page, index) => {
      const prep = preprocessedPages[index].result;
      return {
        pageNumber: page.pageNumber,
        width: page.width,
        height: page.height,
        usedThreshold: prep.usedThreshold,
        deskewAngleDeg: prep.deskewAngleDeg,
        systemsCount: prep.systems.length,
        stavesCount: prep.boxes.length,
        inkQuality: preprocessedPages[index].inkQuality,
        boxes: prep.boxes,
        rasterScale: page.rasterScale,
        orientation: prep.orientation,
        originalToProcessed: prep.originalToProcessed,
        regions: prep.regions.map((region) => ({
          ...region,
          bbox: mapBox(prep.processedToOriginal, region.bbox),
        })),
        masks: prep.masks.map((mask) => ({
          ...mask,
          bbox: mapBox(prep.processedToOriginal, mask.bbox),
        })),
        contrast: prep.contrast,
        windowsCount: preprocessedPages[index].windowsCount,
      };
    });

    return recordBrowserOmrRun({
      score: summary.score,
      confidence: summary.averageConfidence,
      pagesProcessed: pages.length,
      stavesDetected: totalStaves,
      systemsDetected: preprocessedPages.reduce((sum, p) => sum + p.result.systems.length, 0),
      partsDetected: ir.parts.length,
      windowsProcessed: totalWindows,
      measuresDetected: summary.measuresCount,
      notesDetected: summary.notesCount,
      sourceType: 'neural-onnx',
      ir,
      sourceLinks: summary.sourceLinks,
      warnings: [
        ...(modelContract?.variant === 'int8'
          ? [
              {
                code: 'model-fallback',
                severity: 'warning' as const,
                provenance: 'observed' as const,
                message: 'Se utilizó el modelo INT8 de respaldo; revisa la lectura musical.',
              },
            ]
          : []),
        ...inputWarnings,
        ...ir.warnings,
        ...summary.warnings,
        ...unmappedWarnings,
      ],
      proposals: summary.proposals,
      report: summary.report,
      metadataHints: summary.metadataHints,
      textLines: textResult.lines,
      editorial,
      indications,
      indicationPlans: summary.indicationPlans,
      stageTrace,
      pageDiagnostics,
      modelContract,
      sourcePages: pages.map((page, index) => ({
        pageNumber: page.pageNumber,
        width: page.width,
        height: page.height,
        imageUrl: page.imageUrl,
        deskewAngleDeg: preprocessedPages[index].result.deskewAngleDeg,
        coordinates: 'original',
      })),
    });
  } finally {
    compute.close();
    await pdfClose?.();
  }
}

export async function recognizeScoreFromFile(
  file: File,
  onProgress?: (progress: OmrProgress) => void,
  options: OmrImportOptions = {}
): Promise<OmrResult> {
  try {
    return await recognizeScoreFromFileOnce(file, onProgress, options);
  } catch (error) {
    if (
      options.signal?.aborted ||
      !(error instanceof Error) ||
      !error.message.startsWith('OMR_MODEL_RESTART_INT8:')
    )
      throw error;
    onProgress?.({
      stage: 'loading-model',
      message: 'FP32 falló; repitiendo la importación completa con INT8...',
      percent: 5,
    });
    return recognizeScoreFromFileOnce(file, onProgress, options, true);
  }
}
