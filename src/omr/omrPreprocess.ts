/**
 * Preprocesamiento geométrico y normalización de páginas de partitura para el motor OMR ONNX.
 *
 * Incluye:
 * 1. Conversión de RGBA / bytes a luminancia Float32 en [0, 1] (blanco = 1.0, tinta = 0.0).
 * 2. Enderezado automático (auto-deskew) por maximización de varianza de proyección horizontal.
 * 3. Detección de las 5 líneas del pentagrama con barrido multiumbral adaptativo (para pautas
 *    negras estándar y pautas grises anti-aliased como `#cbd5e1`).
 * 4. Agrupación en sistemas (1 pauta, Gran Pentagrama de 2 pautas o ensambles de N pautas).
 * 5. Remuestreo bilineal en precisión float32 a `TARGET_HEIGHT = 128` y `TARGET_SPACING = 10.0`.
 */

export const INK_THRESHOLD = 0.6;
export const TARGET_SPACING = 10.0;
export const TARGET_HEIGHT = 128;
export const MAX_WIDTH = 3600;

const fr = Math.fround;

export interface DetectedStaff {
  top: number;
  bottom: number;
  lineSpacing: number;
  lineCenters: number[];
}

export interface StaffCropBox {
  staff: number;
  system: number;
  voice: number;
  x: number;
  y: number;
  w: number;
  h: number;
  lineSpacing: number;
  padUp: number;
  padDown: number;
}

export interface StaffDetectionResult {
  lineRuns: number;
  staves: DetectedStaff[];
  systems: number[][];
  boxes: StaffCropBox[];
  usedThreshold: number;
}

export interface NormalizedStaffTensor {
  box: StaffCropBox;
  data: Float32Array;
  width: number;
  height: number;
  truncated: boolean;
}

export interface PreprocessPageResult {
  boxes: StaffCropBox[];
  inputs: NormalizedStaffTensor[];
  systems: number[][];
  usedThreshold: number;
  deskewAngleDeg: number;
}

/** Redondeo par (round-half-even) idéntico a `round()` de Python/NumPy. */
function pyRoundInt(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** Convierte un buffer de bytes en escala de grises [0..255] a Float32Array en [0, 1]. */
export function grayFromBytes(bytes: ArrayLike<number>, n: number = bytes.length): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = fr(bytes[i] / 255);
  }
  return out;
}

/**
 * Convierte un buffer RGBA (4 bytes por píxel, como `ImageData.data` de Canvas)
 * a luminancia Float32Array en [0, 1] componiendo canales transparentes sobre blanco.
 */
export function rgbaToGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Float32Array {
  const n = width * height;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const idx = i * 4;
    const alpha = rgba[idx + 3] / 255;
    const r = rgba[idx] * alpha + 255 * (1 - alpha);
    const g = rgba[idx + 1] * alpha + 255 * (1 - alpha);
    const b = rgba[idx + 2] * alpha + 255 * (1 - alpha);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    out[i] = fr(lum / 255);
  }
  return out;
}

export function binarize(
  gray: Float32Array,
  width: number,
  height: number,
  threshold: number = INK_THRESHOLD
): Uint8Array {
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    ink[i] = gray[i] < threshold ? 1 : 0;
  }
  return ink;
}

function longestRuns(ink: Uint8Array, width: number, height: number, threshold: number): Int32Array {
  const best = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = 0; x < width; x++) sum += ink[row + x];
    if (sum < threshold) continue;
    let run = 0;
    let b = 0;
    for (let x = 0; x < width; x++) {
      run = ink[row + x] ? run + 1 : 0;
      if (run > b) b = run;
    }
    best[y] = b;
  }
  return best;
}

export function findStaffLines(
  ink: Uint8Array,
  width: number,
  height: number,
  minRunFrac: number = 0.1
): Array<[number, number]> {
  const threshold = minRunFrac * width;
  const best = longestRuns(ink, width, height, threshold);
  const runs: Array<[number, number]> = [];
  let start: number | null = null;
  for (let y = 0; y < height; y++) {
    const v = best[y] >= threshold;
    if (v && start === null) {
      start = y;
    } else if (!v && start !== null) {
      runs.push([start, y - 1]);
      start = null;
    }
  }
  if (start !== null) runs.push([start, height - 1]);
  return runs;
}

