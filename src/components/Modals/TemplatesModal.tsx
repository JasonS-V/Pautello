import React from 'react';
import { X, FolderOpen, Play, Music } from 'lucide-react';
import { TEMPLATES, ScoreTemplate } from '../../constants/templates';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadTemplate: (template: ScoreTemplate) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onLoadTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none animate-fadeIn no-print"
    >
      <div className="bg-white dark:bg-[#161922] text-slate-900 dark:text-slate-100 rounded-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-[#232836] shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#232836] mb-4">
          <div className="flex items-center gap-2 font-bold text-base">
            <FolderOpen className="w-5 h-5 text-[#f59e0b]" />
            <span>Obras y Plantillas de Estudio</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Selecciona una pieza clásica o ejercicio para cargarla inmediatamente en el editor y escucharla o modificarla:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => {
                onLoadTemplate(tmpl);
                onClose();
              }}
              className="bg-slate-50 hover:bg-slate-100 dark:bg-[#1a1e2b] dark:hover:bg-[#202536] border border-slate-200 dark:border-[#282d40] rounded-xl p-3.5 cursor-pointer transition-all duration-150 flex flex-col justify-between group shadow-xs hover:border-[#f59e0b]"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-[#f59e0b] transition-colors">
                    {tmpl.name}
                  </span>
                  <Music className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#f59e0b] transition-colors" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {tmpl.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-[#282d40] flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-mono">
                  {tmpl.score.timeSignature.beats}/{tmpl.score.timeSignature.beatType} • ♩={tmpl.score.tempo}
                </span>
                <span className="font-bold text-[#f59e0b] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <Play className="w-2.5 h-2.5 fill-current" /> Cargar
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-200 dark:border-[#232836] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1f2330] dark:hover:bg-[#282d40] text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
