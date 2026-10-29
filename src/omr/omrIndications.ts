import type { Box } from './omrGeometry';
import { deriveQuarterBpm, type BeatUnit, type PageTextLine } from './omrPageText';
import type { OmrSourceSpan } from './omrDecode';

export interface OmrIndication {
  id: string;
  kind:
    'style' | 'tempo' | 'meter' | 'equivalence' | 'navigation' | 'rehearsal' | 'fermata' | 'symbol';
  status: 'recognized' | 'pending';
  confidence: number;
  text?: string;
  src: OmrSourceSpan;
  anchor?: {
    system: number;
    measureNumber: number | null;
    x: number;
    at?: 'start' | 'interior' | 'end';
  };
  tempo?: { beatUnit: BeatUnit | null; dots: number; perMinute: number; quarterBpm: number | null };
  meter?: { beats: number; beatType: number; glyph: 'fraction' | 'common' };
  equivalence?: {
    previousUnit: BeatUnit | null;
    previousDots: number;
    nextUnit: BeatUnit | null;
    nextDots: number;
    derivedQuarterBpm: number | null;
  };
  navigation?: 'segno' | 'coda' | 'dalSegnoAlCoda' | 'daCapo' | 'fine' | 'toCoda';
  targetId?: string;
  codaExitId?: string;
  target?: { kind: 'rest' | 'note' | 'unknown'; bbox: Box };
}

export interface PageVisual {
  page: number;
  gray: Float32Array;
  width: number;
  height: number;
  staffBoxes: Array<{
    bbox: Box;
    system: number;
    staff: number;
    staffTop?: number;
    lineSpacing?: number;
  }>;
}

export function findBarlines(
  gray: Float32Array,
  width: number,
  height: number,
  staff: PageVisual['staffBoxes'][number]
): number[] {
  if (staff.staffTop === undefined || staff.lineSpacing === undefined) return [];
  const spacing = staff.lineSpacing;
  const top = Math.max(0, Math.round(staff.staffTop));
  const bottom = Math.min(height - 1, Math.round(staff.staffTop + 4 * staff.lineSpacing));
  const found: number[] = [];
  const relaxed: number[] = [];
  const relaxedClean: number[] = [];
  let runStart = -1;
  const lastX = Math.min(width - 1, Math.ceil(staff.bbox[0] + staff.bbox[2]));
  const verticalRatio = (x: number) => {
    let ink = 0;
    if (x < 0 || x >= width) return 0;
    for (let y = top; y <= bottom; y++) if (gray[y * width + x] < 0.85) ink++;
    return ink / (bottom - top + 1);
  };
  for (let x = Math.max(0, Math.floor(staff.bbox[0])); x <= lastX + 1; x++) {
    if (x <= lastX && verticalRatio(x) >= 0.92) {
      if (runStart < 0) runStart = x;
    } else if (runStart >= 0) {
      const center = Math.round((runStart + x - 1) / 2);
      const strokeWidth = x - runStart;
      let lateralInk = 0,
        lateralTotal = 0;
      for (let y = top + 2; y <= bottom - 2; y++) {
        if (
          Math.abs((y - top) / staff.lineSpacing - Math.round((y - top) / staff.lineSpacing)) < 0.18
        )
          continue;
        for (const side of [-1, 1]) {
          const col = center + Math.round((staff.lineSpacing / 2) * side);
          if (col >= 0 && col < width) {
            lateralTotal++;
            if (gray[y * width + col] < 0.65) lateralInk++;
          }
        }
      }
      const adjacentBar = [4, 5, 6].some(
        (distance) =>
          verticalRatio(center - distance) >= 0.92 || verticalRatio(center + distance) >= 0.92
      );
      const lateralRatio = lateralInk / Math.max(1, lateralTotal);
      if (
        (lateralRatio < 0.05 || adjacentBar) &&
        (!found.length || center - found[found.length - 1] > staff.lineSpacing * 1.5)
      )
        found.push(center);
      if (
        strokeWidth >= 3 &&
        lateralRatio < 0.13 &&
        (!relaxed.length || center - relaxed[relaxed.length - 1] > staff.lineSpacing * 1.5)
      )
        relaxed.push(center);
      if (
        strokeWidth >= 3 &&
        lateralRatio < 0.1 &&
        (!relaxedClean.length ||
          center - relaxedClean[relaxedClean.length - 1] > staff.lineSpacing * 1.5)
      )
        relaxedClean.push(center);
      runStart = -1;
    }
  }
  if (!found.length) return relaxed;
  if (found[0] - staff.bbox[0] > staff.lineSpacing * 20) {
    const early = relaxedClean.filter((x) => x < found[0] - spacing * 2);
    const spaced: number[] = [];
    for (const x of early)
      if (!spaced.length || x - spaced[spaced.length - 1] >= spacing * 8) spaced.push(x);
    return [...spaced, ...found];
  }
  return found;
}