function evenlySpaced(vals: number[], tolerance: number): boolean {
  let mn = Infinity;
  let mx = -Infinity;
  let sum = 0;
  for (let k = 0; k + 1 < vals.length; k++) {
    const gap = vals[k + 1] - vals[k];
    if (gap < mn) mn = gap;
    if (gap > mx) mx = gap;
    sum += gap;
  }
  if (mn <= 1.5) return false;
  return mx - mn <= tolerance * (sum / (vals.length - 1));
}

function fits(anchors: number[][], idx: number[], tolerance: number): boolean {
  for (const a of anchors) {
    const vals = idx.map((j) => a[j]);
    if (evenlySpaced(vals, tolerance)) return true;
  }
  return false;
}

function groupPass(count: number, anchors: number[][], tolerance: number): number[][] {
  const picked: number[][] = [];
  let i = 0;
  while (i + 4 < count) {
    const straight = [i, i + 1, i + 2, i + 3, i + 4];
    if (fits(anchors, straight, tolerance)) {
      picked.push(straight);
      i += 5;
      continue;
    }
    let found: number[] | null = null;
    if (i + 5 < count) {
      for (let skip = 0; skip < 6; skip++) {
        const idx: number[] = [];
        for (let j = i; j < i + 6; j++) {
          if (j !== i + skip) idx.push(j);
        }
        if (fits(anchors, idx, tolerance)) {
          found = idx;
          break;
        }
      }
    }
    if (found) {
      picked.push(found);
      i = found[found.length - 1] + 1;
    } else {
      i += 1;
    }
  }
  return picked;
}

export function groupLinesIntoStaves(
  runs: Array<[number, number]>,
  tolerance: number = 0.45
): DetectedStaff[] {
  if (runs.length < 5) return [];
  const tops = runs.map((r) => r[0]);
  const bottoms = runs.map((r) => r[1]);
  const centers = runs.map((r) => (r[0] + r[1]) / 2.0);
  const anchors = [centers, tops, bottoms];

  function spacingOf(idx: number[]): number {
    let bestSpread = Infinity;
    let bestMean = 0;
    for (const a of anchors) {
      let mn = Infinity;
      let mx = -Infinity;
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        const gap = a[idx[k + 1]] - a[idx[k]];
        if (gap < mn) mn = gap;
        if (gap > mx) mx = gap;
        sum += gap;
      }
      const spread = mx - mn;
      if (spread < bestSpread) {
        bestSpread = spread;
        bestMean = sum / 4.0;
      }
    }
    return bestMean;
  }

  return groupPass(runs.length, anchors, tolerance).map((idx) => ({
    top: runs[idx[0]][0],
    bottom: runs[idx[4]][1],
    lineSpacing: spacingOf(idx),
    lineCenters: idx.map((j) => centers[j]),
  }));
}

export function findSystems(
  ink: Uint8Array,
  width: number,
  staves: DetectedStaff[],
  minSpanFrac: number = 0.8
): number[][] {
  if (staves.length === 0) return [];
  const systems: number[][] = [[0]];
  for (let i = 1; i < staves.length; i++) {
    const gapTop = staves[i - 1].bottom + 1;
    const gapBot = staves[i].top - 1;
    let joined = false;
    if (gapBot > gapTop) {
      const rows = gapBot - gapTop + 1;
      for (let x = 0; x < width && !joined; x++) {
        let colSum = 0;
        for (let y = gapTop; y <= gapBot; y++) {
          colSum += ink[y * width + x];
        }
        if (colSum / rows >= minSpanFrac) joined = true;
      }
    }
    if (joined) systems[systems.length - 1].push(i);
    else systems.push([i]);
  }
  return systems;
}

