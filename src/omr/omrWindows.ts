import type { OmrDecodedLine, OmrElementIR, OmrWarning } from './omrDecode';
import { mapBox } from './omrGeometry';

const center = (el: OmrElementIR) => {
  const range = el.src?.normalizedRange;
  return range ? (range[0] + range[1]) / 2 : 0;
};
const content = (el: OmrElementIR) => JSON.stringify(el.tokens ?? el.kind);

/** Nunca resuelve discrepancias por confianza: conserva las hipótesis y una incidencia localizada. */
export function mergeStaffWindows(windows: OmrDecodedLine[]): OmrDecodedLine {
  if (!windows.length) throw new Error('Faltan ventanas de la pauta.');
  const emptyWarnings: OmrWarning[] = windows
    .filter(
      (line) =>
        !line.elements.some(
          (el) => el.kind === 'note' || el.kind === 'rest' || el.kind === 'unparseable'
        )
    )
    .map(({ staff }) => ({
      code: 'window-empty-reading',
      severity: 'error',
      provenance: 'observed',
      src: {
        page: staff.page,
        system: staff.system,
        staff: staff.staffIndex,
        bbox:
          staff.normalizedToOriginal && staff.window
            ? mapBox(staff.normalizedToOriginal, [
                staff.window.contextPrefix ?? 0,
                0,
                staff.window.end - staff.window.start,
                128,
              ])
            : staff.bbox,
      },
      message:
        'Esta ventana no produjo eventos musicales; su región completa queda pendiente de revisar.',
    }));
  if (windows.length === 1)
    return emptyWarnings.length
      ? { ...windows[0], warnings: [...(windows[0].warnings ?? []), ...emptyWarnings] }
      : windows[0];
  const ordered = [...windows].sort(
    (a, b) => (a.staff.window?.start ?? 0) - (b.staff.window?.start ?? 0)
  );
  const elements: OmrElementIR[] = [...ordered[0].elements];
  const warnings: OmrWarning[] = [
    ...windows.flatMap((line) => line.warnings ?? []),
    ...emptyWarnings,
  ];
  for (let i = 1; i < ordered.length; i++) {
    const current = ordered[i],
      previous = ordered[i - 1];
    const start = current.staff.window!.start,
      end = previous.staff.window!.end;
    const old = elements.filter((el) => center(el) >= start && center(el) < end);
    const incoming = current.elements.filter((el) => center(el) >= start && center(el) < end);
    const matched = new Set<OmrElementIR>();
    let ambiguous = end <= start;
    for (const el of current.elements) {
      if (center(el) >= start && center(el) < end) {
        const candidates = old.filter(
          (other) =>
            !matched.has(other) &&
            content(other) === content(el) &&
            Math.abs(center(other) - center(el)) <= 20
        );
        if (candidates.length === 1) {
          matched.add(candidates[0]);
          continue;
        }
        ambiguous = true;
      }
      elements.push(el);
    }
    if (matched.size < old.length || matched.size < incoming.length) ambiguous = true;
    if (ambiguous) {
      const sources = [...old, ...incoming].flatMap((el) => (el.src ? [el.src] : []));
      const src = {
        ...(sources[0] ?? {
          page: current.staff.page,
          system: current.staff.system,
          staff: current.staff.staffIndex,
          bbox: current.staff.bbox,
        }),
      };
      if (sources.length) {
        const x = Math.min(...sources.map((s) => s.bbox[0])),
          y = Math.min(...sources.map((s) => s.bbox[1]));
        src.bbox = [
          x,
          y,
          Math.max(...sources.map((s) => s.bbox[0] + s.bbox[2])) - x,
          Math.max(...sources.map((s) => s.bbox[1] + s.bbox[3])) - y,
        ];
      }
      warnings.push({
        code: 'window-join-ambiguous',
        severity: 'error',
        provenance: 'inferred',
        src: { ...src },
        message:
          'Las ventanas discrepan en este borde; se conservan ambas lecturas para revisar posibles duplicados u omisiones.',
      });
    }
  }
  elements.sort((a, b) => center(a) - center(b));
  return {
    staff: { ...ordered[0].staff, window: undefined },
    elements,
    warnings,
    notationEvidence: ordered.flatMap((line) => line.notationEvidence ?? []),
    hypotheses: ordered.map((line) => ({ staff: line.staff, elements: line.elements })),
  };
}
