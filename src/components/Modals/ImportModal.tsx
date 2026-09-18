import React, { useState, useRef } from 'react';
import { Upload, CheckCircle2, Sparkles, AlertCircle, FileText, RotateCcw } from '../ui/icons';
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

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportScore: (score: Score) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImportScore }) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parsedScore, setParsedScore] = useState<Score | null>(null);
  const [detectedKey, setDetectedKey] = useState<KeySignature>('C');
  const [selectedKey, setSelectedKey] = useState<KeySignature>('C');
  const [keyConfidence, setKeyConfidence] = useState<number>(100);
  const [transposeNotes, setTransposeNotes] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPdfRejected, setIsPdfRejected] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);
    setIsPdfRejected(false);

    if (file.size > 8 * 1024 * 1024) {
      toast.warning('Archivo muy grande', 'El límite máximo para importar partituras es de 8 MB.');
      return;
    }

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'pdf') {
        setIsPdfRejected(true);
        setParsedScore(null);
        toast.info(
          'Archivo PDF detectado',
          'Los PDFs son representaciones gráficas. Requieren conversión OMR previa a MusicXML.'
        );
        return;
      }

      let score: Score;

      if (extension === 'json') {
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
          'Formato no soportado. Selecciona un archivo .musicxml, .xml, .mid o .json.'
        );
      }

      // El archivo es de origen desconocido: se valida y repara antes de usarlo.
      const normalized = normalizeScore(score);
      if (!normalized) {
        throw new Error('El archivo no contiene ninguna partitura que se pueda leer.');
      }

      // Run Key Detection analysis
      const keyResult = detectKeyFromScore(normalized);
      setParsedScore(normalized);
      setDetectedKey(keyResult.key);
      setSelectedKey(keyResult.key);
      setKeyConfidence(keyResult.confidence);
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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
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

    onImportScore(finalScore);
    toast.success('Partitura importada', 'La partitura se ha cargado en el editor.');
    handleClose();
  };

  const handleReset = () => {
    setParsedScore(null);
    setErrorMessage(null);
    setIsPdfRejected(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cerrar (botón X, Escape o cualquier vía del ModalBase) también limpia el estado.
  const handleClose = () => {
    handleReset();
    onClose();
  };

  const detectedKeyName = KEY_SIGNATURE_DATA[detectedKey]?.name || detectedKey;
  const totalNotes = parsedScore
    ? parsedScore.staves[0]?.measures.reduce(
        (acc, m) => acc + m.items.filter((it) => it.type === 'note').length,
        0
      ) || 0
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
        subtitle="MusicXML, MIDI estándar y proyectos Pautello"
        onClose={handleClose}
        closeLabel="Cerrar importador"
        className="mb-5"
      />

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".musicxml,.xml,.mid,.midi,.json,.pdf"
        className="hidden"
        aria-label="Seleccionar archivo a importar"
      />

      {/* State 1: Dropzone (when no file is loaded yet) */}
      {!parsedScore ? (
        <div className="space-y-4">
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
              Arrastra tu archivo aquí o haz clic para explorar
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Formatos compatibles: .musicxml, .xml, .mid, .midi, .json (máx. 8 MB)
            </p>
          </div>

          {/* Dedicated PDF Educational Guidance Banner */}
          {isPdfRejected && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col gap-2.5 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>¿Por qué no se puede importar un PDF directamente?</span>
              </div>
              <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-[11px]">
                Un archivo <strong>PDF</strong> es un documento visual de dibujo o escaneo gráfico;
                no contiene la información musical codificada (notas, compases, tiempos ni claves).
                Para abrir tu partitura en Pautello necesitas un formato estructurado como{' '}
                <strong>MusicXML (.musicxml)</strong> o <strong>MIDI (.mid)</strong>.
              </p>

              <div className="bg-white dark:bg-studio-card p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/40 flex flex-col gap-1.5">
                <span className="font-bold text-[11px] text-amber-900 dark:text-amber-300">
                  Cómo convertir tu PDF en 3 pasos sencillos:
                </span>
                <ol className="list-decimal list-inside text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                  <li>
                    Visita una herramienta de reconocimiento musical gratuita como{' '}
                    <a
                      href="https://musescore.org"
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800"
                    >
                      MuseScore (Herramienta OMR)
                    </a>{' '}
                    o audiveris.
                  </li>
                  <li>Sube tu PDF para que el conversor reconozca las notas y silencios.</li>
                  <li>Exporta el resultado como archivo MusicXML y arrástralo a esta ventana.</li>
                </ol>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsPdfRejected(false)}
                  className="px-3 py-1 bg-amber-200 dark:bg-amber-900/80 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-100 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                >
                  Entendido
                </button>
              </div>
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
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  {parsedScore.title || 'Partitura Sin Título'}
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {parsedScore.staves[0]?.measures.length || 0} compases • {totalNotes} notas •{' '}
                  {parsedScore.timeSignature.beats}/{parsedScore.timeSignature.beatType} • ♩ ={' '}
                  {parsedScore.tempo} BPM
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-studio-hover transition-colors cursor-pointer"
              title="Cambiar archivo"
              aria-label="Cambiar archivo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
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
