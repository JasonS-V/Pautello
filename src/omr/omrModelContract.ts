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

export interface OmrCachedAssetCheck {
  sha256: string;
  bytes: number;
}

export function verifyModelReleaseCoherence(
  manifest: OmrModelManifest,
  cachedAssets: Record<string, OmrCachedAssetCheck>
): { valid: boolean; reason?: string } {
  const required: Array<{ label: string; path: string; sha256: string; bytes: number }> = [
    {
      label: 'vocabulary',
      path: manifest.vocabulary.path,
      sha256: manifest.vocabulary.sha256,
      bytes: manifest.vocabulary.bytes,
    },
    {
      label: 'fp32',
      path: manifest.variants.fp32.path,
      sha256: manifest.variants.fp32.sha256,
      bytes: manifest.variants.fp32.bytes,
    },
    {
      label: 'int8',
      path: manifest.variants.int8.path,
      sha256: manifest.variants.int8.sha256,
      bytes: manifest.variants.int8.bytes,
    },
  ];

  for (const item of required) {
    const asset = cachedAssets[item.path];
    if (!asset) {
      return {
        valid: false,
        reason: `Falta el recurso '${item.path}' (${item.label}) en el conjunto versionado.`,
      };
    }
    if (asset.sha256 !== item.sha256 || asset.bytes !== item.bytes) {
      return {
        valid: false,
        reason: `Mezcla de versiones detectada en '${item.path}': hash/tamaño (${asset.sha256.slice(0, 12)}/${asset.bytes}) no coincide con el manifiesto (${item.sha256.slice(0, 12)}/${item.bytes}).`,
      };
    }
  }

  return { valid: true };
}

export function verifyModelRollbackTransition(params: {
  activeTrialManifest: OmrModelManifest;
  rollbackTargetManifest: OmrModelManifest;
  rollbackVocabTokens: readonly string[];
  rollbackAssets: Record<string, OmrCachedAssetCheck>;
}): {
  canRollback: boolean;
  restoredContractVersion: string;
  preservesScoreSchema: boolean;
  reason?: string;
} {
  try {
    verifyVocabularyAgainstManifest(params.rollbackVocabTokens, params.rollbackTargetManifest);
  } catch (error) {
    return {
      canRollback: false,
      restoredContractVersion: params.rollbackTargetManifest.contractVersion,
      preservesScoreSchema: true,
      reason: error instanceof Error ? error.message : 'Vocabulario de rollback inválido.',
    };
  }

  const coherence = verifyModelReleaseCoherence(
    params.rollbackTargetManifest,
    params.rollbackAssets
  );
  if (!coherence.valid) {
    return {
      canRollback: false,
      restoredContractVersion: params.rollbackTargetManifest.contractVersion,
      preservesScoreSchema: true,
      reason: coherence.reason,
    };
  }

  return {
    canRollback: true,
    restoredContractVersion: params.rollbackTargetManifest.contractVersion,
    preservesScoreSchema: true,
  };
}

export interface OmrTrialEvaluationRecord {
  releaseId: string;
  evaluatedAt: string;
  contractVersion: string;
  modelFamily: string;
  provenance: OmrModelManifest['provenance'];
  partitions: {
    train: readonly string[];
    validation: readonly string[];
    test: readonly string[];
  };
  authorizedLocalSamples: readonly string[];
  metricsSummary: {
    meanExactEventMatchRate: number;
    worstExactEventMatchRate: number;
    regressionGatePassed: boolean;
  };
}

export function buildTrialModelEvaluationRecord(params: {
  releaseId: string;
  evaluatedAt?: string;
  manifest: OmrModelManifest;
  partitions: {
    train: readonly string[];
    validation: readonly string[];
    test: readonly string[];
  };
  authorizedLocalSamples: readonly string[];
  metricsSummary: {
    meanExactEventMatchRate: number;
    worstExactEventMatchRate: number;
    regressionGatePassed: boolean;
  };
}): OmrTrialEvaluationRecord {
  if (!params.releaseId.trim()) {
    throw new Error('Se requiere un identificador de versión de prueba (releaseId).');
  }
  if (
    params.partitions.train.length === 0 ||
    params.partitions.validation.length === 0 ||
    params.partitions.test.length === 0
  ) {
    throw new Error(
      'El registro de evaluación requiere particiones no vacías de entrenamiento, validación y prueba.'
    );
  }
  const trainSet = new Set(params.partitions.train);
  const valSet = new Set(params.partitions.validation);
  for (const id of params.partitions.validation) {
    if (trainSet.has(id)) {
      throw new Error(`Fuga de partición detectada: '${id}' está en train y validation.`);
    }
  }
  for (const id of params.partitions.test) {
    if (trainSet.has(id) || valSet.has(id)) {
      throw new Error(`Fuga de partición detectada: '${id}' aparece en test y otra partición.`);
    }
  }
  if (!params.manifest.provenance.weightsLicense || !params.manifest.provenance.producer) {
    throw new Error('El manifiesto de prueba debe declarar procedencia y licencia de pesos.');
  }

  return {
    releaseId: params.releaseId.trim(),
    evaluatedAt: params.evaluatedAt ?? new Date().toISOString(),
    contractVersion: params.manifest.contractVersion,
    modelFamily: params.manifest.modelFamily,
    provenance: params.manifest.provenance,
    partitions: {
      train: [...params.partitions.train],
      validation: [...params.partitions.validation],
      test: [...params.partitions.test],
    },
    authorizedLocalSamples: [...params.authorizedLocalSamples],
    metricsSummary: { ...params.metricsSummary },
  };
}
