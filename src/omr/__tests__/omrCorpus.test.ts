import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkCorpus,
  generateControlledCorpusVariants,
  type OmrCorpusManifest,
} from '../../../scripts/omr-corpus-check';

function sampleManifest(): OmrCorpusManifest {
  return {
    version: 1,
    policy: {
      acceptanceReservedWorkIds: ['el-rey'],
      splitUnit: 'work-and-edition',
      notes: 'Control de particiones por obra y edición.',
    },
    entries: [
      {
        id: 'el-rey-acc',
        workId: 'el-rey',
        editionId: 'nevin-2001',
        partition: 'acceptance',
        availability: 'local-private',
        redistribution: 'private-no-redistribution',
        provenance: 'Aceptación reservada',
        source: {
          path: 'tasks/local/el-rey.pdf',
          sha256: '1'.repeat(64),
          format: 'pdf',
          sourceType: 'pdf-image',
          pages: 1,
        },
        category: {
          clef: 'F4',
          density: 'medium',
          condition: 'clean',
          features: ['dotted-half'],
        },
        label: {
          referencePath: 'tasks/local/el-rey-ground-truth.json',
          expectedMeasures: 55,
        },
      },
      {
        id: 'val-g2',
        workId: 'pdmx-0021737310',
        editionId: 'verovio-v1',
        partition: 'validation',
        availability: 'public-repo',
        redistribution: 'public-domain',
        provenance: 'Dominio público Sol',
        source: {
          path: 'src/omr/__tests__/fixtures/line.png',
          sha256: '2'.repeat(64),
          format: 'png',
          sourceType: 'image',
          pages: 1,
        },
        category: {
          clef: 'G2',
          density: 'low',
          condition: 'clean',
          features: ['treble-clef'],
        },
        label: {
          referencePath: 'src/omr/__tests__/fixtures/line-reference.json',
          expectedMeasures: 6,
        },
      },
      {
        id: 'val-f4',
        workId: 'que-de-raro-tiene',
        editionId: 'mingus-2009',
        partition: 'validation',
        availability: 'local-private',
        redistribution: 'private-no-redistribution',
        provenance: 'Validación independiente Fa',
        source: {
          path: 'tasks/local/qdrt.pdf',
          sha256: '3'.repeat(64),
          format: 'pdf',
          sourceType: 'pdf-text',
          pages: 1,
        },
        category: {
          clef: 'F4',
          density: 'high',
          condition: 'clean',
          features: ['bass-clef'],
        },
        label: {
          expectedMeasures: 100,
        },
      },
    ],
  };
}

describe('manifiesto y particiones del corpus OMR (F0.3)', () => {
  it('valida el manifiesto real del corpus y comprueba separación por obra y edición', () => {
    const corpusPath = fs.existsSync('tasks/omr-corpus.json')
      ? 'tasks/omr-corpus.json'
      : path.join(__dirname, 'fixtures/omr-corpus.json');
    const manifest = JSON.parse(fs.readFileSync(corpusPath, 'utf8')) as OmrCorpusManifest;
    const summary = checkCorpus(manifest, { verifyDiskFiles: true });
    expect(summary.entries).toBeGreaterThanOrEqual(15);
    expect(summary.totalPages).toBeGreaterThanOrEqual(20);
    expect(summary.pagesByPartition.acceptance).toBe(7);
    expect(summary.pagesByPartition.validation).toBeGreaterThanOrEqual(20);
    expect(summary.entriesByClef.F4).toBeGreaterThanOrEqual(2);
    expect(summary.entriesByClef.G2).toBeGreaterThanOrEqual(2);
  });

  it('rechaza duplicados de imagen por SHA-256', () => {
    const manifest = sampleManifest();
    manifest.entries[2].source.sha256 = manifest.entries[1].source.sha256;
    expect(() => checkCorpus(manifest)).toThrow(/duplicado por SHA-256/);
  });

  it('impide que distintas muestras de la misma obra queden en particiones distintas', () => {
    const manifest = sampleManifest();
    manifest.entries.push({
      ...manifest.entries[1],
      id: 'val-g2-leak',
      partition: 'training',
      source: {
        ...manifest.entries[1].source,
        sha256: '4'.repeat(64),
      },
    });
    expect(() => checkCorpus(manifest)).toThrow(/dividida entre particiones distintas/);
  });

  it('impide colocar la obra reservada El Rey fuera de aceptación', () => {
    const manifest = sampleManifest();
    manifest.entries[0].partition = 'validation';
    expect(() => checkCorpus(manifest)).toThrow(/obra reservada el-rey/);
  });

  it('impide ubicar muestras privadas sin permiso de redistribución en carpetas públicas', () => {
    const manifest = sampleManifest();
    manifest.entries[2].source.path = 'src/omr/__tests__/fixtures/private.pdf';
    expect(() => checkCorpus(manifest)).toThrow(/carpeta pública/);
  });

  it('exige que validación cubra tanto clave de Sol (G2) como clave de Fa (F4)', () => {
    const manifest = sampleManifest();
    manifest.entries = manifest.entries.filter((e) => e.id !== 'val-f4');
    expect(() => checkCorpus(manifest)).toThrow(/clave de Sol \(G2\) como en clave de Fa \(F4\)/);
  });

  it('genera variantes controladas deterministas de degradación visual', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omr-corpus-variants-'));
    try {
      const first = await generateControlledCorpusVariants(
        'src/omr/__tests__/fixtures/line.png',
        tempDir
      );
      const second = await generateControlledCorpusVariants(
        'src/omr/__tests__/fixtures/line.png',
        tempDir
      );
      expect(Object.keys(first)).toEqual([
        'low-contrast',
        'rotated',
        'compressed',
        'low-resolution',
        'short-system',
        'uneven-contrast',
        'broken-lines',
        'stains',
        'clipped-border',
        'large-header',
        'perspective',
        'non-music',
        'lossless-metadata',
      ]);
      for (const key of Object.keys(first)) {
        expect(first[key].sha256).toBe(second[key].sha256);
        expect(fs.existsSync(first[key].path)).toBe(true);
      }
      expect(first['low-resolution'].width).toBeLessThan(first['low-contrast'].width);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