export function growEdge(
  ink: Uint8Array,
  width: number,
  height: number,
  x0: number,
  x1: number,
  yStart: number,
  direction: -1 | 1,
  spacing: number,
  limit: number | null = null,
  minPadRatio: number = 2.0,
  maxPadRatio: number = 3.0,
  gapRatio: number = 0.8
): number {
  const minPad = pyRoundInt(minPadRatio * spacing);
  let maxPad = pyRoundInt(maxPadRatio * spacing);
  if (limit !== null) maxPad = Math.min(maxPad, Math.trunc(limit));
  maxPad = Math.max(maxPad, minPad);
  const gapNeed = Math.max(1, pyRoundInt(gapRatio * spacing));

  let pad = minPad;
  let runEmpty = 0;
  let y = yStart + direction * minPad;
  while (pad < maxPad) {
    y += direction;
    if (y < 0 || y >= height) break;
    let any = false;
    const row = y * width;
    for (let x = x0; x < x1; x++) {
      if (ink[row + x]) {
        any = true;
        break;
      }
    }
    runEmpty = any ? 0 : runEmpty + 1;
    if (runEmpty >= gapNeed) {
      pad -= runEmpty - 1;
      break;
    }
    pad += 1;
  }
  return Math.max(minPad, Math.min(pad, maxPad));
}

export function staffBoxes(
  ink: Uint8Array,
  width: number,
  height: number,
  staves: DetectedStaff[],
  systems: number[][]
): StaffCropBox[] {
  const boxes: StaffCropBox[] = [];
  for (let sysIdx = 0; sysIdx < systems.length; sysIdx++) {
    const staffIds = systems[sysIdx];
    const top = staves[staffIds[0]].top;
    const bottom = staves[staffIds[staffIds.length - 1]].bottom;
    let x0 = 0;
    let x1 = width;
    let anyCol = false;
    let first = -1;
    let last = -1;
    for (let x = 0; x < width; x++) {
      let colAny = false;
      for (let y = top; y <= bottom; y++) {
        if (ink[y * width + x]) {
          colAny = true;
          break;
        }
      }
      if (colAny) {
        if (first < 0) first = x;
        last = x;
        anyCol = true;
      }
    }
    if (anyCol) {
      x0 = first;
      x1 = last + 1;
    }

    for (let voiceIdx = 0; voiceIdx < staffIds.length; voiceIdx++) {
      const s = staves[staffIds[voiceIdx]];
      const spacing = s.lineSpacing;
      const upLimit =
        voiceIdx > 0 ? (s.top - staves[staffIds[voiceIdx - 1]].bottom) / 2 : null;
      const downLimit =
        voiceIdx + 1 < staffIds.length
          ? (staves[staffIds[voiceIdx + 1]].top - s.bottom) / 2
          : null;

      const padUp = growEdge(ink, width, height, x0, x1, s.top, -1, spacing, upLimit);
      const padDown = growEdge(ink, width, height, x0, x1, s.bottom, 1, spacing, downLimit);

      const y0 = Math.max(0, s.top - padUp);
      const y1 = Math.min(height, s.bottom + padDown);
      boxes.push({
        staff: staffIds[voiceIdx],
        system: sysIdx,
        voice: voiceIdx,
        x: x0,
        y: y0,
        w: x1 - x0,
        h: y1 - y0,
        lineSpacing: spacing,
        padUp,
        padDown,
      });
    }
  }
  return boxes;
}

export function detect(
  gray: Float32Array,
  width: number,
  height: number,
  threshold: number = INK_THRESHOLD,
  minRunFrac: number = 0.1
): StaffDetectionResult {
  const ink = binarize(gray, width, height, threshold);
  const runs = findStaffLines(ink, width, height, minRunFrac);
  const staves = groupLinesIntoStaves(runs);
  const systems = findSystems(ink, width, staves);
  return {
    lineRuns: runs.length,
    staves,
    systems,
    boxes: staffBoxes(ink, width, height, staves, systems),
    usedThreshold: threshold,
  };
}

/**
 * Detección multiumbral adaptativa:
 * 1. Intenta con el umbral canónico `0.60` y `minRunFrac = 0.10`.
 * 2. Si no halla pautas (p. ej. líneas grises `#cbd5e1` con luminancia `~0.83`),
 *    prueba umbrales progresivos `[0.75, 0.86, 0.92, 0.45]` con `minRunFrac = 0.06`.
 */
