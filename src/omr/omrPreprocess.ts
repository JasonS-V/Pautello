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

import {
  composeTransform,
  invertTransform,
  rotatePage,
  type Box,
  type Transform,
} from './omrGeometry';
import { contrastVariants, preservesSymbols, type ContrastMode } from './omrContrast';

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
  quality?: number;
  left?: number;
  right?: number;
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
  originalCrop: Float32Array;
  window: { index: number; start: number; end: number; fullWidth: number; contextPrefix?: number };
  normalizedToOriginal: Transform;
}

export interface OmrRegion {
  id: string;
  bbox: Box;
  staff?: number;
  system?: number;
  route: 'notes' | 'review';
  reason: 'music' | 'outside-note-tensor' | 'peripheral-ink';
}

export interface OmrMask {
  bbox: Box;
  reason: 'peripheral-ink';
  applied: false;
}

export interface PreprocessPageResult {
  boxes: StaffCropBox[];
  inputs: NormalizedStaffTensor[];
  systems: number[][];
  usedThreshold: number;
  deskewAngleDeg: number;
  width: number;
  height: number;
  originalToProcessed: Transform;
  processedToOriginal: Transform;
  orientation: { quarterTurn: number; halfTurnAmbiguous: boolean };
  regions: OmrRegion[];
  systemGroupingAmbiguities: Box[];
  masks: OmrMask[];
  contrast: { selected: 'original' | 'local' | 'adaptive'; scores: Record<string, number> };
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
export function rgbaToGray(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): Float32Array {
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

function longestRuns(
  ink: Uint8Array,
  width: number,
  height: number,
  threshold: number
): Int32Array {
  const best = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = 0; x < width; x++) sum += ink[row + x];
    if (sum < threshold) continue;
    let run = 0;
    let gap = 0;
    let b = 0;
    for (let x = 0; x < width; x++) {
      if (ink[row + x]) {
        run++;
        gap = 0;
      } else if (run && gap < Math.max(2, Math.floor(width * 0.004))) {
        gap++;
        run++;
      } else {
        run = 0;
        gap = 0;
      }
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
    const spacing = (staves[i - 1].lineSpacing + staves[i].lineSpacing) / 2;
    const startOf = (s: DetectedStaff) =>
      s.left ??
      ink
        .subarray(Math.round(s.lineCenters[0]) * width, (Math.round(s.lineCenters[0]) + 1) * width)
        .findIndex((v) => v === 1);
    const left = Math.max(0, startOf(staves[i - 1]), startOf(staves[i]));
    const right = Math.min(staves[i - 1].right ?? width, staves[i].right ?? width);
    const columns: number[] = [];
    if (gapBot > gapTop && gapBot - gapTop <= spacing * 12) {
      const rows = gapBot - gapTop + 1;
      for (let x = left; x < right; x++) {
        let colSum = 0;
        for (let y = gapTop; y <= gapBot; y++) {
          colSum += ink[y * width + x];
        }
        if (
          colSum / rows >= minSpanFrac &&
          (columns.length === 0 || x - columns[columns.length - 1] > spacing)
        )
          columns.push(x);
      }
      // Una llave/barra inicial requiere además proximidad; una barra aislada interior no une partes.
      joined =
        columns.length >= 2 ||
        (columns.some((x) => x - left < spacing * 2) && gapBot - gapTop <= spacing * 8);
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
      const upLimit = voiceIdx > 0 ? (s.top - staves[staffIds[voiceIdx - 1]].bottom) / 2 : null;
      const downLimit =
        voiceIdx + 1 < staffIds.length ? (staves[staffIds[voiceIdx + 1]].top - s.bottom) / 2 : null;

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
  const staves = groupLinesIntoStaves(runs).filter((staff) => {
    const extents = staff.lineCenters.map((center) => {
      const y = Math.round(center);
      let left = width,
        right = 0,
        count = 0;
      for (let x = 0; x < width; x++)
        if (ink[y * width + x]) {
          left = Math.min(left, x);
          right = x + 1;
          count++;
        }
      return { left, right, count };
    });
    staff.left = Math.max(...extents.map((e) => e.left));
    staff.right = Math.min(...extents.map((e) => e.right));
    const span = Math.max(1, staff.right - staff.left);
    const continuity = Math.min(...extents.map((e) => e.count / span));
    const gaps = staff.lineCenters.slice(1).map((v, i) => v - staff.lineCenters[i]);
    const parallelism = 1 - (Math.max(...gaps) - Math.min(...gaps)) / staff.lineSpacing;
    staff.quality = Math.max(0, Math.min(1, continuity)) * Math.max(0, parallelism);
    return span >= width * minRunFrac && staff.quality >= 0.55;
  });
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

  const fallbackCandidates: Array<{ threshold: number; minRun: number }> = [
    { threshold: 0.75, minRun: 0.08 },
    { threshold: 0.86, minRun: 0.06 },
    { threshold: 0.92, minRun: 0.05 },
    { threshold: 0.45, minRun: 0.08 },
  ];

  const staves = [...primary.staves];
  let usedThreshold = primary.usedThreshold;
  for (const cand of fallbackCandidates) {
    const res = detect(gray, width, height, cand.threshold, cand.minRun);
    for (const staff of res.staves) {
      const existing = staves.findIndex(
        (s) => Math.abs(s.top - staff.top) < Math.min(s.lineSpacing, staff.lineSpacing) * 2
      );
      if (existing < 0) {
        staves.push(staff);
        usedThreshold = Math.max(usedThreshold, cand.threshold);
      } else if ((staff.quality ?? 0) > (staves[existing].quality ?? 0)) staves[existing] = staff;
    }
  }
  staves.sort((a, b) => a.top - b.top);
  const ink = binarize(gray, width, height, usedThreshold);
  const systems = findSystems(ink, width, staves);
  return {
    staves,
    systems,
    boxes: staffBoxes(ink, width, height, staves, systems),
    usedThreshold,
    lineRuns: staves.length * 5,
  };
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

  const candidate = rotatePage(gray, width, height, -bestAngle);
  const quality = (image: Float32Array, w: number, h: number) =>
    detectAdaptive(image, w, h).staves.reduce((sum, staff) => sum + (staff.quality ?? 0), 0);
  if (
    quality(candidate.gray, candidate.width, candidate.height) <=
    quality(gray, width, height) * 1.01
  )
    return { gray, angleDeg: 0 };
  return { gray: candidate.gray, angleDeg: bestAngle };
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
    rotation?: 0 | 90 | 180 | 270;
    contrast?: ContrastMode;
  } = {}
): PreprocessPageResult {
  const targetSpacing = opts.targetSpacing ?? TARGET_SPACING;
  const targetHeight = opts.targetHeight ?? TARGET_HEIGHT;
  const maxWidth = opts.maxWidth ?? Math.round((MAX_WIDTH * targetSpacing) / 10.0);

  let oriented = rotatePage(rawGray, width, height, opts.rotation ?? 0);
  let quarterTurn = opts.rotation ?? 0;
  if (opts.rotation === undefined) {
    const horizontal = detectAdaptive(rawGray, width, height);
    // Las cinco líneas no distinguen 0° de 180°: conservar esa ambigüedad para revisión.
    if (!horizontal.staves.length) {
      const candidate = rotatePage(rawGray, width, height, 90);
      const correction =
        opts.enableDeskew !== false
          ? deskewGray(candidate.gray, candidate.width, candidate.height).angleDeg
          : 0;
      const checked = rotatePage(candidate.gray, candidate.width, candidate.height, -correction);
      if (detectAdaptive(checked.gray, checked.width, checked.height).staves.length) {
        oriented = candidate;
        quarterTurn = 90;
      }
    }
  }
  const angleDeg =
    opts.enableDeskew !== false
      ? deskewGray(oriented.gray, oriented.width, oriented.height).angleDeg
      : 0;
  const deskewed = rotatePage(oriented.gray, oriented.width, oriented.height, -angleDeg);
  const originalToProcessed = composeTransform(deskewed.transform, oriented.transform);
  const processedToOriginal = invertTransform(originalToProcessed);
  width = deskewed.width;
  height = deskewed.height;
  let gray = deskewed.gray;
  let det =
    opts.threshold !== undefined
      ? detect(gray, width, height, opts.threshold)
      : detectAdaptive(gray, width, height);
  const score = (d: StaffDetectionResult, image: Float32Array) =>
    d.staves.reduce((sum, s) => {
      let strength = 0,
        count = 0;
      for (const center of s.lineCenters)
        for (let x = s.left ?? 0; x < (s.right ?? width); x++) {
          strength += 1 - image[Math.round(center) * width + x];
          count++;
        }
      return sum + (s.quality ?? 0) * (0.5 + (0.5 * strength) / Math.max(1, count));
    }, 0);
  const scores: Record<string, number> = { original: score(det, gray) };
  let selected: ContrastMode = 'original';
  const variants = contrastVariants(gray, width, height);
  for (const mode of ['local', 'adaptive'] as const) {
    const candidate = detectAdaptive(variants[mode], width, height);
    scores[mode] = score(candidate, variants[mode]);
    if (
      opts.contrast === mode ||
      (opts.contrast === undefined &&
        scores[mode] > score(det, gray) * 1.1 &&
        preservesSymbols(deskewed.gray, variants[mode]) &&
        candidate.staves.length >= det.staves.length)
    ) {
      selected = mode;
      gray = variants[mode];
      det = candidate;
    }
  }
  const inputs: NormalizedStaffTensor[] = [];
  const regions: OmrRegion[] = [];
  const masks: OmrMask[] = [];

  for (const box of det.boxes) {
    const crop = new Float32Array(box.w * box.h);
    for (let y = 0; y < box.h; y++) {
      const src = (box.y + y) * width + box.x;
      const dst = y * box.w;
      for (let x = 0; x < box.w; x++) {
        crop[dst + x] = gray[src + x];
      }
    }

    const originalCrop = new Float32Array(box.w * box.h);
    for (let y = 0; y < box.h; y++)
      originalCrop.set(
        deskewed.gray.subarray((box.y + y) * width + box.x, (box.y + y) * width + box.x + box.w),
        y * box.w
      );
    regions.push({
      id: `staff-${box.staff}`,
      bbox: [box.x, box.y, box.w, box.h],
      staff: box.staff,
      system: box.system,
      route: 'notes',
      reason: 'music',
    });
    // Las máscaras periféricas son propuestas visibles; no se aplican sin evidencia musical.
    const candidates: Box[] = [
      [
        box.x,
        box.y,
        Math.min(box.w, Math.round(box.lineSpacing * 12)),
        Math.max(0, Math.floor(box.padUp - box.lineSpacing * 0.95)),
      ],
      [box.x, box.y, box.w, Math.max(0, Math.floor(box.padUp - box.lineSpacing * 1.8))],
      [
        box.x,
        box.y + Math.ceil(box.padUp + box.lineSpacing * 5.8),
        box.w,
        Math.max(0, box.h - Math.ceil(box.padUp + box.lineSpacing * 5.8)),
      ],
    ];
    for (const bbox of candidates) {
      let ink = false;
      for (let y = bbox[1]; y < bbox[1] + bbox[3] && !ink; y++)
        for (let x = bbox[0]; x < bbox[0] + bbox[2]; x++)
          if (deskewed.gray[y * width + x] < 0.94) {
            ink = true;
            break;
          }
      if (ink) {
        masks.push({ bbox, reason: 'peripheral-ink', applied: false });
        regions.push({
          id: `peripheral-${regions.length}`,
          bbox,
          staff: box.staff,
          system: box.system,
          route: 'review',
          reason: 'peripheral-ink',
        });
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

    const overlap = Math.min(Math.floor(maxWidth / 3), Math.round(targetSpacing * 24));
    if (maxWidth <= 0 || maxWidth <= overlap) throw new Error('Ancho de ventana OMR inválido.');
    const scale = box.w / norm.width;
    const outH = Math.max(1, pyRoundInt((box.h * targetSpacing) / box.lineSpacing));
    const top = pyRoundInt(
      (targetHeight - 4 * targetSpacing) / 2 - (box.padUp * targetSpacing) / box.lineSpacing
    );
    const prefixWidth = Math.min(Math.floor(maxWidth / 8), Math.round(targetSpacing * 16));
    for (let start = 0, index = 0; start < norm.width; index++) {
      const contextPrefix = index ? prefixWidth : 0;
      const end = Math.min(start + maxWidth - contextPrefix, norm.width),
        w = end - start + contextPrefix;
      const data = new Float32Array(norm.height * w);
      for (let y = 0; y < norm.height; y++) {
        for (let x = 0; x < w; x++)
          data[y * w + x] =
            1 - norm.data[y * norm.width + (x < contextPrefix ? x : start + x - contextPrefix)];
      }
      const normalizedToProcessed: Transform = [
        scale,
        0,
        0,
        box.h / outH,
        box.x + (start - contextPrefix) * scale,
        box.y - (top * box.h) / outH,
      ];
      inputs.push({
        box,
        data,
        width: w,
        height: norm.height,
        truncated: false,
        originalCrop,
        window: { index, start, end, fullWidth: norm.width, contextPrefix },
        normalizedToOriginal: composeTransform(processedToOriginal, normalizedToProcessed),
      });
      if (end === norm.width) break;
      start = end - overlap;
    }
  }

  // Toda tinta que no entra en el tensor mantiene una región original para revisión/indicaciones.
  let bandStart = -1,
    left = width,
    right = 0,
    lastInk = -1;
  const flush = () => {
    if (bandStart < 0) return;
    const bbox: Box = [left, bandStart, right - left, lastInk - bandStart + 1];
    const nearest = det.boxes.reduce<StaffCropBox | undefined>(
      (best, b) => (!best || Math.abs(b.y - bandStart) < Math.abs(best.y - bandStart) ? b : best),
      undefined
    );
    regions.push({
      id: `pending-${regions.length}`,
      bbox,
      staff: nearest?.staff,
      system: nearest?.system,
      route: 'review',
      reason: 'outside-note-tensor',
    });
    bandStart = -1;
    left = width;
    right = 0;
  };
  for (let y = 0; y < height; y++) {
    let found = false;
    for (let x = 0; x < width; x++) {
      if (deskewed.gray[y * width + x] >= 0.94) continue;
      const covered = det.boxes.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
      if (!covered) {
        found = true;
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
      }
    }
    if (found) {
      if (bandStart < 0) bandStart = y;
      lastInk = y;
    } else if (bandStart >= 0 && y - lastInk > 2) flush();
  }
  flush();
  const systemGroupingAmbiguities: Box[] = [];
  for (let i = 1; i < det.staves.length; i++) {
    const previous = det.staves[i - 1],
      current = det.staves[i];
    if (
      !det.systems.some((system) => system.includes(i - 1) && system.includes(i)) &&
      current.top - previous.bottom < Math.max(previous.lineSpacing, current.lineSpacing) * 12
    )
      systemGroupingAmbiguities.push([0, previous.top, width, current.bottom - previous.top]);
  }

  return {
    boxes: det.boxes,
    inputs,
    systems: det.systems,
    usedThreshold: det.usedThreshold,
    deskewAngleDeg: angleDeg,
    width,
    height,
    originalToProcessed,
    processedToOriginal,
    orientation: { quarterTurn, halfTurnAmbiguous: opts.rotation === undefined },
    regions,
    systemGroupingAmbiguities,
    masks,
    contrast: { selected, scores },
  };
}
