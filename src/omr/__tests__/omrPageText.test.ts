import { describe, expect, it } from 'vitest';
import {
  classifyPageText,
  deriveQuarterBpm,
  findBoxedMarks,
  planTextRegions,
} from '../omrPageText';

describe('page text and indications', () => {
  it('keeps editorial roles distinct on the image-only reference header', () => {
    const lines = [
      ['Bajo', [83, 46, 86, 43]],
      ['for Southwestern College Mariachis', [558, 53, 279, 17]],
      ['El Rey', [603, 186, 187, 64]],
      ['"Do" — Male Singer', [80, 266, 153, 17]],
      ['Level 2', [80, 285, 58, 14]],
      ['José Alfredo Jiménez', [1144, 266, 165, 13]],
      ['arr. Jeff Nevin', [1145, 285, 110, 14]],
      ['Ranchera Valseada d = 60', [348, 325, 295, 42]],
    ].map(([text, bbox], index) => ({
      text: text as string,
      bbox: bbox as [number, number, number, number],
      confidence: 90,
      source: 'ocr' as const,
      words: [],
      page: 1,
      id: `line-${index}`,
    }));
    const result = classifyPageText(lines, 1394, 430);
    expect(result.fields).toMatchObject({
      title: 'El Rey',
      composer: 'José Alfredo Jiménez',
      arranger: 'Jeff Nevin',
      part: 'Bajo',
      style: 'Ranchera Valseada',
    });
    expect(result.fields.editorialKey).toBe('"Do" — Male Singer');
    expect(result.proposals.find((proposal) => proposal.field === 'composer')?.source.bbox).toEqual(
      [1144, 266, 165, 13]
    );
  });

  it('does not turn a dedication into a composer when no author is printed', () => {
    const lines = [
      ['Canción para mi madre', [350, 80, 280, 48]],
      ['For Maria', [720, 135, 120, 15]],
    ].map(([text, bbox], index) => ({
      id: String(index),
      page: 1,
      text: text as string,
      bbox: bbox as [number, number, number, number],
      confidence: 90,
      source: 'ocr' as const,
      words: [],
    }));
    const result = classifyPageText(lines, 1000, 240);
    expect(result.fields.title).toBe('Canción para mi madre');
    expect(result.fields.composer).toBeUndefined();
    expect(result.fields.dedication).toBe('For Maria');
  });

  it('plans separate columns above the first staff and gaps before later systems', () => {
    const regions = planTextRegions(1200, 1800, [
      [100, 400, 1000, 90],
      [100, 600, 1000, 90],
    ]);
    expect(regions).toContainEqual([0, 0, 300, 400]);
    expect(regions).toContainEqual([300, 490, 600, 110]);
  });

  it('converts a visible beat unit without treating an unknown unit as a quarter', () => {
    expect(deriveQuarterBpm('h', 0, 60)).toBe(120);
    expect(deriveQuarterBpm('q', 0, 60)).toBe(60);
    expect(deriveQuarterBpm('8', 0, 90)).toBe(45);
    expect(deriveQuarterBpm('q', 1, 90)).toBe(135);
    expect(deriveQuarterBpm(null, 0, 60)).toBeNull();
  });

  it('finds a boxed rehearsal candidate outside the staff', () => {
    const gray = new Float32Array(100 * 70).fill(1);
    for (let x = 20; x <= 50; x++) {
      gray[10 * 100 + x] = 0;
      gray[45 * 100 + x] = 0;
    }
    for (let y = 10; y <= 45; y++) {
      gray[y * 100 + 20] = 0;
      gray[y * 100 + 50] = 0;
    }
    expect(findBoxedMarks(gray, 100, [[0, 0, 100, 70]])).toContainEqual([20, 10, 31, 36]);
  });
});