export function detectAdaptive(
  gray: Float32Array,
  width: number,
  height: number
): StaffDetectionResult {
  const primary = detect(gray, width, height, INK_THRESHOLD, 0.1);
  if (primary.boxes.length > 0) return primary;

  const fallbackCandidates: Array<{ threshold: number; minRun: number }> = [
    { threshold: 0.75, minRun: 0.08 },
    { threshold: 0.86, minRun: 0.06 },
    { threshold: 0.92, minRun: 0.05 },
    { threshold: 0.45, minRun: 0.08 },
  ];

  let bestResult = primary;
  for (const cand of fallbackCandidates) {
    const res = detect(gray, width, height, cand.threshold, cand.minRun);
    if (res.boxes.length > bestResult.boxes.length) {
      bestResult = res;
      if (bestResult.boxes.length >= 1 && cand.threshold <= 0.86) {
        break;
      }
    }
  }

  return bestResult;
}

export function resizeBilinear(
  img: Float32Array,
  inH: number,
  inW: number,
  outH: number,
  outW: number
): Float32Array {
  if (inH === outH && inW === outW) return Float32Array.from(img);
  const out = new Float32Array(outH * outW);

  const scaleY = fr(inH / outH);
  const scaleX = fr(inW / outW);
  const y0 = new Int32Array(outH);
  const y1 = new Int32Array(outH);
  const wy = new Float64Array(outH);
  for (let i = 0; i < outH; i++) {
    let v = fr(fr(fr(fr(i) + 0.5) * scaleY) - 0.5);
    if (v < 0) v = 0;
    if (v > inH - 1) v = fr(inH - 1);
    const f = Math.floor(v);
    y0[i] = f;
    y1[i] = Math.min(f + 1, inH - 1);
    wy[i] = fr(v - f);
  }
  const x0 = new Int32Array(outW);
  const x1 = new Int32Array(outW);
  const wx = new Float64Array(outW);
  for (let j = 0; j < outW; j++) {
    let v = fr(fr(fr(fr(j) + 0.5) * scaleX) - 0.5);
    if (v < 0) v = 0;
    if (v > inW - 1) v = fr(inW - 1);
    const f = Math.floor(v);
    x0[j] = f;
    x1[j] = Math.min(f + 1, inW - 1);
    wx[j] = fr(v - f);
  }

  for (let i = 0; i < outH; i++) {
    const rTop = y0[i] * inW;
    const rBot = y1[i] * inW;
    const w = wy[i];
    const o = i * outW;
    for (let j = 0; j < outW; j++) {
      const top = img[rTop + x0[j]] * (1 - wx[j]) + img[rTop + x1[j]] * wx[j];
      const bot = img[rBot + x0[j]] * (1 - wx[j]) + img[rBot + x1[j]] * wx[j];
      out[o + j] = top * (1 - w) + bot * w;
    }
  }
  return out;
}

export function normalizeStaff(
  crop: Float32Array,
  cropWidth: number,
  cropHeight: number,
  lineSpacing: number,
  staffOffset: number | null = null,
  targetSpacing: number = TARGET_SPACING,
  targetHeight: number = TARGET_HEIGHT
): { data: Float32Array; width: number; height: number } {
  const scale = targetSpacing / lineSpacing;
  const outH = Math.max(1, pyRoundInt(cropHeight * scale));
  const outW = Math.max(1, pyRoundInt(cropWidth * scale));
  const scaled = resizeBilinear(crop, cropHeight, cropWidth, outH, outW);

  const canvas = new Float32Array(targetHeight * outW).fill(1);

  let top: number;
  if (staffOffset === null) {
    top = Math.floor((targetHeight - outH) / 2);
  } else {
    const staffTopScaled = staffOffset * scale;
    const want = (targetHeight - 4 * targetSpacing) / 2.0;
    top = pyRoundInt(want - staffTopScaled);
  }

  const srcY0 = Math.max(0, -top);
  const srcY1 = Math.min(outH, targetHeight - top);
  const dstY0 = Math.max(0, top);
  for (let y = srcY0; y < srcY1; y++) {
    const src = y * outW;
    const dst = (dstY0 + (y - srcY0)) * outW;
    for (let x = 0; x < outW; x++) {
      canvas[dst + x] = scaled[src + x];
    }
  }
  return { data: canvas, width: outW, height: targetHeight };
}

