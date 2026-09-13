import React, { useState } from 'react';
import { X, Heart, Coffee, Share2, Check, Sparkles } from 'lucide-react';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleShare = () => {
    navigator.clipboard.writeText(
      '¡Te comparto este editor de partituras gratuito y moderno para estudiantes de música y compositores! Pruébalo aquí: ' + window.location.href
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-fadeIn no-print"
    >
      <div className="bg-white dark:bg-[#181b25] text-slate-900 dark:text-slate-100 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2 font-bold text-base text-rose-600 dark:text-rose-400">
            <Heart className="w-5 h-5 fill-current" />
            <span>Proyecto Libre y Gratuito</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <strong className="text-slate-900 dark:text-white">Sonata</strong> nació con una misión clara:
            permitir que cualquier estudiante, profesor o músico en cualquier parte del mundo pueda escribir,
            escuchar y exportar partituras sin pagar costosas suscripciones ni lidiar con programas pesados.
          </p>

          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/40 rounded-lg p-3.5 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900 dark:text-rose-200 leading-normal">
              <strong>100% Gratuito y Sin Límites:</strong> Sin marcas de agua, sin anuncios molestos y con
              exportación libre a PDF, MIDI y MusicXML.
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
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copied ? '¡Enlace copiado al portapapeles!' : 'Compartir con amigos y conservatorios'}</span>
              </button>

              {/* Donation link button */}
              <a
                href="https://ko-fi.com"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Coffee className="w-4 h-4 text-amber-600" />
                <span>Invítame a un café (Donación voluntaria)</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
          >
            Cerrar y seguir componiendo
          </button>
        </div>
      </div>
    </div>
  );
};
