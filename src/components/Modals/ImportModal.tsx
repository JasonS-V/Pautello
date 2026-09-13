import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileCode,
  Music,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { Score, KeySignature } from '../../types/music';
import { importMusicXmlToScore } from '../../utils/musicxml';
import { parseMidiToScore } from '../../utils/midiParser';
import { detectKeyFromScore, transposeScoreNotes, getSemitoneOffsetBetweenKeys, ALL_KEYS } from '../../utils/keyDetection';
import { KEY_SIGNATURE_DATA } from '../../constants/pitches';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportScore: (score: Score) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportScore,
}) => {
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
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'pdf') {
        setIsPdfRejected(true);
        setParsedScore(null);
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
        throw new Error('Formato no soportado. Selecciona un archivo .musicxml, .xml, .mid o .json.');
      }

      // Run Key Detection analysis
      const keyResult = detectKeyFromScore(score);
      setParsedScore(score);
      setDetectedKey(keyResult.key);
      setSelectedKey(keyResult.key);
      setKeyConfidence(keyResult.confidence);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error al procesar el archivo.';
      setErrorMessage(msg);
      setParsedScore(null);
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
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setParsedScore(null);
    setErrorMessage(null);
    setIsPdfRejected(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const detectedKeyName = KEY_SIGNATURE_DATA[detectedKey]?.name || detectedKey;
  const totalNotes = parsedScore
    ? parsedScore.staves[0]?.measures.reduce(
        (acc, m) => acc + m.items.filter((it) => it.type === 'note').length,
        0
      ) || 0
    : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none animate-fadeIn no-print"
    >
      <div className="bg-white dark:bg-[#161922] text-slate-900 dark:text-slate-100 rounded-3xl max-w-xl w-full p-6 border border-slate-200 dark:border-[#232836] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#232836] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base block leading-none">
                Importar Partitura
              </h3>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                MusicXML, MIDI estándar y proyectos Sonata
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".musicxml,.xml,.mid,.midi,.json,.pdf"
          className="hidden"
        />

        {/* State 1: Dropzone (when no file is loaded yet) */}
        {!parsedScore ? (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                  : 'border-slate-300 dark:border-[#2a3042] hover:border-blue-400 bg-slate-50 dark:bg-[#1a1e2b]'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-inner">
                <Upload className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                Arrastra tu archivo aquí o haz clic para explorar
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Formatos compatibles: .musicxml, .xml, .mid, .midi, .json
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
                  Un archivo <strong>PDF</strong> es un documento visual de dibujo o escaneo gráfico; no contiene la información musical codificada (notas, compases, tiempos ni claves).
                </p>
                <div className="bg-white/80 dark:bg-[#161a24] p-3 rounded-xl border border-amber-200/70 dark:border-amber-800/40 text-[11px] space-y-1.5">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Cómo convertirlo gratis para usarlo aquí:</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 space-y-1">
                    <p>• <strong>Opción 1:</strong> Abre o escanea el PDF en <strong>MuseScore</strong> (software gratuito) y expórtalo como <strong>MusicXML (.musicxml)</strong>.</p>
                    <p>• <strong>Opción 2:</strong> Usa herramientas online gratuitas de conversión OMR como <strong>Soundslice</strong> o <strong>Audiveris</strong>.</p>
                    <p>• <strong>Opción 3:</strong> Busca la versión <strong>.musicxml</strong> o <strong>.mid</strong> en <strong>IMSLP</strong> o <strong>MuseScore.com</strong> y arrástrala directamente aquí.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Format explanation pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <div className="bg-slate-100 dark:bg-[#1f2433] p-3 rounded-xl border border-slate-200 dark:border-[#282d40]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                  <FileCode className="w-3.5 h-3.5" />
                  <span>MusicXML</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                  Archivos exportados desde MuseScore, Sibelius, Finale o Dorico.
                </p>
              </div>

              <div className="bg-slate-100 dark:bg-[#1f2433] p-3 rounded-xl border border-slate-200 dark:border-[#282d40]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
                  <Music className="w-3.5 h-3.5" />
                  <span>MIDI (.mid)</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                  Secuencias musicales de DAWs (FL Studio, Ableton, Logic, Reaper).
                </p>
              </div>

              <div className="bg-slate-100 dark:bg-[#1f2433] p-3 rounded-xl border border-slate-200 dark:border-[#282d40]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Sonata (.json)</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                  Partituras nativas guardadas previamente con toda su estructura.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* State 2: Preview, Key Detection & Transposition Options */
          <div className="space-y-4">
            {/* Score summary card */}
            <div className="bg-slate-50 dark:bg-[#1a1e2b] p-4 rounded-2xl border border-slate-200 dark:border-[#282d40]">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                    {parsedScore.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Por {parsedScore.composer} • {parsedScore.staves[0]?.measures.length || 0} compases • {totalNotes} notas
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 font-semibold"
                  title="Cargar otro archivo"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Cambiar</span>
                </button>
              </div>

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-[#282d40] text-xs">
                <span className="bg-slate-200 dark:bg-[#252b3d] px-2.5 py-1 rounded-lg font-mono font-bold">
                  Métrica: {parsedScore.timeSignature.beats}/{parsedScore.timeSignature.beatType}
                </span>
                <span className="bg-slate-200 dark:bg-[#252b3d] px-2.5 py-1 rounded-lg font-mono font-bold">
                  ♩ = {parsedScore.tempo} BPM
                </span>
              </div>
            </div>

            {/* Smart Key Detection Card (Krumhansl-Schmuckler) */}
            <div className="bg-[#fed7aa]/20 dark:bg-[#f59e0b]/10 border border-[#fed7aa] dark:border-[#f59e0b]/30 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-950 dark:text-amber-300 uppercase tracking-wider">
                    Detección Inteligente de Tonalidad
                  </span>
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
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tonalidad deseada al abrir:
                </label>
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value as KeySignature)}
                  className="bg-white dark:bg-[#111319] border border-slate-300 dark:border-[#2e3547] text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3 py-1.5 outline-none focus:border-[#f59e0b]"
                >
                  {ALL_KEYS.map((k) => {
                    const data = KEY_SIGNATURE_DATA[k.key];
                    return (
                      <option key={k.key} value={k.key}>
                        {data?.name || k.key} {k.key === detectedKey ? '(Detectada)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Transpose checkbox */}
              {selectedKey !== detectedKey && (
                <div className="mt-3 pt-2.5 border-t border-amber-200/60 dark:border-amber-900/30 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="transpose-check"
                    checked={transposeNotes}
                    onChange={(e) => setTransposeNotes(e.target.checked)}
                    className="w-4 h-4 accent-[#f59e0b] rounded cursor-pointer"
                  />
                  <label htmlFor="transpose-check" className="text-xs text-slate-800 dark:text-slate-200 cursor-pointer font-medium">
                    Transponer automáticamente las notas a la nueva tonalidad ({getSemitoneOffsetBetweenKeys(detectedKey, selectedKey)} semitonos)
                  </label>
                </div>
              )}
            </div>

            {/* Bottom confirmation buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-[#232836]">
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
              >
                Elegir otro archivo
              </button>

              <button
                onClick={handleConfirmImport}
                className="px-5 py-2.5 bg-[#bef264] hover:bg-[#a3e635] text-lime-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Cargar en el Editor</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
