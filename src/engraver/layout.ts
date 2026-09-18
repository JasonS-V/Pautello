import { Measure } from '../types/music';

export interface SystemInfo {
  systemIndex: number;
  startMeasureIndex: number;
  endMeasureIndex: number; // exclusive
  measureIndices: number[];
  measures: Measure[];
  hasPageBreakAfter: boolean;
}

export interface PageInfo {
  pageIndex: number; // 0-indexed
  pageNumber: number; // 1-indexed
  systems: SystemInfo[];
}

export interface LayoutOptions {
  measuresPerSystem?: number; // default: 3
  pageHeight?: number; // default: 1188 (A4 standard at 840px width)
  firstPageTopMargin?: number; // default: 140 (leaves space for title & metadata)
  pageTopMargin?: number; // default: 70
  pageBottomMargin?: number; // default: 60
  systemGap?: number; // default: 36
}

/**
 * Partitions score measures into systems (lines of staves),
 * respecting measure.systemBreak and measure.pageBreak.
 */
export function computeSystems(measures: Measure[], defaultMeasuresPerSystem = 3): SystemInfo[] {
  if (measures.length === 0) return [];

  const systems: SystemInfo[] = [];
  let currentStart = 0;
  let currentIndices: number[] = [];
  let currentMeasures: Measure[] = [];

  for (let i = 0; i < measures.length; i++) {
    const m = measures[i];
    currentIndices.push(i);
    currentMeasures.push(m);

    const isLast = i === measures.length - 1;
    const isExplicitPageBreak = Boolean(m.pageBreak);
    const isExplicitSystemBreak = Boolean(m.systemBreak);
    const reachedCount = currentIndices.length >= defaultMeasuresPerSystem;

    if (isExplicitPageBreak || isExplicitSystemBreak || reachedCount || isLast) {
      systems.push({
        systemIndex: systems.length,
        startMeasureIndex: currentStart,
        endMeasureIndex: i + 1,
        measureIndices: [...currentIndices],
        measures: [...currentMeasures],
        hasPageBreakAfter: isExplicitPageBreak,
      });

      currentStart = i + 1;
      currentIndices = [];
      currentMeasures = [];
    }
  }

  return systems;
}

/**
 * Organizes systems into printable pages (A4 / Carta) based on vertical height budget.
 */
export function computePages(
  systems: SystemInfo[],
  systemHeight: number,
  options: LayoutOptions = {}
): PageInfo[] {
  if (systems.length === 0) return [];

  const {
    pageHeight = 1188,
    firstPageTopMargin = 140,
    pageTopMargin = 70,
    pageBottomMargin = 60,
    systemGap = 36,
  } = options;

  const pages: PageInfo[] = [];
  let currentPageIndex = 0;
  let currentSystems: SystemInfo[] = [];
  let currentHeight = 0;

  const getAvailableHeight = (pIdx: number) => {
    const top = pIdx === 0 ? firstPageTopMargin : pageTopMargin;
    return pageHeight - top - pageBottomMargin;
  };

  for (let i = 0; i < systems.length; i++) {
    const sys = systems[i];
    const itemHeight = systemHeight + (currentSystems.length > 0 ? systemGap : 0);
    const available = getAvailableHeight(currentPageIndex);

    // If adding this system exceeds available height and we already have at least 1 system on this page
    if (currentSystems.length > 0 && currentHeight + itemHeight > available) {
      pages.push({
        pageIndex: currentPageIndex,
        pageNumber: currentPageIndex + 1,
        systems: [...currentSystems],
      });
      currentPageIndex++;
      currentSystems = [sys];
      currentHeight = systemHeight;
    } else {
      currentSystems.push(sys);
      currentHeight += itemHeight;
    }

    // If this system has an explicit page break after it, finish the page now
    if (sys.hasPageBreakAfter && i < systems.length - 1) {
      pages.push({
        pageIndex: currentPageIndex,
        pageNumber: currentPageIndex + 1,
        systems: [...currentSystems],
      });
      currentPageIndex++;
      currentSystems = [];
      currentHeight = 0;
    }
  }

  if (currentSystems.length > 0) {
    pages.push({
      pageIndex: currentPageIndex,
      pageNumber: currentPageIndex + 1,
      systems: [...currentSystems],
    });
  }

  return pages;
}

/**
 * Computes an optical rhythmic/graphic weight W_m for a measure based on:
 * - Number of figures / items
 * - Density of fast notes (16th, 32nd, 8th notes require more horizontal space for flags/beams)
 * - Accidentals (require extra horizontal width before noteheads)
 * - Lyric syllables (require horizontal width for text)
 * - Chord symbols
 * - Key or time signature modulations at measure start
 */