/**
 * Enderezado rápido de página: evalúa la nitidez de la proyección horizontal
 * entre -2.0° y +2.0° para corregir escaneos torcidos sin alterar documentos digitales rectos.
 */
export function deskewGray(
  gray: Float32Array,
  width: number,
  height: number
): { gray: Float32Array; angleDeg: number } {
  if (width < 120 || height < 80) {
    return { gray, angleDeg: 0 };
  }

  const step = Math.max(1, Math.floor(Math.min(width, height) / 300));
  const sw = Math.floor(width / step);
  const sh = Math.floor(height / step);

  const scoreAngle = (deg: number): number => {
    const rad = (deg * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    const cx = width / 2;
    const cy = height / 2;
    let varianceSum = 0;
    let prevRowInk = 0;

    for (let sy = 0; sy < sh; sy++) {
      const y = sy * step - cy;
      let rowInk = 0;
      for (let sx = 0; sx < sw; sx++) {
        const x = sx * step - cx;
        const rx = Math.round(x * cos - y * sin + cx);
        const ry = Math.round(x * sin + y * cos + cy);
        if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
          const val = gray[ry * width + rx];
          if (val < 0.75) rowInk += 1 - val;
        }
      }
      const diff = rowInk - prevRowInk;
      varianceSum += diff * diff;
      prevRowInk = rowInk;
    }
    return varianceSum;
  };

  const zeroScore = scoreAngle(0);
  let bestAngle = 0;
  let bestScore = zeroScore;

  for (const deg of [-2.0, -1.5, -1.0, -0.5, 0.5, 1.0, 1.5, 2.0]) {
    const s = scoreAngle(deg);
    if (s > bestScore) {
      bestScore = s;
      bestAngle = deg;
    }
  }

  // Solo rotar si mejora la nitidez horizontal en más de un 15%
  if (bestAngle === 0 || bestScore < zeroScore * 1.15) {
    return { gray, angleDeg: 0 };
  }

  for (const delta of [-0.3, -0.2, -0.1, 0.1, 0.2, 0.3]) {
    const cand = Math.round((bestAngle + delta) * 10) / 10;
    const s = scoreAngle(cand);
    if (s > bestScore) {
      bestScore = s;
      bestAngle = cand;
    }
  }

  const rad = (bestAngle * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const cx = width / 2;
  const cy = height / 2;
  const rotated = new Float32Array(width * height).fill(1);

  for (let y = 0; y < height; y++) {
    const dy = y - cy;
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const sx = Math.round(dx * cos - dy * sin + cx);
      const sy = Math.round(dx * sin + dy * cos + cy);
      if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
        rotated[rowOff + x] = gray[sy * width + sx];
      }
    }
  }

  return { gray: rotated, angleDeg: bestAngle };
}

/**
 * Pipeline completo de preprocesamiento de página con soporte adaptativo para pautas tenues
 * y recortes de una sola línea.
 */
