import type { OmrDecodedLine, OmrElementIR, OmrStaffMeta } from './omrDecode';
import { mapBox } from './omrGeometry';

export interface NotationEvidence {
  window?: OmrStaffMeta['window'];
  normalizedToOriginal?: OmrStaffMeta['normalizedToOriginal'];
  bars: { x: number; width: number; reach: number }[];
  disagreements: { kind: 'missing-bar' | 'unsupported-bar'; x: number }[];
  alternatives: {
    element: number;
    status: 'supported' | 'unresolved';
    head: 'hollow' | 'filled' | 'unknown';
    stem: boolean;
    beam: boolean;
    bases: string[];
    dots?: number;
    cost: number;
    evidence: string;
  }[];
}

/** Reads normalized ink (0 white / 1 black). Evidence never overwrites recognized music. */
export function inspectNotation(
  ink: Float32Array,
  width: number,
  height: number,
  spacing: number,
  elements: OmrElementIR[],
  clef: 'G2' | 'F4' | null = 'G2'
): NotationEvidence {
  if (ink.length !== width * height || width < 1 || height < 1 || spacing <= 0)
    throw new Error('Imagen geométrica inválida.');
  const top = (height - 4 * spacing) / 2,
    bottom = top + 4 * spacing;
  const pixel = (x: number, y: number) => {
    x = Math.round(x);
    y = Math.round(y);
    return x < 0 || y < 0 || x >= width || y >= height ? 0 : ink[y * width + x];
  };
  const result: NotationEvidence = { bars: [], disagreements: [], alternatives: [] };
  let start = -1,
    reach = 0;
  for (let x = 0; x <= width; x++) {
    let count = 0;
    if (x < width)
      for (let y = Math.ceil(top); y <= Math.floor(bottom); y++) count += pixel(x, y) > 0.5 ? 1 : 0;
    const ratio = count / (Math.floor(bottom) - Math.ceil(top) + 1);
    if (ratio >= 0.95) {
      if (start < 0) start = x;
      reach = Math.max(reach, ratio);
    } else if (start >= 0) {
      const w = x - start,
        center = (start + x - 1) / 2;
      let lateral = 0,
        n = 0;
      for (let y = top + 2; y < bottom - 1; y++) {
        if (Math.abs((y - top) / spacing - Math.round((y - top) / spacing)) < 0.17) continue;
        lateral += pixel(start - spacing * 0.5, y) + pixel(x + spacing * 0.5, y);
        n += 2;
      }
      if (w <= spacing * 0.4 && lateral / Math.max(1, n) < 0.16)
        result.bars.push({ x: center, width: w, reach });
      start = -1;
      reach = 0;
    }
  }
  const range = (e: OmrElementIR) => e.src?.normalizedRange;
  const ctcBars = elements.filter((e) => e.kind === 'barline' && range(e));
  for (const bar of result.bars)
    if (!ctcBars.some((e) => Math.abs((range(e)![0] + range(e)![1]) / 2 - bar.x) < spacing * 2))
      result.disagreements.push({ kind: 'missing-bar', x: bar.x });
  for (const bar of ctcBars) {
    const x = (range(bar)![0] + range(bar)![1]) / 2;
    if (!result.bars.some((b) => Math.abs(b.x - x) < spacing * 2))
      result.disagreements.push({ kind: 'unsupported-bar', x });
  }
  elements.forEach((e, element) => {
    if ((e.kind !== 'note' && e.kind !== 'rest') || !range(e)) return;
    const [left, right] = range(e)!;
    let head: 'hollow' | 'filled' | 'unknown' = 'unknown',
      headX = 0,
      headY = 0,
      best = 0;
    if (e.kind === 'note' && e.pitch && clef) {
      const diatonic = e.pitch.octave * 7 + 'CDEFGAB'.indexOf(e.pitch.step);
      const base = clef === 'F4' ? 2 * 7 + 4 : 4 * 7 + 2;
      const y = bottom - ((diatonic - base) * spacing) / 2;
      for (let x = Math.max(0, left - spacing); x <= Math.min(width - 1, right + spacing); x++) {
        let ring = 0;
        for (let a = 0; a < 12; a++)
          ring += pixel(
            x + Math.cos((a * Math.PI) / 6) * spacing * 0.48,
            y + Math.sin((a * Math.PI) / 6) * spacing * 0.27
          );
        ring /= 12;
        const core = (pixel(x, y - spacing * 0.13) + pixel(x, y + spacing * 0.13)) / 2;
        if (ring > 0.7 && ring > best) {
          best = ring;
          head = core < 0.3 ? 'hollow' : core > 0.7 ? 'filled' : 'unknown';
          headX = x;
          headY = y;
        }
      }
    }
    // Require a compact detached blob beside a recognized head, away from a staff line.
    let dot = false,
      stem = false,
      beam = false;
    if (head !== 'unknown')
      for (const direction of [-1, 1]) {
        for (let x = headX - spacing * 0.7; x <= headX + spacing * 0.7; x++) {
          let count = 0;
          for (let d = spacing * 0.4; d <= spacing * 2.7; d++)
            if (pixel(x, headY + direction * d) > 0.5) count++;
          if (count < spacing * 1.9) continue;
          stem = true;
          for (let d = spacing * 2; d < spacing * 3.5; d++) {
            let horizontal = 0;
            for (let dx = 0; dx < spacing * 1.5; dx++)
              if (pixel(x + dx, headY + direction * d) > 0.5) horizontal++;
            if (horizontal > spacing * 1.2) beam = true;
          }
        }
      }
    if (head !== 'unknown')
      for (let x = headX + spacing * 0.8; x < headX + spacing * 1.8; x++) {
        for (let y = headY - spacing * 0.6; y <= headY + spacing * 0.6; y++) {
          if (Math.abs((y - top) / spacing - Math.round((y - top) / spacing)) < 0.2) continue;
          if (
            pixel(x, y) > 0.65 &&
            pixel(x - 1, y) > 0.5 &&
            pixel(x, y + 1) > 0.5 &&
            pixel(x - 3, y) < 0.2 &&
            pixel(x + 3, y) < 0.2 &&
            pixel(x, y - 3) < 0.2 &&
            pixel(x, y + 3) < 0.2
          )
            dot = true;
        }
      }
    const bases =
      head === 'hollow'
        ? stem
          ? ['2']
          : ['1', '2']
        : head === 'filled' && stem
          ? beam
            ? ['8', '16', '32']
            : ['4', '8']
          : [];
    result.alternatives.push({
      element,
      status: head === 'unknown' ? 'unresolved' : 'supported',
      head,
      stem,
      beam,
      bases,
      ...(dot ? { dots: 1 } : {}),
      cost:
        Number(dot && !e.duration.dots) +
        Number(bases.length > 0 && !bases.includes(e.duration.base)),
      evidence:
        head === 'unknown'
          ? 'Cabeza/silencio sin evidencia suficiente; no resuelto.'
          : `Cabeza ${head}; ${dot ? 'componente compacto compatible con puntillo' : 'sin puntillo confirmado'}.`,
    });
  });
  return result;
}

