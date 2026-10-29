import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { describe, it, expect } from 'vitest';
import * as ort from 'onnxruntime-web/wasm';
import {
  type OmrModelManifest,
  buildTrialModelEvaluationRecord,
  verifyModelOutputCompatibility,
  verifyModelReleaseCoherence,
  verifyModelRollbackTransition,
  verifyVocabularyAgainstManifest,
} from '../omrModelContract';
import { decodeLine, i2wFromVocab } from '../omrDecode';
import { grayFromBytes, normalizeStaff } from '../omrPreprocess';

function sha256(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function loadManifest(): OmrModelManifest {
  const manifestPath = path.resolve(process.cwd(), 'public/omr/model-manifest.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as OmrModelManifest;
}

function loadVocabTokens(): string[] {
  const vocabPath = path.resolve(process.cwd(), 'public/omr/vocab.json');
  const parsed = JSON.parse(fs.readFileSync(vocabPath, 'utf8')) as { tokens: string[] };
  return parsed.tokens;
}

describe('OMR Model & Vocabulary Contract (F3.1 & R19)', () => {
  it('verifica que los hashes, tamaños y estructura de public/omr coincidan con model-manifest.json', () => {
    const manifest = loadManifest();
    const vocabBytes = fs.readFileSync(path.resolve(process.cwd(), manifest.vocabulary.path));
    expect(vocabBytes.length).toBe(manifest.vocabulary.bytes);
    expect(sha256(vocabBytes)).toBe(manifest.vocabulary.sha256);

    for (const variant of [manifest.variants.fp32, manifest.variants.int8]) {
      const modelBytes = fs.readFileSync(path.resolve(process.cwd(), variant.path));
      expect(modelBytes.length).toBe(variant.bytes);
      expect(sha256(modelBytes)).toBe(variant.sha256);
    }

    const vocabTokens = loadVocabTokens();
    expect(() => verifyVocabularyAgainstManifest(vocabTokens, manifest)).not.toThrow();

    // Verifica que los tokens soportados solo en el parser realmente no estén en vocab.json
    const vocabSet = new Set(vocabTokens);
    for (const absentToken of manifest.vocabulary.parserOnlyTokensAbsentFromVocab) {
      expect(vocabSet.has(absentToken)).toBe(false);
    }
  });

  it('R19: falla con error claro antes de decodificar cuando el vocabulario o el modelo son incompatibles', () => {
    const manifest = loadManifest();
    const vocabTokens = loadVocabTokens();

    // 1. Vocabulario vacío
    expect(() => verifyVocabularyAgainstManifest([], manifest)).toThrow(/vocabulario está vacío/);

    // 2. Tokens duplicados
    expect(() =>
      verifyVocabularyAgainstManifest(
        [vocabTokens[0], vocabTokens[0], ...vocabTokens.slice(2)],
        manifest
      )
    ).toThrow(/tokens duplicados/);

    // 3. Falta separador <b>
    expect(() =>
      verifyVocabularyAgainstManifest(
        vocabTokens.map((t) => (t === '<b>' ? '*custom' : t)),
        manifest
      )
    ).toThrow(/falta el token separador/);

    // 4. Conteo de tokens incompatible con manifiesto
    expect(() => verifyVocabularyAgainstManifest(vocabTokens.slice(0, 140), manifest)).toThrow(
      /tiene 140 tokens pero el manifiesto exige 141/
    );

    // 5. Clases del manifiesto desalineadas con vocab + blank
    const badClassesManifest: OmrModelManifest = {
      ...manifest,
      vocabulary: { ...manifest.vocabulary, totalOutputClasses: 150 },
    };
    expect(() => verifyVocabularyAgainstManifest(vocabTokens, badClassesManifest)).toThrow(
      /no coinciden con vocabulario \+ blank/
    );

    // 6. Normalización desalineada con preprocesador
    const badNormManifest: OmrModelManifest = {
      ...manifest,
      tensorContract: {
        ...manifest.tensorContract,
        normalization: { ...manifest.tensorContract.normalization, targetHeight: 64 },
      },
    };
    expect(() => verifyVocabularyAgainstManifest(vocabTokens, badNormManifest)).toThrow(
      /normalización del manifiesto/
    );

    // 7. Tensor de salida del modelo con rango o número de clases incompatible
    expect(() =>
      verifyModelOutputCompatibility({
        vocabTokensCount: vocabTokens.length,
        outputDims: [1, 120],
        manifest,
      })
    ).toThrow(/rango 2 en lugar de 3/);

    expect(() =>
      verifyModelOutputCompatibility({
        vocabTokensCount: vocabTokens.length,
        outputDims: [1, 120, 99],
        manifest,
      })
    ).toThrow(/emite 99 clases pero el vocabulario define 142/);

    // 8. Nombres de tensores de entrada/salida incompatibles
    expect(() =>
      verifyModelOutputCompatibility({
        vocabTokensCount: vocabTokens.length,
        outputDims: [1, 120, 142],
        inputNames: ['wrong_input'],
        outputNames: ['log_probs'],
        manifest,
      })
    ).toThrow(/entrada del modelo 'wrong_input'/);

    expect(() =>
      verifyModelOutputCompatibility({
        vocabTokensCount: vocabTokens.length,
        outputDims: [1, 120, 142],
        inputNames: ['input'],
        outputNames: ['wrong_output'],
        manifest,
      })
    ).toThrow(/salida del modelo 'wrong_output'/);
  });

  it('verifica paridad de contrato e inferencia WASM entre FP32 e INT8 sobre line.png', async () => {
    const manifest = loadManifest();
    const vocabTokens = loadVocabTokens();
    verifyVocabularyAgainstManifest(vocabTokens, manifest);
    const i2w = i2wFromVocab(vocabTokens);

    const samplePngPath = path.resolve(process.cwd(), 'src/omr/__tests__/fixtures/line.png');
    const sampleJsonPath = path.resolve(process.cwd(), 'src/omr/__tests__/fixtures/line.json');
    const buf = fs.readFileSync(samplePngPath);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const idatChunks: Buffer[] = [];
    let offset = 8;
    while (offset < buf.length) {
      const len = buf.readUInt32BE(offset);
      const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
      if (type === 'IDAT') idatChunks.push(buf.subarray(offset + 8, offset + 8 + len));
      if (type === 'IEND') break;
      offset += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(idatChunks));
    const pixels = new Uint8Array(width * height);
    const stride = width + 1;
    const paeth = (a: number, b: number, c: number) => {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      if (pa <= pb && pa <= pc) return a;
      if (pb <= pc) return b;
      return c;
    };
    for (let y = 0; y < height; y++) {
      const filter = raw[y * stride];
      const rowStart = y * stride + 1;
      const outRow = y * width;
      for (let x = 0; x < width; x++) {
        const byte = raw[rowStart + x];
        const left = x > 0 ? pixels[outRow + x - 1] : 0;
        const up = y > 0 ? pixels[outRow - width + x] : 0;
        const upLeft = x > 0 && y > 0 ? pixels[outRow - width + x - 1] : 0;
        let recon = byte;
        if (filter === 1) recon = (byte + left) & 0xff;
        else if (filter === 2) recon = (byte + up) & 0xff;
        else if (filter === 3) recon = (byte + Math.floor((left + up) / 2)) & 0xff;
        else if (filter === 4) recon = (byte + paeth(left, up, upLeft)) & 0xff;
        pixels[outRow + x] = recon;
      }
    }

    const meta = JSON.parse(fs.readFileSync(sampleJsonPath, 'utf8')) as {
      line_spacing_px: number;
      ground_truth_kern: string[];
    };
    const gray = grayFromBytes(pixels, width * height);
    const norm = normalizeStaff(gray, width, height, meta.line_spacing_px, null);
    const inverted = new Float32Array(norm.data.length);
    for (let i = 0; i < norm.data.length; i++) {
      inverted[i] = 1.0 - norm.data[i];
    }

    ort.env.wasm.numThreads = 1;

    async function runVariant(variantPath: string) {
      const modelBytes = new Uint8Array(fs.readFileSync(path.resolve(process.cwd(), variantPath)));
      const session = await ort.InferenceSession.create(modelBytes, {
        executionProviders: ['wasm'],
      });
      try {
        const tensor = new ort.Tensor('float32', inverted, [1, 1, norm.height, norm.width]);
        const out = await session.run({ [session.inputNames[0]]: tensor });
        const logits = out[session.outputNames[0]];
        verifyModelOutputCompatibility({
          vocabTokensCount: vocabTokens.length,
          outputDims: logits.dims,
          inputNames: session.inputNames,
          outputNames: session.outputNames,
          manifest,
        });
        const events = decodeLine(logits.data as Float32Array, logits.dims[1], logits.dims[2], i2w);
        tensor.dispose();
        for (const value of Object.values(out)) value.dispose();
        return {
          dims: logits.dims,
          tokens: events.map((e) => e.token),
        };
      } finally {
        await session.release();
      }
    }

    const fp32Res = await runVariant(manifest.variants.fp32.path);
    const int8Res = await runVariant(manifest.variants.int8.path);

    expect(fp32Res.dims).toEqual(int8Res.dims);
    expect(fp32Res.dims[1]).toBe(
      Math.floor(norm.width / manifest.tensorContract.horizontalSubsamplingFactor)
    );
    expect(fp32Res.dims[2]).toBe(manifest.vocabulary.totalOutputClasses);
    expect(fp32Res.tokens).toEqual(int8Res.tokens);
  }, 25000);

  it('F9.4: valida coherencia sin mezcla de versiones, regreso a versión previa (rollback) y registro de evaluación de versión de prueba', () => {
    const manifest = loadManifest();
    const vocabTokens = loadVocabTokens();

    const validAssets = {
      [manifest.vocabulary.path]: {
        sha256: manifest.vocabulary.sha256,
        bytes: manifest.vocabulary.bytes,
      },
      [manifest.variants.fp32.path]: {
        sha256: manifest.variants.fp32.sha256,
        bytes: manifest.variants.fp32.bytes,
      },
      [manifest.variants.int8.path]: {
        sha256: manifest.variants.int8.sha256,
        bytes: manifest.variants.int8.bytes,
      },
    };

    expect(verifyModelReleaseCoherence(manifest, validAssets)).toEqual({ valid: true });

    // Mezcla de versiones: vocab de v1 con pesos de otra versión
    const mixedAssets = {
      ...validAssets,
      [manifest.variants.fp32.path]: {
        sha256: '0'.repeat(64),
        bytes: manifest.variants.fp32.bytes,
      },
    };
    const mixedCheck = verifyModelReleaseCoherence(manifest, mixedAssets);
    expect(mixedCheck.valid).toBe(false);
    expect(mixedCheck.reason).toMatch(/Mezcla de versiones detectada/);

    // Simulación de versión de prueba (trial v2) y rollback limpio a versión previa (v1)
    const trialManifest: OmrModelManifest = {
      ...manifest,
      contractVersion: '1.1.0-trial',
    };
    const rollbackOk = verifyModelRollbackTransition({
      activeTrialManifest: trialManifest,
      rollbackTargetManifest: manifest,
      rollbackVocabTokens: vocabTokens,
      rollbackAssets: validAssets,
    });
    expect(rollbackOk).toEqual({
      canRollback: true,
      restoredContractVersion: manifest.contractVersion,
      preservesScoreSchema: true,
    });

    const rollbackBad = verifyModelRollbackTransition({
      activeTrialManifest: trialManifest,
      rollbackTargetManifest: manifest,
      rollbackVocabTokens: vocabTokens,
      rollbackAssets: mixedAssets,
    });
    expect(rollbackBad.canRollback).toBe(false);

    // Registro de evaluación de versión de prueba con particiones disjuntas y datos locales autorizados
    const record = buildTrialModelEvaluationRecord({
      releaseId: 'omr-crnn-ctc-1.1.0-rc1',
      evaluatedAt: '2026-10-29T14:00:00.000Z',
      manifest: trialManifest,
      partitions: {
        train: ['pdmx-train-01', 'pdmx-train-02'],
        validation: ['pdmx-line-g2-clean', 'synthetic-f4-meter-tie-clean'],
        test: ['el-rey-guitarron-local-v1', 'qdrt-guitarron-local-v1', 'usted-guitarron-local-v1'],
      },
      authorizedLocalSamples: [
        'el-rey-guitarron-local-v1',
        'qdrt-guitarron-local-v1',
        'usted-guitarron-local-v1',
      ],
      metricsSummary: {
        meanExactEventMatchRate: 0.96,
        worstExactEventMatchRate: 0.92,
        regressionGatePassed: true,
      },
    });
    expect(record.releaseId).toBe('omr-crnn-ctc-1.1.0-rc1');
    expect(record.authorizedLocalSamples).toHaveLength(3);
    expect(record.metricsSummary.regressionGatePassed).toBe(true);

    // Fuga entre train y test debe rechazarse
    expect(() =>
      buildTrialModelEvaluationRecord({
        releaseId: 'bad-trial',
        manifest: trialManifest,
        partitions: {
          train: ['el-rey-guitarron-local-v1'],
          validation: ['val-1'],
          test: ['el-rey-guitarron-local-v1'],
        },
        authorizedLocalSamples: ['el-rey-guitarron-local-v1'],
        metricsSummary: {
          meanExactEventMatchRate: 1,
          worstExactEventMatchRate: 1,
          regressionGatePassed: true,
        },
      })
    ).toThrow(/Fuga de partición/);
  });
});
