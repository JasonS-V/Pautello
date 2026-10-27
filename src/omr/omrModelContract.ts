import { MAX_WIDTH, TARGET_HEIGHT, TARGET_SPACING } from './omrPreprocess';

export interface OmrModelVariantSpec {
  id: string;
  path: string;
  bytes: number;
  sha256: string;
  quantization: 'none' | 'dynamic-int8';
  role: 'primary' | 'fallback';
}

export interface OmrModelManifest {
  contractVersion: string;
  modelFamily: string;
  provenance: {
    producer: string;
    trainingDomain: string;
    checkpointRecoveryStatus: string;
    weightsLicense: string;
  };
  tensorContract: {
    inputName: string;
    outputName: string;
    inputType: 'float32';
    outputType: 'float32';
    inputShape: [number, number, number, string];
    outputShape: [number, string, number];
    horizontalSubsamplingFactor: number;
    polarity: 'inverted-ink-0-white-1-black';
    valueRange: [number, number];
    normalization: {
      targetHeight: number;
      targetSpacingPx: number;
      maxWidthPx: number;
      inkThresholdDefault: number;
    };
  };
  vocabulary: {
    path: string;
    bytes: number;
    sha256: string;
    tokenCount: number;
    ctcBlankIndex: number;
    totalOutputClasses: number;
    recordSeparatorToken: string;
    parserOnlyTokensAbsentFromVocab: string[];
  };
  variants: {
    fp32: OmrModelVariantSpec;
    int8: OmrModelVariantSpec;
  };
}

export interface OmrActiveModelContract {
  contractVersion: string;
  modelFamily: string;
  variant: 'fp32' | 'int8';
  variantId: string;
  modelSha256: string;
  vocabSha256: string;
  tokenCount: number;
  totalOutputClasses: number;
}

export function verifyVocabularyAgainstManifest(
  vocabTokens: readonly string[],
  manifest: OmrModelManifest
): void {
  if (!Array.isArray(vocabTokens) || vocabTokens.length === 0) {
    throw new Error('Contrato OMR incompatible: el vocabulario está vacío o es inválido.');
  }
  const unique = new Set(vocabTokens);
  if (unique.size !== vocabTokens.length) {
    throw new Error('Contrato OMR incompatible: el vocabulario contiene tokens duplicados.');
  }
  if (!unique.has(manifest.vocabulary.recordSeparatorToken)) {
    throw new Error(
      `Contrato OMR incompatible: falta el token separador de registros '${manifest.vocabulary.recordSeparatorToken}' en el vocabulario.`
    );
  }
  if (vocabTokens.length !== manifest.vocabulary.tokenCount) {
    throw new Error(
      `Contrato OMR incompatible: el vocabulario tiene ${vocabTokens.length} tokens pero el manifiesto exige ${manifest.vocabulary.tokenCount}.`
    );
  }
  const expectedClasses = vocabTokens.length + 1;
  if (
    manifest.vocabulary.totalOutputClasses !== expectedClasses ||
    manifest.tensorContract.outputShape[2] !== expectedClasses
  ) {
    throw new Error(
      `Contrato OMR incompatible: las clases de salida del manifiesto (${manifest.vocabulary.totalOutputClasses}) no coinciden con vocabulario + blank (${expectedClasses}).`
    );
  }
  const norm = manifest.tensorContract.normalization;
  if (
    norm.targetHeight !== TARGET_HEIGHT ||
    norm.targetSpacingPx !== TARGET_SPACING ||
    norm.maxWidthPx !== MAX_WIDTH
  ) {
    throw new Error(
      `Contrato OMR incompatible: la normalización del manifiesto (${norm.targetHeight}px, espaciado ${norm.targetSpacingPx}, ancho máx. ${norm.maxWidthPx}) no coincide con el preprocesador (${TARGET_HEIGHT}px, espaciado ${TARGET_SPACING}, ancho máx. ${MAX_WIDTH}).`
    );
  }
}

export function verifyModelOutputCompatibility(params: {
  vocabTokensCount: number;
  outputDims: readonly number[];
  inputNames?: readonly string[];
  outputNames?: readonly string[];
  manifest?: OmrModelManifest;
}): void {
  const expectedClasses = params.vocabTokensCount + 1;
  if (params.outputDims.length !== 3) {
    throw new Error(
      `Contrato OMR incompatible: el tensor de salida tiene rango ${params.outputDims.length} en lugar de 3 ([1, T, C]).`
    );
  }
  const actualClasses = params.outputDims[2];
  if (actualClasses !== expectedClasses) {
    throw new Error(
      `Contrato OMR incompatible: el modelo emite ${actualClasses} clases pero el vocabulario define ${expectedClasses} clases (incluyendo blank CTC).`
    );
  }
  if (params.manifest) {
    if (
      params.inputNames &&
      params.inputNames.length > 0 &&
      !params.inputNames.includes(params.manifest.tensorContract.inputName)
    ) {
      throw new Error(
        `Contrato OMR incompatible: entrada del modelo '${params.inputNames[0]}' no coincide con '${params.manifest.tensorContract.inputName}'.`
      );
    }
    if (
      params.outputNames &&
      params.outputNames.length > 0 &&
      !params.outputNames.includes(params.manifest.tensorContract.outputName)
    ) {
      throw new Error(
        `Contrato OMR incompatible: salida del modelo '${params.outputNames[0]}' no coincide con '${params.manifest.tensorContract.outputName}'.`
      );
    }
  }
}
