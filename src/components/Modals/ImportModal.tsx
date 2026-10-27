import React, { useState, useRef } from 'react';
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
import { Score, KeySignature } from '../../types/music';
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
import { normalizeScore } from '../../utils/scoreSchema';
import { recognizeScoreFromFile, OmrProgress, OmrResult } from '../../omr/omrEngine';
import { reconcileMeasuresForTimeSignature } from '../../omr/omrToScore';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportScore: (score: Score) => void;
}

const OMR_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'svg']);
const MAX_IMPORT_BYTES = 16 * 1024 * 1024;
const QUARTER_NOTE_GLYPH = '\u2669';
const DOT_SEPARATOR = '\u2022';

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImportScore }) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parsedScore, setParsedScore] = useState<Score | null>(null);
  const [detectedKey, setDetectedKey] = useState<KeySignature>('C');
  const [selectedKey, setSelectedKey] = useState<KeySignature>('C');
  const [keyConfidence, setKeyConfidence] = useState<number>(100);
  const [transposeNotes, setTransposeNotes] = useState<boolean>(true);
  const [selectedTimeSignature, setSelectedTimeSignature] = useState<{ beats: number; beatType: number }>({
    beats: 4,
    beatType: 4,
  });
  const [selectedTempo, setSelectedTempo] = useState<number>(120);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunningOmr, setIsRunningOmr] = useState<boolean>(false);
  const [omrProgress, setOmrProgress] = useState<OmrProgress | null>(null);
  const [omrSummary, setOmrSummary] = useState<OmrResult | null>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);
    setOmrSummary(null);

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
        setIsRunningOmr(true);
        setOmrProgress({
          stage: 'loading-file',
          message: 'Preparando motor de reconocimiento óptico musical (OMR)...',
          percent: 5,
        });

        try {
          const omrResult = await recognizeScoreFromFile(file, (prog) => {
            setOmrProgress(prog);
          });
          score = omrResult.score;
          setOmrSummary(omrResult);
        } finally {
          setIsRunningOmr(false);
          setOmrProgress(null);
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
      setSelectedKey(keyResult.key);
      setKeyConfidence(keyResult.confidence);
      setSelectedTimeSignature(normalized.timeSignature);
      setSelectedTempo(normalized.tempo);
      toast.success(
        'Partitura leída',
        `"${normalized.title || file.name}" se ha cargado para revisión.`
      );
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error al procesar el archivo.';
      setErrorMessage(msg);
      setParsedScore(null);
      toast.error('Error de importación', msg);
    }
  };

  const handleTimeSignatureChange = (newBeats: number, newBeatType: number) => {
    const newTs = { beats: newBeats, beatType: newBeatType };
    setSelectedTimeSignature(newTs);
    if (!parsedScore) return;
    const updatedStaves = parsedScore.staves.map((st) => ({
      ...st,
      measures: reconcileMeasuresForTimeSignature(st.measures, newTs),
    }));
    setParsedScore({
      ...parsedScore,
      timeSignature: newTs,
      staves: updatedStaves,
    });
  };

  const handleTempoChange = (rawVal: number) => {
    const valid = Math.max(30, Math.min(300, rawVal || 120));
    setSelectedTempo(valid);
    if (parsedScore) {
      setParsedScore({ ...parsedScore, tempo: valid });
    }
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

  const handleConfirmImport = () => {
    if (!parsedScore) return;

    let finalScore = parsedScore;
    if (selectedKey !== parsedScore.keySignature) {
      if (transposeNotes) {
        const semitones = getSemitoneOffsetBetweenKeys(parsedScore.keySignature, selectedKey);
        finalScore = transposeScoreNotes(parsedScore, semitones, selectedKey);
      } else {
        finalScore = { ...parsedScore, keySignature: selectedKey };
      }
    }

    if (selectedTempo !== finalScore.tempo) {
      finalScore = { ...finalScore, tempo: selectedTempo };
    }

    onImportScore(finalScore);
    toast.success('Partitura importada', 'La partitura se ha cargado en el editor.');
    handleClose();
  };

  const handleReset = () => {
    setParsedScore(null);
    setErrorMessage(null);
    setIsRunningOmr(false);
    setOmrProgress(null);
    setOmrSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (isRunningOmr) return;
    handleReset();
    onClose();
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
      maxWidth="max-w-xl"
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
                Formatos compatibles: .pdf, .png, .jpg, .svg, .musicxml, .xml, .mid, .json (máx. 16 MB)
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-100/80 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50">
                <Layers className="w-3 h-3" />
                <span>Incluye lector OMR neuronal 100% offline para PDF e imágenes</span>
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
                        ? 'Fidelidad Nativa 100%'
                        : `OMR ONNX ${DOT_SEPARATOR} ${omrSummary.confidence}% precisión ${DOT_SEPARATOR} ${omrSummary.stavesDetected} pauta(s)`}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {parsedScore.staves[0]?.measures.length || 0} compases {DOT_SEPARATOR} {totalNotes}{' '}
                  notas {DOT_SEPARATOR} {parsedScore.timeSignature.beats}/
                  {parsedScore.timeSignature.beatType} {DOT_SEPARATOR} {QUARTER_NOTE_GLYPH} ={' '}
                  {parsedScore.tempo} BPM
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-studio-hover transition-colors cursor-pointer shrink-0"
              title="Cambiar archivo"
              aria-label="Cambiar archivo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

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
                onChange={setSelectedKey}
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
            {selectedKey !== detectedKey && (
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
                  {getSemitoneOffsetBetweenKeys(detectedKey, selectedKey)} semitonos)
                </label>
              </div>
            )}
          </div>

          {/* Bottom confirmation buttons */}
          <ModalFooter className="mt-4">
            <button type="button" onClick={handleReset} className={modalButton.secondary}>
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