interface InkComponent {
  bbox: Box;
  pixels: Array<[number, number]>;
}

function componentsAboveStaff(
  page: PageVisual,
  staff: PageVisual['staffBoxes'][number]
): InkComponent[] {
  if (staff.staffTop === undefined || staff.lineSpacing === undefined) return [];
  const left = Math.max(0, Math.floor(staff.bbox[0]));
  const right = Math.min(page.width, Math.ceil(staff.bbox[0] + staff.bbox[2]));
  const top = Math.max(0, Math.floor(staff.staffTop - 5.5 * staff.lineSpacing));
  const bottom = Math.min(page.height, Math.floor(staff.staffTop - 0.15 * staff.lineSpacing));
  const bandWidth = right - left,
    bandHeight = bottom - top;
  if (bandWidth <= 0 || bandHeight <= 0) return [];
  const seen = new Uint8Array(bandWidth * bandHeight);
  const result: InkComponent[] = [];
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      const start = (y - top) * bandWidth + x - left;
      if (seen[start] || page.gray[y * page.width + x] >= 0.63) continue;
      const queue: Array<[number, number]> = [[x, y]];
      const pixels: Array<[number, number]> = [];
      seen[start] = 1;
      let minX = x,
        maxX = x,
        minY = y,
        maxY = y;
      for (let index = 0; index < queue.length; index++) {
        const [cx, cy] = queue[index];
        pixels.push([cx, cy]);
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx,
              ny = cy + dy;
            if (nx < left || nx >= right || ny < top || ny >= bottom) continue;
            const key = (ny - top) * bandWidth + nx - left;
            if (seen[key] || page.gray[ny * page.width + nx] >= 0.63) continue;
            seen[key] = 1;
            queue.push([nx, ny]);
          }
      }
      if (pixels.length >= 4)
        result.push({ bbox: [minX, minY, maxX - minX + 1, maxY - minY + 1], pixels });
    }
  return result;
}