export function calculateMeasureWeight(measure?: Measure): number {
  if (!measure) return 1.0;
  if (measure.multimeasureRest && measure.multimeasureRest > 1) {
    return 1.2;
  }

  // Base weight
  let weight = 1.0;

  // Measure-level header overhead
  if (measure.timeSignatureChange) weight += 0.6;
  if (measure.keySignatureChange) weight += 0.6;
  if (measure.tempoText || measure.tempoBpm) weight += 0.4;
  if (measure.rehearsalMark) weight += 0.3;

  if (!measure.items || measure.items.length === 0) {
    return weight;
  }

  // If measure contains only a single whole rest / placeholder rest
  if (
    measure.items.length === 1 &&
    measure.items[0].type === 'rest' &&
    measure.items[0].duration === 'w'
  ) {
    return weight;
  }

  measure.items.forEach((item) => {
    // Base per item
    weight += 0.35;

    // Density of fast notes
    switch (item.duration) {
      case '32':
        weight += 0.9;
        break;
      case '16':
        weight += 0.75;
        break;
      case '8':
        weight += 0.4;
        break;
      case 'q':
        weight += 0.15;
        break;
      case 'h':
      case 'w':
        weight += 0.05;
        break;
    }

    // Accidentals on notes
    if (item.type === 'note') {
      if (item.pitch?.accidental) {
        weight += item.pitch.accidental === '##' || item.pitch.accidental === 'bb' ? 0.45 : 0.3;
      }
      if (item.pitches && item.pitches.length > 0) {
        item.pitches.forEach((p) => {
          if (p.accidental) {
            weight += p.accidental === '##' || p.accidental === 'bb' ? 0.3 : 0.2;
          }
        });
      }
    }

    // Lyric text
    if (item.lyric && item.lyric.trim().length > 0) {
      weight += 0.5 + Math.min(1.2, item.lyric.trim().length * 0.1);
    }

    // Chord symbol
    if (item.chord) {
      weight += 0.3;
    }
  });

  return Math.max(1.0, weight);
}

export interface OpticalWidthsResult {
  widths: number[];
  xOffsets: number[];
}

/**
 * Distributes available system width across measures proportionally to their optical weights (W_m / sum W),
 * while enforcing minimum readability margins and ensuring the total width matches totalAvailableWidth exactly.
 *
 * @param measures Measures in this system
 * @param totalAvailableWidth Width to distribute (systemWidth - headerWidth, typically 776 - headerWidth)
 * @param minMeasureWidth Minimum allowed width per measure (default 75px)
 * @param allStavesMeasures Optional measures across all staves for multi-instrument systems (staves x measures)
 */
export function computeOpticalMeasureWidths(
  measures: Measure[],
  totalAvailableWidth: number,
  minMeasureWidth = 75,
  allStavesMeasures?: Measure[][]
): OpticalWidthsResult {
  const count = measures.length;
  if (count === 0) {
    return { widths: [], xOffsets: [] };
  }

  if (count === 1) {
    return {
      widths: [Math.round(totalAvailableWidth)],
      xOffsets: [0],
    };
  }

  // Effective min measure width cannot exceed equal division
  const effectiveMinWidth = Math.min(minMeasureWidth, Math.floor(totalAvailableWidth / count));

  // Compute weight for each measure index in the system
  // For multi-staves systems, the measure column takes the max weight across all staves
  const weights: number[] = [];
  for (let i = 0; i < count; i++) {
    let colWeight = calculateMeasureWeight(measures[i]);
    if (allStavesMeasures && allStavesMeasures.length > 0) {
      for (const staffMeasures of allStavesMeasures) {
        if (staffMeasures[i]) {
          const w = calculateMeasureWeight(staffMeasures[i]);
          if (w > colWeight) colWeight = w;
        }
      }
    }
    weights.push(colWeight);
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Iterative proportional allocation with minimum width clamping
  const allocatedWidths: number[] = new Array(count).fill(0);
  let remainingWidth = totalAvailableWidth;
  let remainingWeight = totalWeight;
  const locked = new Set<number>();

  // Pass 1: check measures that fall below minimum width and clamp them
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < count; i++) {
      if (!locked.has(i)) {
        const proportional = (weights[i] / Math.max(0.001, remainingWeight)) * remainingWidth;
        if (proportional < effectiveMinWidth) {
          locked.add(i);
          allocatedWidths[i] = effectiveMinWidth;
          remainingWidth -= effectiveMinWidth;
          remainingWeight -= weights[i];
          changed = true;
          break; // restart loop with updated remaining budget
        }
      }
    }
  }

  // Pass 2: allocate remaining width to non-locked measures
  for (let i = 0; i < count; i++) {
    if (!locked.has(i)) {
      const share = (weights[i] / Math.max(0.001, remainingWeight)) * remainingWidth;
      allocatedWidths[i] = share;
    }
  }

  // Pass 3: integer rounding while strictly guaranteeing sum(widths) === totalAvailableWidth
  const integerWidths = allocatedWidths.map((w) => Math.round(w));
  const currentSum = integerWidths.reduce((sum, w) => sum + w, 0);
  const diff = Math.round(totalAvailableWidth) - currentSum;

  if (diff !== 0) {
    // Distribute remaining diff by adjusting the largest non-locked measure (or last measure)
    let adjustIdx = count - 1;
    let maxVal = -1;
    for (let i = 0; i < count; i++) {
      if (!locked.has(i) && integerWidths[i] > maxVal) {
        maxVal = integerWidths[i];
        adjustIdx = i;
      }
    }
    integerWidths[adjustIdx] += diff;
  }

  // Calculate cumulative xOffsets (relative to system measure area start)
  const xOffsets: number[] = [];
  let currentX = 0;
  for (let i = 0; i < count; i++) {
    xOffsets.push(currentX);
    currentX += integerWidths[i];
  }

  return {
    widths: integerWidths,
    xOffsets,
  };
}
