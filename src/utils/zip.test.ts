import { describe, it, expect } from 'vitest';
import { crc32, createZipBlob } from './zip';

describe('ZIP generation utility', () => {
  it('computes correct standard CRC32 checksums', () => {
    const encoder = new TextEncoder();
    expect(crc32(encoder.encode(''))).toBe(0);
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
  });

  it('creates a non-empty ZIP Blob with valid headers and entries', async () => {
    const blob = createZipBlob([
      { name: 'score.musicxml', data: '<score-partwise version="4.0"></score-partwise>' },
      { name: 'part-1.musicxml', data: '<score-partwise></score-partwise>' },
    ]);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/zip');
    expect(blob.size).toBeGreaterThan(100);

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Verify PK 03 04 local file header signature
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });
});
