import React from 'react';
import { FolderOpen, Play, Music } from '../ui/icons';
import { TEMPLATES, ScoreTemplate } from '../../constants/templates';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader, ModalFooter } from '../ui/ModalChrome';
import { modalButton } from '../ui/modalButton';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadTemplate: (template: ScoreTemplate) => void;
}

const StaffPreview: React.FC<{ stavesCount: number }> = ({ stavesCount }) => {
  const staffLines = [8, 14, 20, 26, 32];
  return (
    <svg
      className="w-full h-9 text-slate-300 dark:text-studio-line my-1.5 overflow-visible"
      viewBox="0 0 120 40"
      fill="none"
      aria-hidden="true"
    >
      {staffLines.map((y) => (
        <line
          key={y}
          x1="4"
          y1={y}
          x2="116"
          y2={y}
          stroke="currentColor"
          strokeWidth="0.8"
          opacity="0.8"
        />
      ))}
      {/* Treble clef glyph simplified */}
      <path
        d="M 12 34 C 9 26 16 16 12 8 C 9 4 7 7 8 13 C 10 18 5 24 8 30 C 9 33 13 33 13 29"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Sample notes */}
      <ellipse cx="38" cy="26" rx="2.5" ry="2" fill="currentColor" />
      <line x1="40.5" y1="26" x2="40.5" y2="12" stroke="currentColor" strokeWidth="0.9" />
      <ellipse cx="58" cy="20" rx="2.5" ry="2" fill="currentColor" />
      <line x1="60.5" y1="20" x2="60.5" y2="7" stroke="currentColor" strokeWidth="0.9" />
      <ellipse cx="78" cy="14" rx="2.5" ry="2" fill="currentColor" />
      <line x1="80.5" y1="14" x2="80.5" y2="3" stroke="currentColor" strokeWidth="0.9" />
      <ellipse cx="98" cy="20" rx="2.5" ry="2" fill="currentColor" />
      <line x1="100.5" y1="20" x2="100.5" y2="7" stroke="currentColor" strokeWidth="0.9" />
      {stavesCount > 1 && (
        <line x1="4" y1="4" x2="4" y2="36" stroke="currentColor" strokeWidth="1.5" />
      )}
    </svg>
  );
};

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onLoadTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Obras y plantillas de estudio"
      maxWidth="max-w-2xl"
    >
      <ModalHeader
        icon={<FolderOpen className="w-4 h-4" />}
        title="Obras y Plantillas de Estudio"
        onClose={onClose}
        closeLabel="Cerrar catálogo de plantillas"
      />

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Selecciona una pieza clásica o ejercicio para cargarla inmediatamente en el editor y
        escucharla o modificarla:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {TEMPLATES.map((tmpl) => (
          <button
            type="button"
            key={tmpl.id}
            onClick={() => {
              onLoadTemplate(tmpl);
              onClose();
            }}
            aria-label={`Cargar plantilla ${tmpl.name}`}
            className="bg-slate-50 hover:bg-slate-100 dark:bg-studio-elevated dark:hover:bg-studio-hover border border-slate-200 dark:border-studio-lineSoft rounded-xl p-3.5 cursor-pointer transition-all duration-150 flex flex-col justify-between group shadow-xs hover:border-studio-accent hover:-translate-y-0.5 active:scale-[0.98] text-left"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-studio-accent transition-colors">
                  {tmpl.name}
                </span>
                <Music className="w-3.5 h-3.5 text-slate-400 group-hover:text-studio-accent transition-colors shrink-0" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {tmpl.description}
              </p>
              <StaffPreview stavesCount={tmpl.score.staves.length} />
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-studio-lineSoft flex items-center justify-between text-[10px] text-slate-400">
              <span className="font-mono">
                {tmpl.score.timeSignature.beats}/{tmpl.score.timeSignature.beatType} • ♩=
                {tmpl.score.tempo}
              </span>
              <span className="font-bold text-studio-accent flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <Play className="w-2.5 h-2.5 fill-current" /> Cargar
              </span>
            </div>
          </button>
        ))}
      </div>

      <ModalFooter>
        <button type="button" onClick={onClose} className={modalButton.secondary}>
          Cerrar
        </button>
      </ModalFooter>
    </ModalBase>
  );
};
