import { describe, it, expect } from 'vitest';
import {
  TARGET_HEIGHT,
  grayFromBytes,
  rgbaToGray,
  binarize,
  findStaffLines,
  groupLinesIntoStaves,
  findSystems,
  detect,
  detectAdaptive,
  preprocessPage,
} from '../omrPreprocess';

/**
 * Crea una página sintética en escala de grises (blanco = 1.0) con pentagramas de 5 líneas.
 */
function createSyntheticScorePage(
  width: number,
  height: number,
  staffTops: number[],
  lineSpacing: number,
  lineGrayValue: number = 0.1,
  connectStavesInSystem: boolean = false
): Float32Array {
  const gray = new Float32Array(width * height).fill(1.0);
  const xStart = Math.floor(width * 0.08);
  const xEnd = Math.floor(width * 0.92);

  for (const topY of staffTops) {
    for (let l = 0; l < 5; l++) {
      const y = Math.round(topY + l * lineSpacing);
      if (y >= 0 && y < height) {
        for (let x = xStart; x < xEnd; x++) {
          gray[y * width + x] = lineGrayValue;
        }
      }
    }
  }

  if (connectStavesInSystem && staffTops.length >= 2) {
    const y0 = staffTops[0];
    const y1 = Math.round(staffTops[staffTops.length - 1] + 4 * lineSpacing);
    for (let y = y0; y <= y1; y++) {
      if (y >= 0 && y < height) {
        gray[y * width + xStart] = 0.0;
        gray[y * width + xStart + 1] = 0.0;
      }
    }
  }

  return gray;
}

describe('omrPreprocess', () => {
  it('convierte bytes y RGBA a luminancia Float32 en [0, 1]', () => {
    const gray = grayFromBytes(new Uint8Array([0, 255]));
    expect(gray[0]).toBeCloseTo(0, 5);
    expect(gray[1]).toBeCloseTo(1, 5);

    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255, // negro opaco
      255, 255, 255, 255, // blanco opaco
      0, 0, 0, 0, // transparente -> compone a blanco
    ]);
    const fromRgba = rgbaToGray(rgba, 3, 1);
    expect(fromRgba[0]).toBeCloseTo(0, 4);
    expect(fromRgba[1]).toBeCloseTo(1, 4);
    expect(fromRgba[2]).toBeCloseTo(1, 4);
  });

  it('detecta un pentagrama estándar de 5 líneas y genera un tensor normalizado de 128px de alto', () => {
    const width = 600;
    const height = 240;
    const page = createSyntheticScorePage(width, height, [80], 10, 0.05);

    const det = detect(page, width, height);
    expect(det.staves).toHaveLength(1);
    expect(det.staves[0].lineSpacing).toBeCloseTo(10, 1);
    expect(det.boxes).toHaveLength(1);

    const prep = preprocessPage(page, width, height, { enableDeskew: false });
    expect(prep.inputs).toHaveLength(1);
    expect(prep.inputs[0].height).toBe(TARGET_HEIGHT);
    expect(prep.inputs[0].data.length).toBe(TARGET_HEIGHT * prep.inputs[0].width);
  });

  it('detecta pautas grises claras (#cbd5e1 ~ 0.83) mediante el barrido multiumbral adaptativo', () => {
    const width = 600;
    const height = 240;
    // Luminancia 0.82 simula el color slate-300 (#cbd5e1) usado en trazos suaves de SVG
    const faintPage = createSyntheticScorePage(width, height, [80], 10, 0.82);

    const fixedDet = detect(faintPage, width, height, 0.6);
    expect(fixedDet.boxes).toHaveLength(0);

    const adaptiveDet = detectAdaptive(faintPage, width, height);
    expect(adaptiveDet.boxes).toHaveLength(1);
    expect(adaptiveDet.usedThreshold).toBeGreaterThan(0.6);

    const prep = preprocessPage(faintPage, width, height, { enableDeskew: false });
    expect(prep.inputs).toHaveLength(1);
  });

  it('agrupa dos pentagramas unidos por barra vertical en un mismo sistema (Gran Pentagrama)', () => {
    const width = 600;
    const height = 360;
    const grandStaffPage = createSyntheticScorePage(width, height, [60, 160], 10, 0.05, true);

    const ink = binarize(grandStaffPage, width, height);
    const runs = findStaffLines(ink, width, height);
    const staves = groupLinesIntoStaves(runs);
    expect(staves).toHaveLength(2);

    const systems = findSystems(ink, width, staves);
    expect(systems).toEqual([[0, 1]]);
  });
});