function visualMarks(
  page: PageVisual,
  staff: PageVisual['staffBoxes'][number]
): Array<{
  kind: OmrIndication['kind'];
  navigation?: OmrIndication['navigation'];
  bbox: Box;
  status: OmrIndication['status'];
  text?: string;
  target?: OmrIndication['target'];
}> {
  const spacing = staff.lineSpacing ?? 0;
  if (!spacing || staff.staffTop === undefined) return [];
  const components = componentsAboveStaff(page, staff);
  const marks: ReturnType<typeof visualMarks> = [];
  for (const component of components) {
    const [x, y, w, h] = component.bbox;
    const aspect = w / h;
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const inkAt = (px: number, py: number) =>
      page.gray[Math.round(py) * page.width + Math.round(px)] < 0.63;
    const horizontal =
      Array.from({ length: w }, (_, i) => inkAt(x + i, centerY)).filter(Boolean).length / w;
    const vertical = Math.max(
      ...[-2, -1, 0, 1, 2].map(
        (offset) =>
          Array.from({ length: h }, (_, i) => inkAt(centerX + offset, y + i)).filter(Boolean)
            .length / h
      )
    );
    if (w >= 1.7 * spacing && w <= 3.2 * spacing && h >= 1.8 * spacing && h <= 3.4 * spacing) {
      if (horizontal > 0.8 && vertical > 0.35 && aspect > 0.75)
        marks.push({
          kind: 'navigation',
          navigation: 'coda',
          bbox: component.bbox,
          status: 'recognized',
        });
      else if (w <= 2.8 * spacing && aspect < 0.9 && component.pixels.length / (w * h) > 0.28)
        marks.push({
          kind: 'navigation',
          navigation: 'segno',
          bbox: component.bbox,
          status: 'recognized',
        });
    } else if (
      w >= 2.1 * spacing &&
      w <= 3.5 * spacing &&
      h >= 0.7 * spacing &&
      h <= 1.7 * spacing &&
      aspect > 1.7
    ) {
      const dot = components.find((other) => {
        const [dx, dy, dw, dh] = other.bbox;
        return (
          other !== component &&
          dw <= spacing * 0.7 &&
          dh <= spacing * 0.7 &&
          dx + dw / 2 > centerX - spacing * 0.35 &&
          dx + dw / 2 < centerX + spacing * 0.35 &&
          dy >= y + h &&
          dy < y + h + spacing * 0.9
        );
      });
      if (dot) {
        const middle = Math.round(staff.staffTop + 2 * spacing);
        const rest = [middle - 5, middle - 4, middle - 3, middle - 2].some((row) => {
          let ink = 0;
          for (let col = Math.round(centerX - spacing * 0.9); col <= centerX + spacing * 0.9; col++)
            if (page.gray[row * page.width + col] < 0.63) ink++;
          return ink >= spacing * 0.55;
        });
        marks.push({
          kind: 'fermata',
          bbox: [x, y, w, dot.bbox[1] + dot.bbox[3] - y],
          status: 'recognized',
          target: {
            kind: rest ? 'rest' : 'unknown',
            bbox: [centerX - spacing, middle - spacing, 2 * spacing, 2 * spacing],
          },
        });
      } else if (y + h < staff.staffTop - spacing * 0.4)
        marks.push({
          kind: 'symbol',
          bbox: component.bbox,
          status: 'pending',
          text: 'Arco: ligadura, prolongación o adorno sin clasificar',
        });
    }
  }
  return marks;
}

function isDoubleBar(
  page: PageVisual,
  staff: PageVisual['staffBoxes'][number],
  x: number
): boolean {
  if (staff.staffTop === undefined || staff.lineSpacing === undefined) return false;
  const top = Math.round(staff.staffTop),
    bottom = Math.round(top + staff.lineSpacing * 4);
  return [4, 5, 6].some((distance) => {
    let ink = 0;
    for (let y = top; y <= bottom; y++) if (page.gray[y * page.width + x + distance] < 0.85) ink++;
    return ink / (bottom - top + 1) > 0.91;
  });
}

function visualMeter(
  page: PageVisual,
  staff: PageVisual['staffBoxes'][number],
  barX: number
): { bbox: Box; meter: NonNullable<OmrIndication['meter']> } | null {
  if (staff.staffTop === undefined || staff.lineSpacing === undefined) return null;
  const spacing = staff.lineSpacing,
    top = Math.round(staff.staffTop);
  const yRows = Array.from({ length: Math.round(spacing * 3.6) }, (_, i) => top + 2 + i).filter(
    (y) => Math.abs((y - top) / spacing - Math.round((y - top) / spacing)) >= 0.17
  );
  for (let shift = Math.round(spacing * 0.5); shift <= Math.round(spacing * 2); shift += 2) {
    const x = barX + shift;
    if (x < 0 || x + 2 * spacing >= page.width) continue;
    const density = (low: number, high: number) => {
      let dark = 0,
        total = 0;
      for (const y of yRows) {
        if (y - top < low || y - top >= high) continue;
        for (let col = x; col < x + 2 * spacing; col++) {
          total++;
          if (page.gray[y * page.width + Math.round(col)] < 0.65) dark++;
        }
      }
      return dark / Math.max(1, total);
    };
    const upper = density(2, 1.5 * spacing),
      middle = density(1.5 * spacing, 2.7 * spacing);
    const lower = density(2.7 * spacing, 3.8 * spacing);
    if (upper > 0.43 && lower > 0.3 && middle > 0.25)
      return {
        bbox: [x, top, 2 * spacing, 4 * spacing],
        meter: { beats: 3, beatType: 4, glyph: 'fraction' },
      };
    if (upper > 0.28 && middle > 0.35 && lower < 0.12)
      return {
        bbox: [x, top, 2 * spacing, 4 * spacing],
        meter: { beats: 4, beatType: 4, glyph: 'common' },
      };
  }
  return null;
}

