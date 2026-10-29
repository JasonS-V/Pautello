export const MAX_OMR_PAGES = 20;
export const MAX_OMR_PAGE_PIXELS = 8_000_000;
export const MAX_OMR_TOTAL_PIXELS = 60_000_000;

/** Un espacio de 10 px deja al menos 2 px para detalles de 1/5 de espacio. */
export function choosePdfScale(
  width: number,
  height: number,
  spacing: number | null,
  usedPixels = 0
): number {
  const remaining = Math.min(MAX_OMR_PAGE_PIXELS, MAX_OMR_TOTAL_PIXELS - usedPixels);
  if (remaining < width * height)
    throw new Error('No queda presupuesto de píxeles para esta página. Elige un rango menor.');
  const desired = spacing && spacing > 0 ? Math.max(1, 10 / spacing) : 2.4;
  return Math.min(desired, Math.sqrt(remaining / (width * height)));
}

export function checkOmrFileType(extension: string, header: Uint8Array): void {
  const ascii = new TextDecoder().decode(header);
  const valid =
    extension === 'pdf'
      ? ascii.startsWith('%PDF-')
      : extension === 'png'
        ? header.length >= 8 &&
          [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => header[i] === byte)
        : extension === 'jpg' || extension === 'jpeg'
          ? header[0] === 0xff && header[1] === 0xd8
          : extension === 'webp'
            ? ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP'
            : extension === 'svg'
              ? /<svg(?:\s|>)/i.test(ascii)
              : false;
  if (!valid) throw new Error('El contenido del archivo no coincide con un formato OMR admitido.');
}

export function selectPdfPages(pageCount: number, range = ''): number[] {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1)
    throw new Error('El PDF no contiene páginas válidas.');
  const requested = range.trim();
  if (!requested && pageCount > MAX_OMR_PAGES) {
    throw new Error(
      `El PDF tiene ${pageCount} páginas. Indica un rango de hasta ${MAX_OMR_PAGES} páginas para continuar.`
    );
  }
  if (!requested) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set<number>();
  for (const segment of requested.split(',')) {
    const match = segment.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Indica las páginas como 3, 3-12 o 1,3-5.');
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first || last > pageCount || last - first + 1 > MAX_OMR_PAGES) {
      throw new Error(
        `La selección debe estar entre 1 y ${pageCount} y contener como máximo ${MAX_OMR_PAGES} páginas.`
      );
    }
    for (let page = first; page <= last; page++) pages.add(page);
    if (pages.size > MAX_OMR_PAGES)
      throw new Error(`Selecciona como máximo ${MAX_OMR_PAGES} páginas.`);
  }
  return [...pages].sort((a, b) => a - b);
}

export function checkPixelBudget(width: number, height: number, usedPixels = 0): number {
  const pixels = width * height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    !Number.isSafeInteger(usedPixels) ||
    usedPixels < 0 ||
    !Number.isSafeInteger(pixels) ||
    width < 1 ||
    height < 1 ||
    pixels > MAX_OMR_PAGE_PIXELS
  ) {
    throw new Error(
      `La página supera el límite de ${MAX_OMR_PAGE_PIXELS.toLocaleString('es')} píxeles o tiene dimensiones inválidas.`
    );
  }
  if (usedPixels + pixels > MAX_OMR_TOTAL_PIXELS) {
    throw new Error(
      `Las páginas seleccionadas superan el presupuesto total de ${MAX_OMR_TOTAL_PIXELS.toLocaleString('es')} píxeles. Elige un rango menor.`
    );
  }
  return usedPixels + pixels;
}

export function inspectPageInk(gray: Float32Array): 'empty' | 'faint' | 'visible' {
  let dark = 0;
  let faint = 0;
  const step = Math.max(1, Math.floor(gray.length / 20_000));
  let sampled = 0;
  for (let i = 0; i < gray.length; i += step) {
    sampled++;
    if (gray[i] < 0.8) dark++;
    if (gray[i] < 0.95) faint++;
  }
  if (faint / sampled < 0.0005) return 'empty';
  return dark / Math.max(1, faint) < 0.12 ? 'faint' : 'visible';
}
