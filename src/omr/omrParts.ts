import type { OmrDecodedLine, OmrElementIR } from './omrDecode';
import type { Box } from './omrGeometry';

export interface OmrTextRegion {
  text: string;
  bbox: Box;
}
const normalizeLabel = (label: string) =>
  label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function findStaffLabel(
  box: Box,
  spacing: number,
  textRegions: OmrTextRegion[]
): string | undefined {
  const [x, y, , h] = box;
  return textRegions
    .find(
      ({ text, bbox }) =>
        /^(?:viol[ií]n|violin|viola|cello|violonchelo|flauta|flute|clarinete|clarinet|trompeta|trumpet|tromb[oó]n|trombone|tuba|fagot|bassoon|bajo|bass|guitarr[oó]n|guitarra|piano)\b/i.test(
          text.trim()
        ) &&
        text.trim().length <= 40 &&
        bbox[0] + bbox[2] <= x + spacing * 3 &&
        bbox[1] + bbox[3] >= y - spacing &&
        bbox[1] <= y + h + spacing
    )
    ?.text.trim();
}

const clefOf = (line: OmrDecodedLine) => {
  const clef = line.elements.find((e) => e.kind === 'attribute' && e.clef) as
    Extract<OmrElementIR, { kind: 'attribute' }> | undefined;
  return clef?.clef ? `${clef.clef.sign}${clef.clef.line}` : null;
};

/** Identidad provisional por clave y orden; las plantillas ambiguas nunca pasan inadvertidas. */
export function assignPartIdentities(lines: OmrDecodedLine[]): OmrDecodedLine[] {
  const groups = new Map<string, OmrDecodedLine[]>();
  for (const line of lines) {
    const key = `${line.staff.page}/${line.staff.system}`;
    const group = groups.get(key) ?? [];
    group.push(line);
    groups.set(key, group);
  }
  for (const group of groups.values())
    group.sort((a, b) => a.staff.staffIndex - b.staff.staffIndex);
  const template = [...([...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [])];
  for (const line of lines)
    if (
      line.staff.partLabel &&
      !template.some(
        (known) =>
          known.staff.partLabel &&
          normalizeLabel(known.staff.partLabel) === normalizeLabel(line.staff.partLabel!)
      )
    )
      template.push(line);
  const signatures = template.map(clefOf);
  const labels = template.map((line) =>
    line.staff.partLabel ? normalizeLabel(line.staff.partLabel) : null
  );
  return [...groups.values()].flatMap((group) => {
    const used = new Set<number>();
    return group.map((line, position) => {
      const clef = clefOf(line);
      const label = line.staff.partLabel ? normalizeLabel(line.staff.partLabel) : null;
      const candidates = signatures.flatMap((signature, index) =>
        !used.has(index) && (label ? labels[index] === label : clef && signature === clef)
          ? [index]
          : []
      );
      const partIndex =
        candidates.length === 1
          ? candidates[0]
          : !used.has(position)
            ? position
            : signatures.findIndex((_, i) => !used.has(i));
      used.add(partIndex);
      const ambiguous =
        (template.length === 1 && line.staff.page !== template[0].staff.page && !label) ||
        (template.length > 1 &&
          (label
            ? labels.filter((known) => known === label).length !== 1
            : !clef ||
              signatures.filter((signature) => signature === clef).length !== 1 ||
              (group.length === template.length && partIndex !== position)));
      return {
        ...line,
        staff: { ...line.staff, partIndex, assignmentAmbiguous: ambiguous },
        warnings: [
          ...(line.warnings ?? []),
          ...(ambiguous
            ? [
                {
                  code: 'part-identity-ambiguous',
                  severity: 'warning' as const,
                  provenance: 'inferred' as const,
                  src: {
                    page: line.staff.page,
                    system: line.staff.system,
                    staff: line.staff.staffIndex,
                    bbox: line.staff.bbox,
                  },
                  message: `Identidad provisional de la parte ${partIndex + 1} por orden vertical; la clave no permite distinguir los instrumentos.`,
                },
              ]
            : []),
        ],
      };
    });
  });
}
