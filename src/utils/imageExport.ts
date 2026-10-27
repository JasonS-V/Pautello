/**
 * Utilities for capturing and exporting the musical engraving as clean
 * standalone SVG vector graphics and rasterized high-resolution PNG images.
 */

import { Score } from '../types/music';
import { formatEmbeddedScoreMarker, injectScoreIntoPngBytes } from '../omr/scorePayloadCodec';

/**
 * Extracts and synthesizes a standalone SVG document containing all system staves
 * currently rendered on the score canvas.
 */
export function getScoreSvgString(score?: Score): string {
  if (typeof document === 'undefined') {
    return '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"></svg>';
  }

  const container = document.getElementById('score-canvas');
  if (!container) {
    throw new Error('Contenedor de la partitura (#score-canvas) no encontrado.');
  }

  let svgs = Array.from(container.querySelectorAll<SVGSVGElement>('svg.score-system-svg'));
  if (svgs.length === 0) {
    svgs = Array.from(container.querySelectorAll<SVGSVGElement>('svg'));
  }

  if (svgs.length === 0) {
    throw new Error('No se encontraron sistemas gráficos para exportar.');
  }

  let totalHeight = 50; // top padding
  let maxWidth = 840;
  const systemGroups: string[] = [];

  svgs.forEach((svg) => {
    const w = parseFloat(svg.getAttribute('width') || '840');
    const h = parseFloat(svg.getAttribute('height') || '200');
    if (w > maxWidth) maxWidth = w;
    // Strip interactive inputs or selection halos for clean export if present
    const cloned = svg.cloneNode(true) as SVGSVGElement;
    cloned.querySelectorAll('.cursor-pointer, foreignObject, .animate-pulse').forEach((el) => {
      if (el.tagName.toLowerCase() === 'foreignobject') {
        el.remove();
      }
    });

    systemGroups.push(`<g transform="translate(30, ${totalHeight})">${cloned.innerHTML}</g>`);
    totalHeight += h + 30; // gap between systems
  });

  totalHeight += 50; // bottom padding
  const totalWidth = maxWidth + 60;
  const metadataBlock = score
    ? `\n  <desc id="pautello-score-payload">${formatEmbeddedScoreMarker(score)}</desc>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">${metadataBlock}
  <style>
    text { font-family: 'EB Garamond', Garamond, Georgia, serif; fill: #1e293b; }
    line { stroke: #334155; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
  </style>
  <rect width="100%" height="100%" fill="#ffffff" />
  ${systemGroups.join('\n')}
</svg>`;
}

/**
 * Generates an SVG Blob of the currently displayed score engraving.
 */
export function exportScoreToSvg(score?: Score): Blob {
  const svgText = getScoreSvgString(score);
  return new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
}

/**
 * Renders the score SVG into a rasterized high-resolution PNG Blob via Canvas.
 */
export async function exportScoreToPng(scale: number = 2, score?: Score): Promise<Blob> {
  const svgText = getScoreSvgString(score);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('La exportación a PNG requiere un entorno con DOM y Canvas.'));
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.documentElement;
    const width = parseFloat(svgEl.getAttribute('width') || '900');
    const height = parseFloat(svgEl.getAttribute('height') || '1200');

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('No se pudo inicializar el lienzo Canvas 2D.'));
      return;
    }

    ctx.scale(scale, scale);

    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob(async (pngBlob) => {
        if (!pngBlob) {
          reject(new Error('Error al convertir canvas a formato PNG.'));
          return;
        }
        if (!score) {
          resolve(pngBlob);
          return;
        }
        try {
          const buf = await pngBlob.arrayBuffer();
          const withPayload = injectScoreIntoPngBytes(new Uint8Array(buf), score);
          resolve(new Blob([new Uint8Array(withPayload)], { type: 'image/png' }));
        } catch {
          resolve(pngBlob);
        }
      }, 'image/png');
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}
