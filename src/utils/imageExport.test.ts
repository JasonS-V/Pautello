import { describe, it, expect } from 'vitest';
import { getScoreSvgString, exportScoreToSvg } from './imageExport';

describe('imageExport utility', () => {
  it('extracts SVG text from DOM elements when present', () => {
    // Setup mock DOM container
    document.body.innerHTML = `
      <div id="score-canvas">
        <svg class="score-system-svg" width="800" height="150">
          <g class="staff-lines"><line x1="0" y1="20" x2="800" y2="20" /></g>
          <text x="50" y="50">Allegro</text>
        </svg>
      </div>
    `;

    const svgStr = getScoreSvgString();
    expect(svgStr).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svgStr).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svgStr).toContain('Allegro');

    const blob = exportScoreToSvg();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('image/svg+xml');
  });

  it('throws a helpful error when #score-canvas is missing in DOM', () => {
    document.body.innerHTML = '<div>No canvas here</div>';
    expect(() => getScoreSvgString()).toThrowError(/Contenedor de la partitura/);
  });
});
