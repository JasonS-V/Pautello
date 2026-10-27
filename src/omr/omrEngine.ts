import { Score } from '../types/music';
import {
  TARGET_SPACING,
  preprocessPage,
  rgbaToGray,
} from './omrPreprocess';
import {
  OmrDecodedLine,
  OmrStaffMeta,
  assembleIR,
  decodeLine,
  i2wFromVocab,
  lineFragment,
} from './omrDecode';
import { OmrMetadataHints, convertOmrIrToScore } from './omrToScore';
import {
  decodeScorePayloadFromText,
  extractScoreFromPngBytes,
} from './scorePayloadCodec';

export type OmrStage =
  | 'loading-file'
  | 'extracting-pages'
  | 'detecting-staves'
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

export interface OmrResult {
  score: Score;
  confidence: number;
  pagesProcessed: number;
  stavesDetected: number;
  measuresDetected: number;
  notesDetected: number;
  sourceType: 'lossless-metadata' | 'neural-onnx';
  warnings: string[];
}

interface PageGrayBuffer {
  pageNumber: number;
  width: number;
  height: number;
  gray: Float32Array;
}

interface CachedOmrRuntime {
  ort: typeof import('onnxruntime-web/wasm');
  session: import('onnxruntime-web/wasm').InferenceSession;
  i2w: Record<number, string>;
  inputName: string;
  outputName: string;
}

let cachedRuntimePromise: Promise<CachedOmrRuntime> | null = null;

function resolvePublicAssetUrl(relativePath: string): string {
  if (typeof window === 'undefined') return relativePath;
  try {
    return new URL(relativePath, window.location.href).href;
  } catch {
    return relativePath;
  }
}

/**
 * Inicializa y mantiene en caché la sesión de ONNX Runtime Web (WASM) y el vocabulario `**kern`.
 */