export function preprocessPage(
  rawGray: Float32Array,
  width: number,
  height: number,
  opts: {
    targetSpacing?: number;
    targetHeight?: number;
    maxWidth?: number;
    threshold?: number;
    enableDeskew?: boolean;
  } = {}
): PreprocessPageResult {
  const targetSpacing = opts.targetSpacing ?? TARGET_SPACING;
  const targetHeight = opts.targetHeight ?? TARGET_HEIGHT;
  const maxWidth = opts.maxWidth ?? Math.round((MAX_WIDTH * targetSpacing) / 10.0);

  const { gray, angleDeg } =
    opts.enableDeskew !== false
      ? deskewGray(rawGray, width, height)
      : { gray: rawGray, angleDeg: 0 };

  let det =
    opts.threshold !== undefined
      ? detect(gray, width, height, opts.threshold)
      : detectAdaptive(gray, width, height);

  // Fallback para recortes directos de un único pentagrama (ej. imagen apaisada de 1 sola línea)
  if (det.boxes.length === 0 && width > height * 2 && height >= 40 && height <= 360) {
    const estSpacing = Math.max(6, height / 10);
    const singleBox: StaffCropBox = {
      staff: 0,
      system: 0,
      voice: 0,
      x: 0,
      y: 0,
      w: width,
      h: height,
      lineSpacing: estSpacing,
      padUp: Math.round((height - 4 * estSpacing) / 2),
      padDown: Math.round((height - 4 * estSpacing) / 2),
    };
    det = {
      lineRuns: 5,
      staves: [
        {
          top: singleBox.padUp,
          bottom: height - singleBox.padDown,
          lineSpacing: estSpacing,
          lineCenters: [0, 1, 2, 3, 4].map((i) => singleBox.padUp + i * estSpacing),
        },
      ],
      systems: [[0]],
      boxes: [singleBox],
      usedThreshold: INK_THRESHOLD,
    };
  }

  const enhanceFaintInk = det.usedThreshold > 0.65;
  const inputs: NormalizedStaffTensor[] = [];

  for (const box of det.boxes) {
    const crop = new Float32Array(box.w * box.h);
    for (let y = 0; y < box.h; y++) {
      const src = (box.y + y) * width + box.x;
      const dst = y * box.w;
      for (let x = 0; x < box.w; x++) {
        let v = gray[src + x];
        if (enhanceFaintInk && v < det.usedThreshold) {
          // Oscurecer pautas grises claras (como #cbd5e1) para igualar la distribución de tinta del modelo ONNX
          v = fr(Math.max(0, (v - 0.35) * 0.45));
        }
        crop[dst + x] = v;
      }
    }

    // Suprimir elementos periféricos fuera de la pauta que confunden a la red neuronal:
    // 1. En la zona de clave y armadura (primer 20% del pentagrama), borrar cualquier símbolo
    //    situado por encima de la clave (> 0.95 espacios sobre la primera línea), como el Segno 𝄋,
    //    para evitar que se interprete erróneamente como un sostenido (F#).
    const clefMarginW = Math.round(Math.min(box.w * 0.2, box.lineSpacing * 12));
    const clefCeiling = Math.max(0, box.padUp - Math.round(box.lineSpacing * 0.95));
    for (let y = 0; y < clefCeiling; y++) {
      const rowDst = y * box.w;
      for (let x = 0; x < clefMarginW; x++) {
        crop[rowDst + x] = 1.0;
      }
    }

    // 2. A lo largo del resto del pentagrama, suprimir texto, números de compás (ej. 11, 19, 28, 39, 50, 52),
    //    letras de ensayo [A], [B], indicaciones de tempo o modulación métrica situadas por encima de las notas (> 1.8 espacios).
    const staffCeiling = Math.max(0, box.padUp - Math.round(box.lineSpacing * 1.8));
    for (let y = 0; y < staffCeiling; y++) {
      const rowDst = y * box.w;
      for (let x = clefMarginW; x < box.w; x++) {
        crop[rowDst + x] = 1.0;
      }
    }

    // 3. Suprimir notas al pie, texto de copyright o pies de página por debajo de 1.8 espacios de la quinta línea.
    const staffFloor = Math.min(box.h, box.padUp + Math.round(box.lineSpacing * 5.8));
    for (let y = staffFloor; y < box.h; y++) {
      const rowDst = y * box.w;
      for (let x = 0; x < box.w; x++) {
        crop[rowDst + x] = 1.0;
      }
    }

    const norm = normalizeStaff(
      crop,
      box.w,
      box.h,
      box.lineSpacing,
      box.padUp,
      targetSpacing,
      targetHeight
    );

    let w = norm.width;
    let truncated = false;
    if (w > maxWidth) {
      w = maxWidth;
      truncated = true;
    }

    const data = new Float32Array(norm.height * w);
    for (let y = 0; y < norm.height; y++) {
      const src = y * norm.width;
      const dst = y * w;
      for (let x = 0; x < w; x++) {
        data[dst + x] = 1.0 - norm.data[src + x];
      }
    }

    inputs.push({ box, data, width: w, height: norm.height, truncated });
  }

  return {
    boxes: det.boxes,
    inputs,
    systems: det.systems,
    usedThreshold: det.usedThreshold,
    deskewAngleDeg: angleDeg,
  };
}
