import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  FileText,
  RotateCcw,
  Loader2,
  Layers,
} from '../ui/icons';
import { OmrReviewPanel } from './OmrReviewPanel';
import { OmrDraftEditor } from './OmrDraftEditor';
import { applyOmrIndications, linkOmrNavigationTargets } from '../../omr/omrIndicationMapping';
import { loadOmrDraft, saveOmrDraft, type OmrDraft } from '../../omr/omrDraftPersistence';
import {
  applyOmrMeasureProposals,
  inspectOmrMeasures,
  refreshOmrSourceLinks,
} from '../../omr/omrToScore';
import { Score, KeySignature, ScoreItem } from '../../types/music';
import { importMusicXmlToScore } from '../../utils/musicxml';
import { parseMidiToScore } from '../../utils/midiParser';
import {
  detectKeyFromScore,
  transposeScoreNotes,
  getSemitoneOffsetBetweenKeys,
  ALL_KEYS,
} from '../../utils/keyDetection';
import { KEY_SIGNATURE_DATA } from '../../constants/pitches';
import { CustomSelect } from '../ui/CustomSelect';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader, ModalFooter } from '../ui/ModalChrome';
import { modalButton } from '../ui/modalButton';
import { useToast } from '../ui/toastContext';
import { getOmrOfflineStatus, prepareOmrOffline } from '../../pwa/omrOffline';
import { normalizeScore } from '../../utils/scoreSchema';
import { recognizeScoreFromFile, OmrProgress, OmrResult } from '../../omr/omrEngine';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportScore: (score: Score, session?: OmrResult) => void;
}

const OMR_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'svg']);
const MAX_IMPORT_BYTES = 16 * 1024 * 1024;
const QUARTER_NOTE_GLYPH = '\u2669';
const DOT_SEPARATOR = '\u2022';