export function withNotationEvidence(
  ink: Float32Array,
  width: number,
  height: number,
  staff: OmrStaffMeta,
  elements: OmrElementIR[]
): OmrDecodedLine {
  const offset = (staff.window?.start ?? 0) - (staff.window?.contextPrefix ?? 0);
  const local = elements.map((e) =>
    e.src?.normalizedRange
      ? {
          ...e,
          src: {
            ...e.src,
            normalizedRange: e.src.normalizedRange.map((v) => v - offset) as [number, number],
          },
        }
      : e
  );
  const clef = elements.find((e) => e.kind === 'attribute' && e.clef);
  const sign = clef?.kind === 'attribute' ? clef.clef?.sign : null;
  const evidence = inspectNotation(
    ink,
    width,
    height,
    staff.normSpacing,
    local,
    sign === 'F' ? 'F4' : sign === 'G' ? 'G2' : null
  );
  evidence.window = staff.window;
  evidence.normalizedToOriginal = staff.normalizedToOriginal;
  const prefix = staff.window?.contextPrefix ?? 0;
  evidence.bars = evidence.bars.filter((b) => b.x >= prefix);
  evidence.disagreements = evidence.disagreements.filter((d) => d.x >= prefix);
  return {
    staff,
    elements,
    notationEvidence: [evidence],
    warnings: evidence.disagreements.map((d) => ({
      code: 'notation-geometry-disagreement',
      severity: 'warning',
      provenance: 'inferred',
      message:
        'La barra visual y la lectura CTC discrepan en esta región. Se conserva la lectura y la alternativa para revisar.',
      src: {
        page: staff.page,
        system: staff.system,
        staff: staff.staffIndex,
        bbox: staff.normalizedToOriginal
          ? mapBox(staff.normalizedToOriginal, [
              d.x - staff.normSpacing / 2,
              (height - 5 * staff.normSpacing) / 2,
              staff.normSpacing,
              5 * staff.normSpacing,
            ])
          : staff.bbox,
      },
    })),
  };
}
