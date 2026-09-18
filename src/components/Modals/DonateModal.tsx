import React, { useState } from 'react';
import { Heart, Coffee, Share2, Check, Sparkles } from '../ui/icons';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader, ModalFooter } from '../ui/ModalChrome';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleShare = () => {
    navigator.clipboard.writeText(
      '¡Te comparto este editor de partituras gratuito y moderno para estudiantes de música y compositores! Pruébalo aquí: ' +
        window.location.href
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Apoyar el proyecto Pautello"
      maxWidth="max-w-md"
    >
      <ModalHeader
        icon={<Heart className="w-4 h-4" />}
        title="Proyecto Libre y Gratuito"
        subtitle="Apoya el desarrollo de Pautello"
        onClose={onClose}
      />

      <div className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <strong className="text-slate-900 dark:text-white">Pautello</strong> nació con una misión
          clara: permitir que cualquier estudiante, profesor o músico en cualquier parte del mundo
          pueda escribir, escuchar y exportar partituras sin pagar costosas suscripciones ni lidiar
          con programas pesados.
        </p>

        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/40 rounded-lg p-3.5 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900 dark:text-rose-200 leading-normal">
            <strong>100% Gratuito y Sin Límites:</strong> Sin marcas de agua, sin anuncios molestos
            y con exportación libre a PDF, MIDI y MusicXML.
          </div>
        </div>

        <div className="pt-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            ¿Cómo puedes apoyar el proyecto?
          </h4>

          {/* Share action */}
          <div className="space-y-2">
            <button
              onClick={handleShare}
              className="w-full py-2.5 px-4 rounded-lg bg-studio-accent hover:bg-amber-600 dark:hover:bg-amber-400 active:scale-[0.98] text-slate-950 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              <span>
                {copied
                  ? '¡Enlace copiado al portapapeles!'
                  : 'Compartir con amigos y conservatorios'}
              </span>
            </button>

            {/* Donation link button */}
            <a
              href="https://ko-fi.com/aizendev"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-lg border border-slate-200 dark:border-studio-line hover:bg-slate-50 dark:hover:bg-studio-hover active:scale-[0.98] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <Coffee className="w-4 h-4 text-amber-600" />
              <span>Invítame a un café en Ko-fi (Donación voluntaria)</span>
            </a>
          </div>
        </div>
      </div>

      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-studio-hover transition-colors active:scale-95 cursor-pointer"
        >
          Cerrar y seguir componiendo
        </button>
      </ModalFooter>
    </ModalBase>
  );
};