function visualEquivalences(
  page: PageVisual,
  staff: PageVisual['staffBoxes'][number]
): Array<{
  bbox: Box;
  previousUnit: BeatUnit | null;
  previousDots: number;
  nextUnit: BeatUnit | null;
  nextDots: number;
}> {
  if (staff.staffTop === undefined || staff.lineSpacing === undefined) return [];
  const spacing = staff.lineSpacing,
    gray = page.gray,
    width = page.width;
  const left = Math.max(0, Math.floor(staff.bbox[0]));
  const right = Math.min(width - 1, Math.ceil(staff.bbox[0] + staff.bbox[2]));
  const top = Math.max(0, Math.round(staff.staffTop - spacing * 4));
  const bottom = Math.max(0, Math.round(staff.staffTop - spacing * 1.5));
  const dark = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < page.height && gray[y * width + x] < 0.85;
  const result: ReturnType<typeof visualEquivalences> = [];
  for (let y = top; y < bottom; y++)
    for (let x = Math.round(left + 3 * spacing); x < right - 3 * spacing; x++) {
      if (!dark(x, y) || dark(x - 1, y)) continue;
      let run = 0;
      while (run < spacing * 1.3 && dark(x + run, y)) run++;
      if (run < spacing * 0.65 || run > spacing * 1.2) continue;
      const gap = [3, 4, 5, 6, 7].find((distance) => {
        let lower = 0;
        for (let dx = 0; dx < run; dx++) if (dark(x + dx, y + distance)) lower++;
        return lower >= run * 0.75;
      });
      if (!gap) continue;
      const headY = y + gap + 2;
      const readHead = (side: -1 | 1): { unit: BeatUnit; dots: number } | null => {
        const centerX = Math.round(x + run / 2 + side * spacing * 2);
        let bestX = centerX,
          best = 0;
        for (let cx = centerX - 4; cx <= centerX + 4; cx++) {
          const ratio = darkRatio(gray, width, page.height, cx, headY, Math.round(spacing * 0.38));
          if (ratio > best) {
            best = ratio;
            bestX = cx;
          }
        }
        if (best < 0.48) return null;
        let stem = 0,
          flag = 0;
        for (let row = headY - Math.round(spacing * 3); row < headY - spacing * 0.7; row++) {
          if ([3, 4, 5, 6].some((dx) => dark(bestX + dx, row))) stem++;
          if (row < headY - spacing * 1.2)
            for (let col = bestX + 7; col <= bestX + spacing * 1.8; col++)
              if (dark(Math.round(col), row)) flag++;
        }
        if (stem < spacing * 1.4) return null;
        let dots = 0;
        for (
          let col = bestX + Math.round(spacing * 0.8);
          col <= bestX + Math.round(spacing * 1.6);
          col++
        ) {
          const dot = [headY - 1, headY, headY + 1].filter((row) => dark(col, row)).length;
          if (dot >= 2 && !dark(col, headY - 5) && !dark(col, headY + 5)) {
            dots = 1;
            break;
          }
        }
        return { unit: flag > spacing * 2 ? '8' : 'q', dots };
      };
      const previous = readHead(-1),
        next = readHead(1);
      if (!previous && !next) continue;
      const bbox: Box = [x - 3 * spacing, y - 3 * spacing, 6 * spacing, 4 * spacing];
      if (!result.some((entry) => Math.abs(entry.bbox[0] - bbox[0]) < spacing))
        result.push({
          bbox,
          previousUnit: previous?.unit ?? null,
          previousDots: previous?.dots ?? 0,
          nextUnit: next?.unit ?? null,
          nextDots: next?.dots ?? 0,
        });
    }
  return result;
}