interface DraftSnapshot {
  score: Score;
  selectedKey: KeySignature;
  selectedTempo: number;
  selectedTimeSignature: { beats: number; beatType: number };
  acceptedProposals: string[];
  acceptedIndications: string[];
  rejectedIndications: string[];
  reviewedWarningIds: string[];
  reviewedMeasureIds: string[];
  manualEditMeasureIds: string[];
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImportScore }) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const omrAbort = useRef<AbortController | null>(null);
  const importRun = useRef(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parsedScore, setParsedScore] = useState<Score | null>(null);
  const [detectedKey, setDetectedKey] = useState<KeySignature>('C');
  const [selectedKey, setSelectedKey] = useState<KeySignature>('C');
  const [keyConfidence, setKeyConfidence] = useState<number>(100);
  const [transposeNotes, setTransposeNotes] = useState<boolean>(true);
  const [selectedTimeSignature, setSelectedTimeSignature] = useState<{
    beats: number;
    beatType: number;
  }>({
    beats: 4,
    beatType: 4,
  });
  const [selectedTempo, setSelectedTempo] = useState<number>(120);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunningOmr, setIsRunningOmr] = useState<boolean>(false);
  const [omrProgress, setOmrProgress] = useState<OmrProgress | null>(null);
  const [omrSummary, setOmrSummary] = useState<OmrResult | null>(null);
  const [pdfPageRange, setPdfPageRange] = useState('');
  const [rotation, setRotation] = useState('auto');
  const [offlineState, setOfflineState] = useState<
    'unavailable' | 'checking' | 'missing' | 'preparing' | 'ready'
  >('unavailable');
  const [offlineProgress, setOfflineProgress] = useState('');

  const [acceptedProposals, setAcceptedProposals] = useState<string[]>([]);
  const [acceptedIndications, setAcceptedIndications] = useState<string[]>([]);
  const [rejectedIndications, setRejectedIndications] = useState<string[]>([]);
  const [indicationTargets, setIndicationTargets] = useState<Record<string, string>>({});
  const [reviewedWarningIds, setReviewedWarningIds] = useState<string[]>([]);
  const [reviewedMeasureIds, setReviewedMeasureIds] = useState<string[]>([]);
  const [manualEditMeasureIds, setManualEditMeasureIds] = useState<string[]>([]);
  const [availableDraft, setAvailableDraft] = useState<OmrDraft | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const draftPast = useRef<DraftSnapshot[]>([]);
  const draftFuture = useRef<DraftSnapshot[]>([]);
  const neuralResult = omrSummary?.sourceType === 'neural-onnx';
  const measureAnalysis =
    parsedScore && neuralResult ? inspectOmrMeasures(parsedScore, omrSummary.sourceLinks) : null;
  const previewScore =
    parsedScore && neuralResult
      ? applyOmrMeasureProposals(parsedScore, acceptedProposals)
      : parsedScore;
  const reviewResult =
    omrSummary && previewScore
      ? {
          ...omrSummary,
          score: previewScore,
          report:
            omrSummary.report && neuralResult
              ? {
                  ...omrSummary.report,
                  representedEvents: refreshOmrSourceLinks(
                    previewScore,
                    omrSummary.sourceLinks
                  ).filter((link) => link.measureId).length,
                  pendingEvents: refreshOmrSourceLinks(previewScore, omrSummary.sourceLinks).filter(
                    (link) => !link.measureId
                  ).length,
                }
              : omrSummary.report,
          warnings: [
            ...omrSummary.warnings.filter(
              (w) => !['measure-overfull', 'measure-underfull', 'unmapped-event'].includes(w.code)
            ),
            ...(neuralResult
              ? inspectOmrMeasures(
                  previewScore,
                  refreshOmrSourceLinks(previewScore, omrSummary.sourceLinks)
                ).warnings
              : []),
            ...(neuralResult
              ? refreshOmrSourceLinks(previewScore, omrSummary.sourceLinks)
                  .filter((link) => !link.measureId)
                  .map((link) => ({
                    code: 'unmapped-event',
                    severity: 'error' as const,
                    provenance: 'modified' as const,
                    src: link.src,
                    page: link.src?.page,
                    system: link.src?.system,
                    staff: link.src?.staff,
                    message: `El evento leído en la parte ${link.sourcePart + 1}, compás ${link.sourceMeasure + 1} no aparece en el borrador editable.`,
                  }))
              : []),
          ],
        }
      : null;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    loadOmrDraft()
      .then((draft) => {
        if (!cancelled) setAvailableDraft(draft);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || window.location.protocol === 'file:' || !import.meta.env.PROD) return;
    let active = true;
    setOfflineState('checking');
    getOmrOfflineStatus()
      .then((status) => {
        if (active) setOfflineState(status.ready ? 'ready' : 'missing');
      })
      .catch(() => {
        if (active) setOfflineState('missing');
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !parsedScore || omrSummary?.sourceType !== 'neural-onnx') return;
    setDraftSaveState('saving');
    const timer = setTimeout(() => {
      const draft: OmrDraft = {
        version: 1,
        savedAt: Date.now(),
        score: parsedScore,
        result: omrSummary,
        acceptedMeasureIds: acceptedProposals,
        acceptedIndicationIds: acceptedIndications,
        rejectedIndicationIds: rejectedIndications,
        reviewedWarningIds,
        reviewedMeasureIds,
        manualEditMeasureIds,
      };
      saveOmrDraft(draft)
        .then(() => {
          setAvailableDraft(draft);
          setDraftSaveState('saved');
        })
        .catch((error) => {
          setDraftSaveState('error');
          setErrorMessage(
            error instanceof Error ? error.message : 'No se pudo guardar el borrador.'
          );
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    parsedScore,
    omrSummary,
    acceptedProposals,
    acceptedIndications,
    rejectedIndications,
    reviewedWarningIds,
    reviewedMeasureIds,
    manualEditMeasureIds,
  ]);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    const run = ++importRun.current;
    setErrorMessage(null);
    setOmrSummary(null);
    setAcceptedProposals([]);
    setAcceptedIndications([]);
    setRejectedIndications([]);
    setIndicationTargets({});
    setReviewedWarningIds([]);
    setReviewedMeasureIds([]);
    setManualEditMeasureIds([]);
    draftPast.current = [];
    draftFuture.current = [];

    if (file.size > MAX_IMPORT_BYTES) {
      toast.warning(
        'Archivo muy grande',
        'El límite máximo para importar partituras o PDFs es de 16 MB.'
      );
      return;
    }

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';

      let score: Score;

      if (OMR_EXTENSIONS.has(extension)) {
        const controller = new AbortController();
        omrAbort.current = controller;
        setIsRunningOmr(true);
        setOmrProgress({
          stage: 'loading-file',
          message: 'Preparando motor de reconocimiento óptico musical (OMR)...',
          percent: 5,
        });

        try {
          const omrResult = await recognizeScoreFromFile(
            file,
            (prog) => {
              if (run === importRun.current) setOmrProgress(prog);
            },
            {
              pdfPageRange,
              ...(rotation === 'auto' ? {} : { rotation: Number(rotation) as 0 | 90 | 180 | 270 }),
              signal: controller.signal,
            }
          );
          if (controller.signal.aborted || run !== importRun.current) return;
          score = omrResult.score;
          setOmrSummary(omrResult);
        } finally {
          if (omrAbort.current === controller) omrAbort.current = null;
          if (run === importRun.current) {
            setIsRunningOmr(false);
            setOmrProgress(null);
          }
        }
      } else if (extension === 'json') {
        const text = await file.text();
        score = JSON.parse(text) as Score;
      } else if (extension === 'xml' || extension === 'musicxml') {
        const text = await file.text();
        score = importMusicXmlToScore(text);
      } else if (extension === 'mid' || extension === 'midi') {
        const arrayBuffer = await file.arrayBuffer();
        score = parseMidiToScore(arrayBuffer, file.name);
      } else {
        throw new Error(
          'Formato no soportado. Selecciona un archivo .pdf, .png, .jpg, .svg, .musicxml, .xml, .mid o .json.'
        );
      }

      const normalized = normalizeScore(score);
      if (!normalized) {
        throw new Error('El archivo no contiene ninguna partitura que se pueda leer.');
      }

      const keyResult = detectKeyFromScore(normalized);
      setParsedScore(normalized);
      setDetectedKey(keyResult.key);
      setSelectedKey(normalized.keySignature);
      setKeyConfidence(keyResult.confidence);
      setSelectedTimeSignature(normalized.timeSignature);
      setSelectedTempo(normalized.tempo);
      toast.success(
        'Partitura leída',
        `"${normalized.title || file.name}" se ha cargado para revisión.`
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (run !== importRun.current) return;
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error al procesar el archivo.';
      setErrorMessage(msg);
      setParsedScore(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.error('Error de importación', msg);
    }
  };

  const handleTimeSignatureChange = (newBeats: number, newBeatType: number) => {
    const newTs = { beats: newBeats, beatType: newBeatType };
    setSelectedTimeSignature(newTs);
    setAcceptedProposals([]);
    if (!parsedScore) return;
    editDraft({
      ...parsedScore,
      timeSignature: newTs,
    });
  };

  const handleTempoChange = (rawVal: number) => {
    const valid = Math.max(30, Math.min(300, rawVal || 120));
    setSelectedTempo(valid);
    if (parsedScore) {
      editDraft({ ...parsedScore, tempo: valid });
    }
  };

  const handleEditorialChange = (
    field: 'title' | 'composer' | 'arranger' | 'partName',
    value: string
  ) => {
    if (parsedScore) editDraft({ ...parsedScore, [field]: value });
    setOmrSummary((result) =>
      result ? { ...result, metadataHints: { ...result.metadataHints, [field]: value } } : result
    );
  };

  const captureDraft = (): DraftSnapshot | null =>
    parsedScore
      ? {
          score: structuredClone(parsedScore),
          selectedKey,
          selectedTempo,
          selectedTimeSignature: { ...selectedTimeSignature },
          acceptedProposals: [...acceptedProposals],
          acceptedIndications: [...acceptedIndications],
          rejectedIndications: [...rejectedIndications],
          reviewedWarningIds: [...reviewedWarningIds],
          reviewedMeasureIds: [...reviewedMeasureIds],
          manualEditMeasureIds: [...manualEditMeasureIds],
        }
      : null;
  const pushDraft = () => {
    const snapshot = captureDraft();
    if (!snapshot) return;
    draftPast.current.push(snapshot);
    if (draftPast.current.length > 50) draftPast.current.shift();
    draftFuture.current = [];
  };
  const restoreDraft = (snapshot: DraftSnapshot) => {
    setParsedScore(snapshot.score);
    setSelectedKey(snapshot.selectedKey);
    setSelectedTempo(snapshot.selectedTempo);
    setSelectedTimeSignature(snapshot.selectedTimeSignature);
    setAcceptedProposals(snapshot.acceptedProposals);
    setAcceptedIndications(snapshot.acceptedIndications);
    setRejectedIndications(snapshot.rejectedIndications);
    setReviewedWarningIds(snapshot.reviewedWarningIds);
    setReviewedMeasureIds(snapshot.reviewedMeasureIds);
    setManualEditMeasureIds(snapshot.manualEditMeasureIds);
  };
  const editDraft = (next: Score, measureId?: string) => {
    if (!parsedScore) return;
    pushDraft();
    setParsedScore(next);
    setSelectedTempo(next.tempo);
    setSelectedTimeSignature(next.timeSignature);
    if (measureId) {
      setManualEditMeasureIds((ids) => (ids.includes(measureId) ? ids : [...ids, measureId]));
      setReviewedMeasureIds((ids) => ids.filter((id) => id !== measureId));
    }
  };
  const undoDraft = () => {
    const previous = draftPast.current.pop();
    if (!previous || !parsedScore) return;
    const current = captureDraft();
    if (current) draftFuture.current.push(current);
    restoreDraft(previous);
  };
  const redoDraft = () => {
    const next = draftFuture.current.pop();
    if (!next || !parsedScore) return;
    const current = captureDraft();
    if (current) draftPast.current.push(current);
    restoreDraft(next);
  };
  const saveDraft = async (score: Score = parsedScore!, result: OmrResult = omrSummary!) => {
    if (!score || result?.sourceType !== 'neural-onnx') return;
    const draft: OmrDraft = {
      version: 1,
      savedAt: Date.now(),
      score,
      result,
      acceptedMeasureIds: acceptedProposals,
      acceptedIndicationIds: acceptedIndications,
      rejectedIndicationIds: rejectedIndications,
      reviewedWarningIds,
      reviewedMeasureIds,
      manualEditMeasureIds,
    };
    await saveOmrDraft(draft);
    setAvailableDraft(draft);
    setDraftSaveState('saved');
  };
  const resumeDraft = () => {
    if (!availableDraft) return;
    const draft = availableDraft;
    setParsedScore(draft.score);
    setOmrSummary(draft.result);
    setAcceptedProposals(draft.acceptedMeasureIds);
    setAcceptedIndications(draft.acceptedIndicationIds);
    setRejectedIndications(draft.rejectedIndicationIds);
    setReviewedWarningIds(draft.reviewedWarningIds);
    setReviewedMeasureIds(draft.reviewedMeasureIds);
    setManualEditMeasureIds(draft.manualEditMeasureIds);
    setSelectedKey(draft.score.keySignature);
    setSelectedTimeSignature(draft.score.timeSignature);
    setSelectedTempo(draft.score.tempo);
    draftPast.current = [];
    draftFuture.current = [];
  };
  const rerecognizeMeasure = async (staffId: string, measureId: string): Promise<ScoreItem[]> => {
    if (!omrSummary) throw new Error('La fuente original no está disponible.');
    const boxes = omrSummary.sourceLinks
      .filter((link) => link.staffId === staffId && link.measureId === measureId && link.src)
      .map((link) => link.src!);
    if (!boxes.length) throw new Error('Este compás no tiene una región de origen fiable.');
    const page = omrSummary.sourcePages?.find((entry) => entry.pageNumber === boxes[0].page);
    if (!page) throw new Error('La imagen de origen no está disponible.');
    const image = new Image();
    image.src = page.imageUrl;
    await image.decode();
    const left = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.bbox[0])) - 60));
    const top = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.bbox[1])) - 80));
    const right = Math.min(
      page.width,
      Math.ceil(Math.max(...boxes.map((box) => box.bbox[0] + box.bbox[2])) + 60)
    );
    const bottom = Math.min(
      page.height,
      Math.ceil(Math.max(...boxes.map((box) => box.bbox[1] + box.bbox[3])) + 80)
    );
    const canvas = document.createElement('canvas');
    canvas.width = right - left;
    canvas.height = bottom - top;
    canvas
      .getContext('2d')!
      .drawImage(image, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('No se pudo recortar la fuente.'))),
        'image/png'
      )
    );
    const reread = await recognizeScoreFromFile(
      new File([blob], 'region.png', { type: 'image/png' })
    );
    const items = reread.score.staves[0]?.measures[0]?.items;
    if (!items?.length || items.every((item) => item.omrPlaceholder))
      throw new Error('La región no produjo eventos editables.');
    return items.map((item) => ({ ...item, id: `omr-region-${crypto.randomUUID()}` }));
  };
  const acceptIndication = (id: string) => {
    if (!parsedScore || !omrSummary?.ir || !omrSummary.indicationPlans) return;
    const plan = omrSummary.indicationPlans.find((entry) => entry.id === id);
    if (!plan) return;
    const targetMeasureId = indicationTargets[id] ?? plan.measureId;
    const targetStaff = parsedScore.staves.find((staff) =>
      staff.measures.some((measure) => measure.id === targetMeasureId)
    );
    if (!targetStaff || !targetMeasureId) return;
    const resolvedPlans = omrSummary.indicationPlans.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            staffId: targetStaff.id,
            measureId: targetMeasureId,
            status: 'suggested' as const,
          }
        : entry
    );
    const mapped = applyOmrIndications(
      parsedScore,
      omrSummary.ir,
      resolvedPlans.filter((entry) => entry.id === id),
      [id]
    );
    linkOmrNavigationTargets(mapped, omrSummary.ir, resolvedPlans, [...acceptedIndications, id]);
    if (JSON.stringify(mapped) === JSON.stringify(parsedScore)) {
      setErrorMessage(
        'La indicación no tiene una asignación editable inequívoca. Revisa la fuente y corrígela manualmente.'
      );
      return;
    }
    setErrorMessage(null);
    editDraft(mapped, targetMeasureId);
    setOmrSummary((current) =>
      current ? { ...current, indicationPlans: resolvedPlans } : current
    );
    setAcceptedIndications((ids) => [...ids, id]);
    setRejectedIndications((ids) => ids.filter((entry) => entry !== id));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isRunningOmr) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleProcessFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleProcessFile(file);
  };

  const handleConfirmImport = async () => {
    if (!parsedScore) return;

    let finalScore = previewScore ?? parsedScore;
    if (selectedKey !== parsedScore.keySignature) {
      if (transposeNotes) {
        const semitones = getSemitoneOffsetBetweenKeys(finalScore.keySignature, selectedKey);
        finalScore = transposeScoreNotes(finalScore, semitones, selectedKey);
      } else {
        finalScore = { ...finalScore, keySignature: selectedKey };
      }
    }

    if (selectedTempo !== finalScore.tempo) {
      finalScore = { ...finalScore, tempo: selectedTempo };
    }

    const session =
      reviewResult?.sourceType === 'neural-onnx'
        ? {
            ...reviewResult,
            score: finalScore,
            sourceLinks: refreshOmrSourceLinks(finalScore, reviewResult.sourceLinks),
            recognizedScore: omrSummary?.score,
            reviewedWarningIds,
            reviewedMeasureIds,
            manualEditMeasureIds,
            acceptedIndicationIds: acceptedIndications,
            rejectedIndicationIds: rejectedIndications,
            reviewStatus: (reviewedMeasureIds.length >=
              finalScore.staves.reduce((n, st) => n + st.measures.length, 0) &&
            reviewedWarningIds.length >= reviewResult.warnings.length &&
            !reviewResult.report?.pendingEvents &&
            !rejectedIndications.length &&
            reviewResult.indicationPlans?.every(
              (plan) => plan.status === 'exact' || acceptedIndications.includes(plan.id)
            )
              ? 'reviewed'
              : 'confirmed-with-pending') as OmrResult['reviewStatus'],
            acceptedProposals: measureAnalysis?.proposals.filter((proposal) =>
              acceptedProposals.includes(proposal.measureId)
            ),
          }
        : undefined;
    if (session) {
      try {
        await saveDraft(finalScore, session);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el borrador.');
        return;
      }
    }
    onImportScore(finalScore, session);
    toast.success('Partitura importada', 'La partitura se ha cargado en el editor.');
    handleReset();
    onClose();
  };

  const handleReset = () => {
    omrAbort.current?.abort();
    omrAbort.current = null;
    importRun.current++;
    setParsedScore(null);
    setAcceptedProposals([]);
    setAcceptedIndications([]);
    setRejectedIndications([]);
    setIndicationTargets({});
    setReviewedWarningIds([]);
    setReviewedMeasureIds([]);
    setManualEditMeasureIds([]);
    setErrorMessage(null);
    setIsRunningOmr(false);
    setOmrProgress(null);
    setOmrSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = async () => {
    if (isRunningOmr) {
      handleReset();
      onClose();
      return;
    }
    if (parsedScore && omrSummary?.sourceType === 'neural-onnx') {
      try {
        await saveDraft();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el borrador.');
        return;
      }
    }
    handleReset();
    onClose();
  };
  const handleChooseOther = async () => {
    if (isRunningOmr) {
      handleReset();
      return;
    }
    if (parsedScore && omrSummary?.sourceType === 'neural-onnx') {
      try {
        await saveDraft();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el borrador.');
        return;
      }
    }
    handleReset();
  };

  const detectedKeyName = KEY_SIGNATURE_DATA[detectedKey]?.name || detectedKey;
  const totalNotes = parsedScore
    ? parsedScore.staves.reduce(
        (sAcc, st) =>
          sAcc +
          st.measures.reduce(
            (mAcc, m) => mAcc + m.items.filter((it) => it.type === 'note').length,
            0
          ),
        0
      )
    : 0;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabel="Importar partitura"
      maxWidth={parsedScore && neuralResult ? 'max-w-6xl' : 'max-w-xl'}
    >
      <ModalHeader
        icon={<Upload className="w-4 h-4" />}
        title="Importar Partitura"
        subtitle="PDF e imágenes (OMR Neuronal ONNX), MusicXML, MIDI y proyectos Pautello"
        onClose={handleClose}
        closeLabel="Cerrar importador"
        className="mb-5"
      />

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.musicxml,.xml,.mid,.midi,.json"
        className="hidden"
        aria-label="Seleccionar archivo a importar"
      />

      {/* State 1: Dropzone or OMR Progress */}
      {!parsedScore ? (
        <div className="space-y-4">
          {!isRunningOmr && (
            <>
              {offlineState !== 'unavailable' && (
                <div className="rounded-lg border border-slate-300 dark:border-studio-line p-3 text-xs text-slate-700 dark:text-slate-300">
                  {offlineState === 'ready' ? (
                    <span>OMR preparado para usar sin conexión.</span>
                  ) : offlineState === 'checking' ? (
                    <span>Comprobando recursos OMR locales…</span>
                  ) : offlineState === 'preparing' ? (
                    <span role="status">Preparando recursos OMR {offlineProgress}…</span>
                  ) : (
                    <button
                      type="button"
                      className={modalButton.secondary}
                      onClick={() => {
                        setOfflineState('preparing');
                        void prepareOmrOffline((status) => {
                          if (status.completed)
                            setOfflineProgress(`${status.completed}/${status.total}`);
                        })
                          .then((status) => setOfflineState(status.ready ? 'ready' : 'missing'))
                          .catch((error) => {
                            setOfflineState('missing');
                            toast.error(
                              'Preparación OMR',
                              error instanceof Error
                                ? error.message
                                : 'No se pudieron guardar los recursos.'
                            );
                          });
                      }}
                    >
                      Preparar OMR sin conexión
                    </button>
                  )}
                </div>
              )}
              {availableDraft && (
                <button
                  type="button"
                  onClick={resumeDraft}
                  className="w-full rounded-lg border border-amber-500 p-2 text-left text-xs font-semibold"
                >
                  Continuar borrador OMR guardado: {availableDraft.score.title}
                </button>
              )}
              <label className="block text-xs text-slate-600 dark:text-slate-300">
                Páginas del PDF (opcional; máximo 20 por importación)
                <input
                  type="text"
                  inputMode="numeric"
                  value={pdfPageRange}
                  onChange={(event) => setPdfPageRange(event.target.value)}
                  placeholder="Todas, o por ejemplo 1,3-5"
                  className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-elevated px-3 py-2"
                />
              </label>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <span id="omr-orientation-label" className="mb-1 block">
                  Orientación de la imagen o PDF
                </span>
                <CustomSelect
                  value={rotation}
                  onChange={setRotation}
                  ariaLabelledBy="omr-orientation-label"
                  options={[
                    { value: 'auto', label: 'Automática (revisar sentido de lectura)' },
                    { value: '0', label: 'Sin giro (0°)' },
                    { value: '90', label: 'Girar 90° a la derecha' },
                    { value: '180', label: 'Girar 180°' },
                    { value: '270', label: 'Girar 90° a la izquierda' },
                  ]}
                />
              </div>
            </>
          )}
          {isRunningOmr && omrProgress ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-amber-300 dark:border-amber-800/70 bg-amber-50/70 dark:bg-studio-elevated p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                      Reconocimiento Óptico Musical (OMR ONNX)
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                      {omrProgress.message}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-200/70 dark:bg-amber-950/80 px-2.5 py-1 rounded-lg shrink-0">
                  {omrProgress.percent}%
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-studio-surface overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-150 ease-out rounded-full"
                  style={{ width: `${Math.max(5, Math.min(100, omrProgress.percent))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                <span>Motor CRNN-CTC en WebAssembly (100% local)</span>
                {omrProgress.totalPages && omrProgress.currentPage ? (
                  <span>
                    Página {omrProgress.currentPage} / {omrProgress.totalPages}
                  </span>
                ) : null}
              </div>
              <button type="button" className={modalButton.secondary} onClick={handleReset}>
                Cancelar importación
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-amber-500 ring-2 ring-studio-accent/60 bg-amber-500/5 scale-[1.01]'
                  : 'border-slate-300 dark:border-studio-line hover:border-amber-500 dark:hover:border-studio-accent bg-slate-50 dark:bg-studio-elevated'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-100/70 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 shadow-inner">
                <Upload className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                Arrastra tu partitura aquí o haz clic para explorar
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Formatos compatibles: .pdf, .png, .jpg, .svg, .musicxml, .xml, .mid, .json (máx. 16
                MB)
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-100/80 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50">
                <Layers className="w-3 h-3" />
                <span>Lectura OMR local para PDF e imágenes</span>
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      ) : (
        /* State 2: Key Detection Analysis & Confirmation */
        <div className="space-y-4 animate-in fade-in">
          {/* Metadata Card */}
          <div className="bg-slate-50 dark:bg-studio-elevated p-3.5 rounded-xl border border-slate-200 dark:border-studio-lineSoft flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                    {parsedScore.title || 'Partitura Sin Título'}
                  </h4>
                  {omrSummary && (
                    <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      {omrSummary.sourceType === 'lossless-metadata'
                        ? 'Restauración nativa'
                        : `OMR ONNX ${DOT_SEPARATOR} ${omrSummary.confidence}% confianza del reconocimiento ${DOT_SEPARATOR} ${omrSummary.stavesDetected} pauta(s), ${omrSummary.systemsDetected ?? '?'} sistema(s), ${omrSummary.partsDetected ?? parsedScore.staves.length} parte(s)`}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {parsedScore.staves[0]?.measures.length || 0} compases {DOT_SEPARATOR}{' '}
                  {totalNotes} notas {DOT_SEPARATOR} {parsedScore.timeSignature.beats}/
                  {parsedScore.timeSignature.beatType} {DOT_SEPARATOR} {QUARTER_NOTE_GLYPH} ={' '}
                  {parsedScore.tempo} BPM
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleChooseOther()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-studio-hover transition-colors cursor-pointer shrink-0"
              title="Cambiar archivo"
              aria-label="Cambiar archivo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {reviewResult && neuralResult && previewScore && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={undoDraft}
                  disabled={!draftPast.current.length}
                  className="rounded border px-2 py-1 disabled:opacity-50"
                >
                  Deshacer corrección
                </button>
                <button
                  type="button"
                  onClick={redoDraft}
                  disabled={!draftFuture.current.length}
                  className="rounded border px-2 py-1 disabled:opacity-50"
                >
                  Rehacer corrección
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void saveDraft().catch((error) => {
                      setDraftSaveState('error');
                      setErrorMessage(
                        error instanceof Error ? error.message : 'No se pudo guardar.'
                      );
                    })
                  }
                  className="rounded border px-2 py-1"
                >
                  Guardar borrador
                </button>
                <span role="status">
                  {draftSaveState === 'saving'
                    ? 'Guardando borrador…'
                    : draftSaveState === 'saved'
                      ? 'Borrador guardado'
                      : draftSaveState === 'error'
                        ? 'Error al guardar'
                        : 'Borrador sin guardar'}
                </span>
              </div>
              {errorMessage && (
                <p role="alert" className="text-xs text-red-700">
                  {errorMessage}
                </p>
              )}
              <OmrDraftEditor
                score={previewScore}
                result={reviewResult}
                onEdit={editDraft}
                onRerecognize={rerecognizeMeasure}
                reviewedWarningIds={reviewedWarningIds}
                onToggleReviewed={(id) => {
                  pushDraft();
                  setReviewedWarningIds((ids) =>
                    ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]
                  );
                }}
                reviewedMeasureIds={reviewedMeasureIds}
                onToggleMeasureReviewed={(id) => {
                  pushDraft();
                  setReviewedMeasureIds((ids) =>
                    ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]
                  );
                }}
              />
            </>
          )}
          {reviewResult && !neuralResult && <OmrReviewPanel result={reviewResult} />}
          {neuralResult && omrSummary?.indicationPlans?.some((plan) => plan.status !== 'exact') && (
            <fieldset className="space-y-2 rounded-xl border p-3 text-xs">
              <legend className="font-semibold">Indicaciones por asignar o revisar</legend>
              {omrSummary.indicationPlans
                .filter((plan) => plan.status !== 'exact')
                .map((plan) => {
                  const indication = omrSummary.indications?.find((entry) => entry.id === plan.id);
                  const decision = acceptedIndications.includes(plan.id)
                    ? 'Aceptada'
                    : rejectedIndications.includes(plan.id)
                      ? 'Descartada'
                      : 'Pendiente';
                  return (
                    <div key={plan.id} className="rounded border p-2 space-y-1">
                      <p>
                        {indication?.text ?? indication?.kind ?? plan.id} — {plan.reason}{' '}
                        <strong>{decision}</strong>
                      </p>
                      {decision === 'Pendiente' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label={`Compás de ${indication?.text ?? indication?.kind ?? plan.id}`}
                            value={indicationTargets[plan.id] ?? plan.measureId ?? ''}
                            onChange={(e) =>
                              setIndicationTargets((current) => ({
                                ...current,
                                [plan.id]: e.target.value,
                              }))
                            }
                            className="rounded border p-1 text-slate-900"
                          >
                            <option value="">Seleccionar compás</option>
                            {parsedScore?.staves.flatMap((staff) =>
                              staff.measures.map((measure, index) => (
                                <option key={measure.id} value={measure.id}>
                                  {staff.name}, compás {measure.printedNumber ?? index + 1}
                                </option>
                              ))
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => acceptIndication(plan.id)}
                            className="underline"
                          >
                            Aceptar asignación
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              pushDraft();
                              setRejectedIndications((ids) => [...ids, plan.id]);
                            }}
                            className="underline"
                          >
                            Descartar propuesta
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </fieldset>
          )}
          {neuralResult && parsedScore && (
            <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-slate-300 dark:border-studio-lineSoft p-3.5 text-xs">
              <legend className="font-semibold">Texto editorial propuesto</legend>
              {(
                [
                  ['title', 'Título', parsedScore.title],
                  ['composer', 'Compositor', parsedScore.composer],
                  ['arranger', 'Arreglista', omrSummary?.metadataHints?.arranger ?? ''],
                  ['partName', 'Parte', parsedScore.partName ?? ''],
                ] as const
              ).map(([field, label, value]) => {
                const proposal = omrSummary?.editorial?.proposals.find(
                  (entry) => entry.field === (field === 'partName' ? 'part' : field)
                );
                return (
                  <label key={field} className="space-y-1 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">
                      {label}
                      {proposal && (
                        <span className="ml-1 font-normal opacity-75">
                          ({Math.round(proposal.confidence * 100)} % confianza OCR)
                        </span>
                      )}
                    </span>
                    <input
                      type="text"
                      value={value}
                      maxLength={120}
                      onChange={(event) => handleEditorialChange(field, event.target.value)}
                      className="block w-full rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface px-2.5 py-1.5"
                    />
                  </label>
                );
              })}
            </fieldset>
          )}
          {measureAnalysis && measureAnalysis.proposals.length > 0 && (
            <fieldset className="space-y-2 rounded-xl border border-slate-300 dark:border-studio-lineSoft p-3.5 text-xs">
              <legend className="font-semibold">
                Propuestas de división — requieren comprobar la fuente
              </legend>
              {measureAnalysis.proposals.map((proposal) => {
                const staff = parsedScore.staves.find((st) => st.id === proposal.staffId)!;
                const number = staff.measures.findIndex((m) => m.id === proposal.measureId) + 1;
                return (
                  <label key={proposal.measureId} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={acceptedProposals.includes(proposal.measureId)}
                      onChange={(event) => {
                        pushDraft();
                        setAcceptedProposals((ids) =>
                          event.target.checked
                            ? [...ids, proposal.measureId]
                            : ids.filter((id) => id !== proposal.measureId)
                        );
                      }}
                    />
                    <span>
                      Dividir compás {number} de {staff.name} en {proposal.replacement.length}{' '}
                      compases. {proposal.reason}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}

          {/* Meter & Tempo Quick Controls */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-studio-lineSoft bg-slate-50/70 dark:bg-studio-elevated">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Compás / Métrica:
                </span>
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-studio-surface border border-slate-300/80 dark:border-studio-lineSoft">
                  {[
                    { beats: 3, beatType: 4, label: '3/4' },
                    { beats: 4, beatType: 4, label: '4/4' },
                    { beats: 2, beatType: 4, label: '2/4' },
                    { beats: 6, beatType: 8, label: '6/8' },
                  ].map((ts) => {
                    const isSelected =
                      selectedTimeSignature.beats === ts.beats &&
                      selectedTimeSignature.beatType === ts.beatType;
                    return (
                      <button
                        key={`${ts.beats}/${ts.beatType}`}
                        type="button"
                        onClick={() => handleTimeSignatureChange(ts.beats, ts.beatType)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white dark:bg-studio-elevated text-amber-700 dark:text-amber-400 shadow-sm border border-slate-200 dark:border-studio-lineSoft'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {ts.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="import-tempo-input"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0"
                >
                  Tempo:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="import-tempo-input"
                    type="number"
                    min={30}
                    max={300}
                    value={selectedTempo}
                    onChange={(e) => handleTempoChange(parseInt(e.target.value, 10))}
                    className="w-16 px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-studio-surface border border-slate-300 dark:border-studio-lineSoft rounded-lg text-center focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none"
                  />
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    BPM
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Detection Panel */}
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Análisis Tonal Inteligente</span>
              </div>
              <span className="text-[10px] font-bold bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full">
                {keyConfidence}% de coincidencia
              </span>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              Algoritmo Krumhansl-Schmuckler: La armonía dominante detectada es{' '}
              <strong className="text-amber-900 dark:text-amber-300">{detectedKeyName}</strong>.
            </p>

            {/* Target Key Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/30">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tonalidad deseada al abrir:
              </span>
              <CustomSelect<KeySignature>
                value={selectedKey}
                onChange={(key) => {
                  pushDraft();
                  setSelectedKey(key);
                }}
                options={ALL_KEYS.map((k) => {
                  const data = KEY_SIGNATURE_DATA[k.key];
                  return {
                    value: k.key,
                    label: `${data?.name || k.key}${k.key === detectedKey ? ' (Detectada)' : ''}`,
                    badge: k.key === detectedKey ? 'DETECTADA' : undefined,
                  };
                })}
                className="w-56"
              />
            </div>

            {/* Transpose checkbox */}
            {selectedKey !== parsedScore.keySignature && (
              <div className="mt-3 pt-2.5 border-t border-amber-200/60 dark:border-amber-900/30 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="transpose-check"
                  checked={transposeNotes}
                  onChange={(e) => setTransposeNotes(e.target.checked)}
                  className="w-4 h-4 accent-studio-accent rounded cursor-pointer transition-transform active:scale-90"
                />
                <label
                  htmlFor="transpose-check"
                  className="text-xs text-slate-800 dark:text-slate-200 cursor-pointer font-medium"
                >
                  Transponer automáticamente las notas a la nueva tonalidad (
                  {getSemitoneOffsetBetweenKeys(parsedScore.keySignature, selectedKey)} semitonos)
                </label>
              </div>
            )}
          </div>

          {/* Bottom confirmation buttons */}
          {neuralResult && reviewResult && (
            <p className="rounded border border-amber-500/60 bg-amber-50 p-2 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
              {reviewResult.warnings.length} aviso(s) y {reviewResult.report?.pendingEvents ?? 0}{' '}
              evento(s) sin representación confirmada. Si cargas ahora, la partitura quedará
              identificada como importación con pendientes hasta completar la revisión.
            </p>
          )}
          <ModalFooter className="mt-4">
            <button
              type="button"
              onClick={() => void handleChooseOther()}
              className={modalButton.secondary}
            >
              Elegir otro archivo
            </button>

            <button type="button" onClick={handleConfirmImport} className={modalButton.primary}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Cargar en el Editor</span>
            </button>
          </ModalFooter>
        </div>
      )}
    </ModalBase>
  );
};