async function getOmrRuntime(): Promise<CachedOmrRuntime> {
  if (cachedRuntimePromise) return cachedRuntimePromise;

  cachedRuntimePromise = (async () => {
    const ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.numThreads = 1;

    const vocabUrl = resolvePublicAssetUrl('./omr/vocab.json');
    const vocabRes = await fetch(vocabUrl);
    if (!vocabRes.ok) {
      throw new Error(`No se pudo cargar el vocabulario OMR (${vocabRes.status}).`);
    }
    const vocabJson = (await vocabRes.json()) as { tokens: string[] };
    const i2w = i2wFromVocab(vocabJson.tokens);

    let modelBuffer: ArrayBuffer;
    const fp32Url = resolvePublicAssetUrl('./omr/omr-line.fp32.onnx');
    const fp32Res = await fetch(fp32Url);
    if (fp32Res.ok) {
      modelBuffer = await fp32Res.arrayBuffer();
    } else {
      const int8Url = resolvePublicAssetUrl('./omr/omr-line.int8.onnx');
      const int8Res = await fetch(int8Url);
      if (!int8Res.ok) {
        throw new Error('No se encontraron los pesos del modelo OMR en ./omr/.');
      }
      modelBuffer = await int8Res.arrayBuffer();
    }

    const session = await ort.InferenceSession.create(new Uint8Array(modelBuffer), {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    const inputName = session.inputNames[0] || 'input';
    const outputName = session.outputNames[0] || 'logits';

    return { ort, session, i2w, inputName, outputName };
  })().catch((err) => {
    cachedRuntimePromise = null;
    throw err;
  });

  return cachedRuntimePromise;
}

/**
 * Extrae metadatos editoriales (título, compositor, tempo) de los elementos de texto
 * situados en la cabecera de la primera página de un PDF vectorial.
 */
function extractHintsFromPdfTextItems(
  items: Array<{ str: string; x: number; y: number; fontSize: number }>,
  pageWidth: number,
  pageHeight: number,
  fallbackFileName: string
): OmrMetadataHints {
  const hints: OmrMetadataHints = {};
  const cleanTitleFallback = fallbackFileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

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
      .filter((it) => it !== titleCandidate && it.x > pageWidth * 0.50)
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
 * 2. Si es un PDF externo, extrae metadatos de texto y rasteriza cada página a 2.4x (~220 DPI).
 */
async function extractPdfPagesAndMetadata(
  file: File,
  onProgress?: (progress: OmrProgress) => void
): Promise<{
  losslessScore: Score | null;
  pages: PageGrayBuffer[];
  hints: OmrMetadataHints;
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

  const pdfDoc = await loadingTask.promise;
  const numPages = Math.min(pdfDoc.numPages, 20);
  const allTextChunks: string[] = [];
  let page1Hints: OmrMetadataHints = {
    title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(),
  };

  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const textContent = await page.getTextContent();
    const viewport1x = page.getViewport({ scale: 1.0 });

    const pageItems: Array<{ str: string; x: number; y: number; fontSize: number }> = [];
    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string') {
        allTextChunks.push(item.str);
        const tr = Array.isArray(item.transform) ? item.transform : [12, 0, 0, 12, 0, 0];
        const fontSize = Math.hypot(tr[0] || 12, tr[1] || 0);
        pageItems.push({
          str: item.str,
          x: tr[4] || 0,
          y: tr[5] || 0,
          fontSize,
        });
      }
    }

    if (p === 1) {
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
    await loadingTask.destroy();
    return { losslessScore: lossless, pages: [], hints: page1Hints };
  }

  const pages: PageGrayBuffer[] = [];
  for (let p = 1; p <= numPages; p++) {
    onProgress?.({
      stage: 'extracting-pages',
      message: `Rasterizando página ${p} de ${numPages} en alta resolución...`,
      percent: Math.round(10 + (p / numPages) * 20),
      currentPage: p,
      totalPages: numPages,
    });

    const page = await pdfDoc.getPage(p);
    const viewport = page.getViewport({ scale: 2.4 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo inicializar el contexto Canvas 2D para renderizar el PDF.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      canvas,
      viewport,
    }).promise;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const gray = rgbaToGray(imageData.data, canvas.width, canvas.height);

    pages.push({
      pageNumber: p,
      width: canvas.width,
      height: canvas.height,
      gray,
    });
  }

  await loadingTask.destroy();
  return { losslessScore: null, pages, hints: page1Hints };
}

/**
 * Rasteriza una imagen (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) a un buffer de luminancia Float32.
 */
async function rasterizeImageFile(file: File): Promise<PageGrayBuffer> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width || 1200;
        const naturalH = img.naturalHeight || img.height || 1600;
        // Escalar imágenes pequeñas para asegurar un espaciado de línea óptimo (~12-18px)
        const scale = naturalW < 1400 ? 2.0 : 1.0;
        const width = Math.round(naturalW * scale);
        const height = Math.round(naturalH * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('No se pudo inicializar el lienzo Canvas 2D.'));
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        const imgData = ctx.getImageData(0, 0, width, height);
        const gray = rgbaToGray(imgData.data, width, height);
        resolve({
          pageNumber: 1,
          width,
          height,
          gray,
        });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
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
      st.measures.reduce(
        (mAcc, m) => mAcc + m.items.filter((it) => it.type === 'note').length,
        0
      ),
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
    warnings: [],
  };
}

/**
 * Ejecuta el pipeline OMR completo sobre un archivo PDF, PNG, JPG, WEBP o SVG.
 */