function nearestSource(page: PageVisual, bbox: Box): OmrSourceSpan {
  const centerY = bbox[1] + bbox[3] / 2;
  const nearest = [...page.staffBoxes].sort(
    (a, b) => Math.abs(a.bbox[1] - centerY) - Math.abs(b.bbox[1] - centerY)
  )[0];
  return {
    page: page.page,
    system: nearest?.system ?? 0,
    staff: nearest?.staff ?? 0,
    bbox,
  };
}

function darkRatio(
  gray: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
): number {
  let dark = 0,
    total = 0;
  for (let row = Math.max(0, y - radius); row <= Math.min(height - 1, y + radius); row++)
    for (let col = Math.max(0, x - radius); col <= Math.min(width - 1, x + radius); col++) {
      total++;
      if (gray[row * width + col] < 0.55) dark++;
    }
  return total ? dark / total : 0;
}

function findEqualsNearNumber(
  gray: Float32Array,
  width: number,
  height: number,
  numberBox: Box
): Box | null {
  const [numberX, numberY, , numberHeight] = numberBox;
  for (let y = Math.max(0, numberY - 4); y < Math.min(height - 6, numberY + numberHeight); y++)
    for (
      let x = Math.max(0, Math.floor(numberX - Math.max(16, numberHeight * 1.2)));
      x < numberX - 5;
      x++
    ) {
      let run = 0;
      while (run < 14 && x + run < numberX - 3 && gray[y * width + x + run] < 0.7) run++;
      if (run < 5) continue;
      for (let gap = 3; gap <= 6; gap++) {
        let lower = 0;
        for (let dx = 0; dx < run; dx++) if (gray[(y + gap) * width + x + dx] < 0.7) lower++;
        if (lower >= run * 0.7) return [x, y, run, gap + 1];
      }
    }
  return null;
}

export function detectTempo(
  line: PageTextLine,
  gray: Float32Array,
  width: number,
  height: number
): OmrIndication['tempo'] | null {
  const match =
    /=\s*(\d{2,3})\b/.exec(line.text) ??
    (/(?:ranchera|tempo|bpm|allegro|andante)/i.test(line.text)
      ? /\b(\d{2,3})\s*$/.exec(line.text)
      : null);
  if (!match) return null;
  const perMinute = Number(match[1]);
  if (perMinute < 20 || perMinute > 400) return null;
  const number = [...line.words].reverse().find((word) => word.text === match[1]);
  const equals =
    line.words.find((word) => word.text === '=')?.bbox ??
    (number ? findEqualsNearNumber(gray, width, height, number.bbox) : null);
  let beatUnit: BeatUnit | null = null;
  let dots = 0;
  if (equals && number) {
    const textHeight = number.bbox[3];
    const x = Math.round(equals[0] - textHeight * 0.9);
    const y = Math.round(equals[1] + textHeight * 0.35);
    const ring = darkRatio(gray, width, height, x, y, Math.max(5, Math.round(textHeight * 0.48)));
    const center = darkRatio(gray, width, height, x, y, Math.max(2, Math.round(textHeight * 0.15)));
    let stem = 0;
    for (let row = Math.max(0, y - textHeight * 2); row < y - textHeight * 0.5; row++)
      if (
        [0.3, 0.35, 0.4, 0.45, 0.5].some(
          (offset) =>
            gray[
              Math.round(row) * width + Math.min(width - 1, x + Math.round(textHeight * offset))
            ] < 0.8
        )
      )
        stem++;
    if (ring > 0.18 && stem >= textHeight * 0.45) {
      beatUnit = center > 0.65 ? 'q' : center < 0.38 ? 'h' : null;
      if (beatUnit) {
        if (beatUnit === 'q') {
          let flagInk = 0;
          for (let row = Math.max(0, y - textHeight * 2); row < Math.max(0, y - textHeight); row++)
            for (
              let col = x + Math.round(textHeight * 0.55);
              col < Math.min(width, x + textHeight);
              col++
            )
              if (gray[Math.round(row) * width + col] < 0.65) flagInk++;
          if (flagInk >= textHeight * 0.5) beatUnit = '8';
        }
        let inDot = false,
          dotPixels = 0;
        for (let col = x + Math.round(textHeight * 0.45); col < equals[0] - 2; col++) {
          let pixels = 0;
          for (let row = y - 2; row <= y + 2; row++)
            if (
              row >= 0 &&
              row < height &&
              col >= 0 &&
              col < width &&
              gray[row * width + col] < 0.55
            )
              pixels++;
          if (pixels >= 2) {
            dotPixels += pixels;
            if (!inDot) dots++;
            inDot = true;
          } else inDot = false;
        }
        if (dotPixels < 4 || dotPixels > textHeight * 1.5) dots = 0;
        dots = Math.min(2, dots);
      }
    }
  }
  if (!beatUnit && line.source === 'pdf') {
    const glyph = line.text.slice(0, match.index).trim().slice(-2);
    if (/[𝅗𝅥]/u.test(glyph)) beatUnit = 'h';
    else if (/[♩𝅘𝅥]/u.test(glyph)) beatUnit = 'q';
    else if (/[♪𝅘𝅥𝅮]/u.test(glyph)) beatUnit = '8';
    dots = /\.$/.test(glyph) ? 1 : 0;
  }
  return { beatUnit, dots, perMinute, quarterBpm: deriveQuarterBpm(beatUnit, dots, perMinute) };
}

