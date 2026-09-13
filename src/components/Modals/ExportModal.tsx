import React, { useRef } from 'react';
import { X, Printer, FileCode, Music, Download, Upload } from 'lucide-react';
import { Score } from '../../types/music';
import { exportScoreToMusicXml, importMusicXmlToScore } from '../../utils/musicxml';
import { exportScoreToMidi } from '../../audio/midiExport';

interface ExportModalProps {
  score: Score;
  isOpen: boolean;
  onClose: () => void;
  onImportScore: (score: Score) => void;
  onOpenImport?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  score,
  isOpen,
  onClose,
  onImportScore,
  onOpenImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportMusicXml = () => {
    const xml = exportScoreToMusicXml(score);
    const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' });
    downloadBlob(blob, `${slugify(score.title)}.musicxml`);
  };

  const handleExportMidi = () => {
    const blob = exportScoreToMidi(score);
    downloadBlob(blob, `${slugify(score.title)}.mid`);
  };

  const handleExportJson = () => {
    const json = JSON.stringify(score, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, `${slugify(score.title)}.json`);
  };

  const handlePrint = () => {
    onClose();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content) as Score;
          onImportScore(parsed);
          onClose();
        } else if (file.name.endsWith('.xml') || file.name.endsWith('.musicxml')) {
          const parsed = importMusicXmlToScore(content);
          onImportScore(parsed);
          onClose();
        } else {
          alert('Por favor selecciona un archivo .json, .xml o .musicxml válido.');
        }
      } catch (err) {
        alert('Error al importar el archivo: formato no reconocido.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  function slugify(text: string): string {
    return (text || 'partitura')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-fadeIn no-print"
    >
      <div className="bg-white dark:bg-[#181b25] text-slate-900 dark:text-slate-100 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-2 font-bold text-base">
            <Download className="w-5 h-5 text-blue-600" />
            <span>Exportar e Importar Partitura</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Printable Sheet Music / PDF */}
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50 dark:bg-[#1f2432] transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm group-hover:text-blue-600 transition-colors">
                  Imprimir / Guardar en PDF
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Genera una copia en alta definición lista para atril y papel A4/Carta
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-1 rounded">
              PDF
            </span>
          </button>

          {/* MusicXML Export */}
          <button
            onClick={handleExportMusicXml}
            className="w-full flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-[#1f2432] transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm group-hover:text-emerald-600 transition-colors">
                  MusicXML (.musicxml)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Compatible universal con MuseScore, Sibelius, Finale, Dorico y Flat.io
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded">
              .musicxml
            </span>
          </button>

          {/* MIDI Export */}
          <button
            onClick={handleExportMidi}
            className="w-full flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 bg-slate-50 dark:bg-[#1f2432] transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm group-hover:text-amber-600 transition-colors">
                  Archivo MIDI Estándar (.mid)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Ideal para sintetizadores, DAWs (FL Studio, Ableton, Logic, Reaper)
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded">
              .mid
            </span>
          </button>

          {/* JSON Export */}
          <button
            onClick={handleExportJson}
            className="w-full flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 bg-slate-50 dark:bg-[#1f2432] transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm group-hover:text-purple-600 transition-colors">
                  Copia de Seguridad (.json)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Guarda toda la estructura exacta para editarla más tarde
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-purple-600 bg-purple-50 dark:bg-purple-950/60 px-2 py-1 rounded">
              .json
            </span>
          </button>
        </div>

        {/* Import section */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".musicxml,.xml,.json"
            className="hidden"
          />
          <button
            onClick={() => {
              if (onOpenImport) {
                onClose();
                onOpenImport();
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 text-slate-700 dark:text-slate-300 hover:text-blue-600 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Abrir e Importar Partitura (.musicxml, .mid, .json)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