export async function recognizeScoreFromFile(
  file: File,
  onProgress?: (progress: OmrProgress) => void
): Promise<OmrResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  onProgress?.({
    stage: 'loading-file',
    message: 'Inspeccionando estructura del documento musical...',
    percent: 5,
  });

  // 1. Verificar firma sin pérdida en SVG
  if (ext === 'svg') {
    const svgText = await file.text();
    const losslessSvg = decodeScorePayloadFromText(svgText);
    if (losslessSvg) {
      onProgress?.({
        stage: 'building-score',
        message: 'Partitura vectorial Pautello restaurada al 100%.',
        percent: 100,
      });
      return summarizeLosslessScore(losslessSvg);
    }
  }

  // 2. Verificar firma sin pérdida en PNG (chunk tEXt)
  if (ext === 'png') {
    const buf = await file.arrayBuffer();
    const losslessPng = extractScoreFromPngBytes(new Uint8Array(buf));
    if (losslessPng) {
      onProgress?.({
        stage: 'building-score',
        message: 'Metadatos musicales PNG restaurados al 100%.',
        percent: 100,
      });
      return summarizeLosslessScore(losslessPng);
    }
  }

  let pages: PageGrayBuffer[];
  let hints: OmrMetadataHints = {
    title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(),
  };

  if (ext === 'pdf') {
    const pdfData = await extractPdfPagesAndMetadata(file, onProgress);
    if (pdfData.losslessScore) {
      onProgress?.({
        stage: 'building-score',
        message: 'Partitura PDF de Pautello restaurada al 100%.',
        percent: 100,
      });
      return summarizeLosslessScore(pdfData.losslessScore);
    }
    pages = pdfData.pages;
    hints = pdfData.hints;
  } else {
    onProgress?.({
      stage: 'extracting-pages',
      message: 'Procesando imagen de la partitura en alta densidad...',
      percent: 20,
      currentPage: 1,
      totalPages: 1,
    });
    const pageBuf = await rasterizeImageFile(file);
    pages = [pageBuf];
  }

  // 3. Preprocesar páginas y aislar pentagramas
  onProgress?.({
    stage: 'detecting-staves',
    message: 'Detectando pentagramas, sistemas y geometría de líneas...',
    percent: 35,
  });

  const preprocessedPages = pages.map((p) => ({
    pageNumber: p.pageNumber,
    result: preprocessPage(p.gray, p.width, p.height),
  }));

  const totalStaves = preprocessedPages.reduce((acc, p) => acc + p.result.inputs.length, 0);
  if (totalStaves === 0) {
    throw new Error(
      'No se detectaron pentagramas musicales en el archivo. Asegúrate de subir una partitura legible con pautas de 5 líneas.'
    );
  }

  // 4. Inicializar motor ONNX Runtime Web
  onProgress?.({
    stage: 'loading-model',
    message: 'Inicializando red neuronal CRNN-CTC en WebAssembly...',
    percent: 45,
  });

  const runtime = await getOmrRuntime();
  const { ort, session, i2w, inputName, outputName } = runtime;

  // 5. Ejecutar inferencia línea por línea
  const decodedLines: OmrDecodedLine[] = [];
  let processedStaves = 0;

  for (const pageObj of preprocessedPages) {
    const { pageNumber, result } = pageObj;
    for (const inp of result.inputs) {
      processedStaves++;
      const pct = Math.round(50 + (processedStaves / totalStaves) * 40);
      onProgress?.({
        stage: 'running-inference',
        message: `Reconociendo símbolos musicales (pentagrama ${processedStaves} de ${totalStaves})...`,
        percent: pct,
        currentPage: pageNumber,
        totalPages: pages.length,
      });

      // Ceder un micro-frame al hilo de interfaz para actualizar el progreso suavemente
      await new Promise((r) => setTimeout(r, 0));

      const tensor = new ort.Tensor('float32', inp.data, [1, 1, inp.height, inp.width]);
      const feeds: Record<string, import('onnxruntime-web/wasm').Tensor> = {
        [inputName]: tensor,
      };
      const outputMap = await session.run(feeds);
      const logitsTensor = outputMap[outputName];
      const dims = logitsTensor.dims; // [1, T, 142]
      const T = dims[1];
      const C = dims[2];
      const logitsData = logitsTensor.data as Float32Array;

      const tokenEvents = decodeLine(logitsData, T, C, i2w);
      const staffMeta: OmrStaffMeta = {
        page: pageNumber,
        system: inp.box.system,
        staffIndex: inp.box.voice,
        bbox: [inp.box.x, inp.box.y, inp.box.w, inp.box.h],
        lineSpacingPx: inp.box.lineSpacing,
        normSpacing: TARGET_SPACING,
        truncated: inp.truncated,
      };

      const elements = lineFragment(tokenEvents, staffMeta);
      decodedLines.push({ staff: staffMeta, elements });
    }
  }

  // 6. Ensamblar representación intermedia y sintetizar Score de Pautello
  onProgress?.({
    stage: 'building-score',
    message: 'Reconstruyendo compases, armadura y voces...',
    percent: 95,
  });

  const ir = assembleIR(decodedLines);
  const summary = convertOmrIrToScore(ir, hints);

  if (summary.notesCount === 0) {
    throw new Error(
      'Se detectaron pentagramas pero no se pudieron extraer notas musicales válidas. Verifica el contraste y nitidez de la partitura.'
    );
  }

  onProgress?.({
    stage: 'building-score',
    message: 'Lectura OMR completada.',
    percent: 100,
  });

  return {
    score: summary.score,
    confidence: summary.averageConfidence,
    pagesProcessed: pages.length,
    stavesDetected: totalStaves,
    measuresDetected: summary.measuresCount,
    notesDetected: summary.notesCount,
    sourceType: 'neural-onnx',
    warnings: ir.warnings.map((w) => w.message),
  };
}
