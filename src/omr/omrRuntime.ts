import { i2wFromVocab } from './omrDecode';
import {
  verifyVocabularyAgainstManifest,
  type OmrActiveModelContract,
  type OmrModelManifest,
} from './omrModelContract';

export interface CachedOmrRuntime {
  ort: typeof import('onnxruntime-web/wasm');
  session: import('onnxruntime-web/wasm').InferenceSession;
  vocabTokens: string[];
  i2w: Record<number, string>;
  inputName: string;
  outputName: string;
  manifest?: OmrModelManifest;
  modelContract: OmrActiveModelContract;
}

let cachedRuntimePromise: Promise<CachedOmrRuntime> | null = null;
let cachedInt8Promise: Promise<CachedOmrRuntime> | null = null;

async function verifyResourceHash(bytes: ArrayBuffer, expected: string, label: string) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actual = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  if (actual !== expected) throw new Error(`${label}: checksum SHA-256 incorrecto.`);
}

export function resolvePublicAssetUrl(relativePath: string): string {
  if (typeof window === 'undefined') {
    if (typeof self !== 'undefined' && 'location' in self)
      return new URL(`../${relativePath.replace(/^\.\//, '')}`, self.location.href).href;
    return relativePath;
  }
  try {
    return new URL(relativePath, window.location.href).href;
  } catch {
    return relativePath;
  }
}

/**
 * Inicializa y mantiene en caché la sesión de ONNX Runtime Web (WASM) y el vocabulario `**kern`.
 */
export async function getOmrRuntime(forceVariant?: 'int8'): Promise<CachedOmrRuntime> {
  if (forceVariant && cachedInt8Promise) return cachedInt8Promise;
  if (!forceVariant && cachedRuntimePromise) return cachedRuntimePromise;

  const load = async (variant: 'fp32' | 'int8'): Promise<CachedOmrRuntime> => {
    const ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.numThreads = 1;

    const vocabUrl = resolvePublicAssetUrl('./omr/vocab.json');
    const vocabRes = await fetch(vocabUrl);
    if (!vocabRes.ok) {
      throw new Error(`No se pudo cargar el vocabulario OMR (${vocabRes.status}).`);
    }
    const vocabBytes = await vocabRes.arrayBuffer();
    const vocabJson = JSON.parse(new TextDecoder().decode(vocabBytes)) as { tokens: string[] };
    const vocabTokens = vocabJson.tokens;

    const manifestRes = await fetch(resolvePublicAssetUrl('./omr/model-manifest.json'));
    if (!manifestRes.ok)
      throw new Error(`No se pudo cargar el contrato OMR (${manifestRes.status}).`);
    const manifest = (await manifestRes.json()) as OmrModelManifest;
    await verifyResourceHash(vocabBytes, manifest.vocabulary.sha256, 'Vocabulario OMR');
    verifyVocabularyAgainstManifest(vocabTokens, manifest);
    const i2w = i2wFromVocab(vocabTokens);

    const modelRes = await fetch(resolvePublicAssetUrl(`./omr/omr-line.${variant}.onnx`));
    if (!modelRes.ok)
      throw new Error(`No se pudieron cargar los pesos ${variant} (${modelRes.status}).`);
    const modelBuffer = await modelRes.arrayBuffer();
    await verifyResourceHash(modelBuffer, manifest.variants[variant].sha256, `Modelo ${variant}`);

    const session = await ort.InferenceSession.create(new Uint8Array(modelBuffer), {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    const inputName = session.inputNames[0] || 'input';
    const outputName = session.outputNames[0] || 'logits';
    const variantSpec = manifest.variants[variant];
    const modelContract: OmrActiveModelContract = {
      contractVersion: manifest.contractVersion,
      modelFamily: manifest.modelFamily,
      variant,
      variantId: variantSpec.id,
      modelSha256: variantSpec.sha256,
      vocabSha256: manifest.vocabulary.sha256,
      tokenCount: vocabTokens.length,
      totalOutputClasses: vocabTokens.length + 1,
    };

    return {
      ort,
      session,
      vocabTokens,
      i2w,
      inputName,
      outputName,
      manifest,
      modelContract,
    };
  };
  if (forceVariant) {
    cachedInt8Promise = load('int8').catch((error) => {
      cachedInt8Promise = null;
      throw error;
    });
    return cachedInt8Promise;
  }
  cachedRuntimePromise = load('fp32').catch(async (primaryError) => {
    try {
      return await getOmrRuntime('int8');
    } catch (fallbackError) {
      cachedRuntimePromise = null;
      throw new Error(
        `Modelo FP32: ${String(primaryError)}; respaldo INT8: ${String(fallbackError)}`,
        { cause: fallbackError }
      );
    }
  });
  return cachedRuntimePromise;
}

/**
 * Extrae metadatos editoriales (título, compositor, tempo) de los elementos de texto
 * situados en la cabecera de la primera página de un PDF vectorial.
 */