export function readTextIndications(lines: PageTextLine[], pages: PageVisual[]): OmrIndication[] {
  const indications: OmrIndication[] = [];
  const anchors = new Map<string, { start: number | null; bars: number[] }>();
  const measureAt = (
    anchor: { start: number | null; bars: number[] } | undefined,
    x: number,
    spacing: number
  ) => {
    if (anchor?.start === null || anchor?.start === undefined) return null;
    const before = anchor.bars.filter((bar) => bar < x).length;
    const previous = anchor.bars[before - 1],
      next = anchor.bars[before];
    if (
      previous !== undefined &&
      next !== undefined &&
      next - previous > spacing * 20 &&
      x - previous > spacing * 8
    )
      return null;
    return anchor.start + before;
  };
  let expectedStart: number | null = 1;
  for (const page of pages)
    for (const staff of page.staffBoxes) {
      const printed = lines.find(
        (line) =>
          line.page === page.page &&
          /^\d{1,3}$/.test(line.text) &&
          line.bbox[0] < staff.bbox[0] + (staff.lineSpacing ?? 10) * 4 &&
          line.bbox[1] < (staff.staffTop ?? staff.bbox[1]) &&
          nearestSource(page, line.bbox).system === staff.system
      );
      const printedStart =
        printed &&
        printed.bbox[3] < Math.max(30, (staff.lineSpacing ?? 10) * 2.5) &&
        printed.bbox[2] < Math.max(45, (staff.lineSpacing ?? 10) * 4)
          ? Number(printed.text)
          : null;
      const start: number | null = printedStart ?? expectedStart;
      const bars = findBarlines(page.gray, page.width, page.height, staff);
      anchors.set(`${page.page}/${staff.system}/${staff.staff}`, { start, bars });
      if (staff.staff === 0)
        expectedStart = start === null || !bars.length ? null : start + bars.length;
    }
  for (const line of lines) {
    const page = pages.find((entry) => entry.page === line.page);
    if (!page) continue;
    const src = nearestSource(page, line.bbox);
    const add = (indication: Omit<OmrIndication, 'id' | 'src' | 'confidence'>) => {
      const sourceAnchor = anchors.get(`${page.page}/${src.system}/${src.staff}`);
      const x = line.boxed ? line.bbox[0] + line.bbox[2] / 2 : line.bbox[0];
      const before = sourceAnchor?.bars.filter((bar) => bar < x).length ?? 0;
      const previousBar = sourceAnchor?.bars[before - 1];
      const nextBar = sourceAnchor?.bars[before];
      const spacing =
        page.staffBoxes.find((staff) => staff.system === src.system)?.lineSpacing ?? 10;
      const measureNumber = measureAt(sourceAnchor, x, spacing);
      indications.push({
        id: `${line.id}-${indication.kind}`,
        src,
        confidence: line.confidence / 100,
        anchor: {
          system: src.system,
          measureNumber,
          x,
          at:
            indication.kind === 'style' || indication.kind === 'tempo'
              ? 'start'
              : indication.kind === 'navigation' && /D\.?\s*[SC]\.?/i.test(indication.text ?? '')
                ? 'end'
                : previousBar !== undefined && x - previousBar < spacing * 1.5
                  ? 'start'
                  : nextBar !== undefined && nextBar - x < spacing * 1.5
                    ? 'end'
                    : 'interior',
        },
        ...indication,
        status: measureNumber === null ? 'pending' : indication.status,
      });
    };
    const style = /\b(Ranchera\s+(?:Valseada|Lenta)|Vals|Waltz|Allegro|Andante)\b/i.exec(line.text);
    if (style) add({ kind: 'style', status: 'recognized', text: style[1] });
    const tempo = detectTempo(line, page.gray, page.width, page.height);
    if (tempo)
      add({
        kind: 'tempo',
        status: tempo.beatUnit ? 'recognized' : 'pending',
        text: line.text,
        tempo,
      });
    if (/\bD\.?\s*S\.?\s*al\s*Coda\b/i.test(line.text))
      add({
        kind: 'navigation',
        status: 'recognized',
        text: line.text,
        navigation: 'dalSegnoAlCoda',
      });
    else if (/\bD\.?\s*C\.?\b/i.test(line.text))
      add({ kind: 'navigation', status: 'recognized', text: line.text, navigation: 'daCapo' });
    else if (/\b(?:to|a|al)\s+coda\b/i.test(line.text))
      add({ kind: 'navigation', status: 'recognized', text: line.text, navigation: 'toCoda' });
    else if (/\bFine\b/i.test(line.text))
      add({ kind: 'navigation', status: 'recognized', text: line.text, navigation: 'fine' });
    if (line.boxed && /^[A-Z]$/.test(line.text))
      add({ kind: 'rehearsal', status: 'recognized', text: line.text });
    const meter = /^\s*(\d{1,2})\s*\/\s*(2|4|8|16)\s*$/.exec(line.text);
    if (meter)
      add({
        kind: 'meter',
        status: 'recognized',
        text: line.text,
        meter: { beats: Number(meter[1]), beatType: Number(meter[2]), glyph: 'fraction' },
      });
  }
  for (const page of pages)
    for (const staff of page.staffBoxes) {
      const sourceAnchor = anchors.get(`${page.page}/${staff.system}/${staff.staff}`);
      const marks: Array<{
        kind: OmrIndication['kind'];
        navigation?: OmrIndication['navigation'];
        bbox: Box;
        status: OmrIndication['status'];
        text?: string;
        target?: OmrIndication['target'];
        meter?: OmrIndication['meter'];
        equivalence?: OmrIndication['equivalence'];
      }> = visualMarks(page, staff);
      const meterBars = sourceAnchor?.bars.filter((bar) => isDoubleBar(page, staff, bar)) ?? [];
      if (page.page === pages[0].page && staff.system === 0 && staff.staff === 0)
        meterBars.unshift(Math.round(staff.bbox[0] + (staff.lineSpacing ?? 10) * 3));
      for (const bar of meterBars) {
        const detected = visualMeter(page, staff, bar);
        if (detected) marks.push({ kind: 'meter', status: 'recognized', ...detected });
      }
      for (const detected of visualEquivalences(page, staff).filter(
        (entry) =>
          !lines.some(
            (line) =>
              line.page === page.page &&
              /\b\d{2,3}\b/.test(line.text) &&
              line.bbox[0] < entry.bbox[0] + entry.bbox[2] &&
              entry.bbox[0] < line.bbox[0] + line.bbox[2] &&
              line.bbox[1] < entry.bbox[1] + entry.bbox[3] &&
              entry.bbox[1] < line.bbox[1] + line.bbox[3]
          )
      ))
        marks.push({
          kind: 'equivalence',
          status: detected.previousUnit && detected.nextUnit ? 'recognized' : 'pending',
          bbox: detected.bbox,
          equivalence: {
            previousUnit: detected.previousUnit,
            previousDots: detected.previousDots,
            nextUnit: detected.nextUnit,
            nextDots: detected.nextDots,
            derivedQuarterBpm: null,
          },
        });
      for (const [index, mark] of marks.entries()) {
        const x = mark.bbox[0] + mark.bbox[2] / 2;
        const before = sourceAnchor?.bars.filter((bar) => bar < x).length ?? 0;
        const previousBar = sourceAnchor?.bars[before - 1];
        const nextBar = sourceAnchor?.bars[before];
        const spacing = staff.lineSpacing ?? 10;
        const measureNumber = measureAt(sourceAnchor, x, spacing);
        indications.push({
          id: `visual-${page.page}-${staff.system}-${staff.staff}-${index}`,
          kind: mark.kind,
          status: measureNumber === null ? 'pending' : mark.status,
          confidence: mark.kind === 'symbol' ? 0.5 : 0.78,
          text: mark.text,
          navigation: mark.navigation,
          target: mark.target,
          meter: mark.meter,
          equivalence: mark.equivalence,
          src: { page: page.page, system: staff.system, staff: staff.staff, bbox: mark.bbox },
          anchor: {
            system: staff.system,
            measureNumber,
            x,
            at:
              mark.kind === 'meter' || mark.kind === 'equivalence'
                ? 'start'
                : previousBar !== undefined && x - previousBar < spacing * 1.5
                  ? 'start'
                  : nextBar !== undefined && nextBar - x < spacing * 1.8
                    ? 'end'
                    : 'interior',
          },
        });
      }
    }
  for (const item of indications.filter(
    (entry) => entry.kind === 'equivalence' && entry.equivalence
  )) {
    const prior = indications
      .filter(
        (entry) =>
          entry.kind === 'tempo' &&
          entry.status === 'recognized' &&
          entry.tempo?.quarterBpm &&
          entry.anchor?.measureNumber !== null &&
          item.anchor?.measureNumber !== null &&
          (entry.anchor?.measureNumber ?? Infinity) <= (item.anchor?.measureNumber ?? -Infinity)
      )
      .sort((a, b) => (b.anchor?.measureNumber ?? 0) - (a.anchor?.measureNumber ?? 0))[0];
    const previous = item.equivalence!.previousUnit,
      next = item.equivalence!.nextUnit;
    if (prior?.tempo?.quarterBpm && previous && next)
      item.equivalence!.derivedQuarterBpm = deriveEquivalenceQuarterBpm(
        prior.tempo.quarterBpm,
        previous,
        item.equivalence!.previousDots,
        next,
        item.equivalence!.nextDots
      );
    else item.status = 'pending';
  }
  const codaSymbols = indications
    .filter((item) => item.navigation === 'coda')
    .sort(
      (a, b) =>
        a.src.page - b.src.page || a.src.system - b.src.system || a.src.bbox[0] - b.src.bbox[0]
    );
  const ds = indications.filter((item) => item.navigation === 'dalSegnoAlCoda');
  const segnos = indications.filter((item) => item.navigation === 'segno');
  if (codaSymbols.length === 2 && ds.length === 1 && segnos.length === 1) {
    codaSymbols[0].navigation = 'toCoda';
    ds[0].targetId = segnos[0].id;
    ds[0].codaExitId = codaSymbols[0].id;
    codaSymbols[0].targetId = codaSymbols[1].id;
    codaSymbols[0].anchor = { ...codaSymbols[0].anchor!, at: 'end' };
    codaSymbols[1].anchor = { ...codaSymbols[1].anchor!, at: 'start' };
  } else for (const item of [...codaSymbols, ...ds]) item.status = 'pending';
  return indications;
}

export function deriveEquivalenceQuarterBpm(
  priorQuarterBpm: number,
  previousUnit: BeatUnit | null,
  previousDots: number,
  nextUnit: BeatUnit | null,
  nextDots: number
): number | null {
  if (!previousUnit || !nextUnit || priorQuarterBpm <= 0) return null;
  const fractions: Record<BeatUnit, number> = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25 };
  const dotted = (dots: number) => (dots === 2 ? 1.75 : dots === 1 ? 1.5 : 1);
  return Math.round(
    (priorQuarterBpm * fractions[nextUnit] * dotted(nextDots)) /
      (fractions[previousUnit] * dotted(previousDots))
  );
}
