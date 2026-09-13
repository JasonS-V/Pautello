import React from 'react';
import { Award, Flame, RotateCcw, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface PracticeResultModalProps {
  isOpen: boolean;
  accuracy: number;
  streak: number;
  onRestart: () => void;
  onClose: () => void;
}

export const PracticeResultModal: React.FC<PracticeResultModalProps> = ({
  isOpen,
  accuracy,
  streak,
  onRestart,
  onClose,
}) => {
  if (!isOpen) return null;

  const isMaster = accuracy >= 90;
  const isGood = accuracy >= 70;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-fadeIn no-print"
    >
      <div className="bg-white dark:bg-[#181b25] text-slate-900 dark:text-slate-100 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Decorative Top Accent Glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#bef264]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[#c4b5fd]/20 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-5 relative z-10">
          <div className="flex items-center gap-2.5 font-bold text-base text-slate-800 dark:text-white">
            <div className="p-2 rounded-xl bg-lime-500/10 text-lime-600 dark:text-[#bef264]">
              <Award className="w-5 h-5" />
            </div>
            <span>¡Partitura Completada!</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scorecard Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5 relative z-10">
          {/* Accuracy Card */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col items-center text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Precisión
            </span>
            <div className="text-3xl font-extrabold text-lime-600 dark:text-[#bef264] flex items-center gap-1">
              {accuracy}%
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5">
              {isMaster ? 'Excelente' : isGood ? 'Muy bien' : 'A mejorar'}
            </span>
          </div>

          {/* Streak Card */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col items-center text-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Racha Máx.
            </span>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-[#fed7aa] flex items-center gap-1">
              {streak}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5">notas seguidas</span>
          </div>
        </div>

        {/* Motivational Feedback */}
        <div className="bg-lime-500/10 dark:bg-[#bef264]/10 border border-lime-500/20 dark:border-[#bef264]/20 rounded-xl p-3.5 mb-6 flex items-start gap-3 relative z-10">
          {isMaster ? (
            <Sparkles className="w-5 h-5 text-lime-600 dark:text-[#bef264] shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-lime-600 dark:text-[#bef264] shrink-0 mt-0.5" />
          )}
          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
            {isMaster
              ? '¡Impresionante maestría musical! Has acertado prácticamente todas las notas a la primera.'
              : isGood
              ? '¡Muy buen ensayo! Tu oído y lectura de notas están progresando sólidamente.'
              : '¡Buen intento! Cada repetición fortalece tu memoria motriz y lectura a primera vista.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={onRestart}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#bef264] dark:hover:bg-[#a8df4b] text-white dark:text-slate-950 font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Repetir Práctica</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
