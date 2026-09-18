import React from 'react';
import { Award, Flame, RotateCcw, Sparkles, CheckCircle2, Target } from '../ui/icons';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader } from '../ui/ModalChrome';
import { modalButton } from '../ui/modalButton';

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

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(100, Math.max(0, accuracy)) / 100);

  const strokeColor = isMaster
    ? 'stroke-lime-500 text-lime-500'
    : isGood
      ? 'stroke-amber-500 text-amber-500'
      : 'stroke-rose-500 text-rose-500';

  const badges = [
    {
      id: 'target',
      label: 'Precisión',
      desc: '≥ 70% aciertos',
      active: isGood,
      icon: <Target className="w-4 h-4" />,
    },
    {
      id: 'streak',
      label: 'Racha',
      desc: '≥ 10 notas seguidas',
      active: streak >= 10,
      icon: <Flame className="w-4 h-4" />,
    },
    {
      id: 'master',
      label: 'Maestría',
      desc: '≥ 90% perfecto',
      active: isMaster,
      icon: <Award className="w-4 h-4" />,
    },
  ];

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Resultado de la práctica"
      maxWidth="max-w-md"
      clipPanel
    >
      <ModalHeader
        icon={<Award className="w-4 h-4" />}
        title="¡Sesión de Práctica Completada!"
        onClose={onClose}
        closeLabel="Cerrar resumen"
        className="mb-5"
      />

      {/* Circular SVG Gauge & Streak */}
      <div className="flex flex-col items-center justify-center py-2 relative z-content">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="stroke-slate-200 dark:stroke-studio-line"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              className={`${strokeColor} transition-all duration-700 ease-out`}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">
              {accuracy}%
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
              Precisión
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Flame className="w-4 h-4 text-amber-500" />
          <span>
            Racha máxima:{' '}
            <strong className="text-amber-600 dark:text-amber-400">{streak} notas</strong> seguidas
          </span>
        </div>
      </div>

      {/* Achievement Badges */}
      <div className="grid grid-cols-3 gap-2 my-4 relative z-content">
        {badges.map((b) => (
          <div
            key={b.id}
            aria-label={`Logro ${b.label}: ${b.active ? 'Conseguido' : 'Pendiente'}`}
            className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all ${
              b.active
                ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-400/50 text-amber-700 dark:text-amber-300 shadow-xs'
                : 'bg-slate-50 dark:bg-studio-surface border-slate-200 dark:border-studio-line text-slate-400 opacity-60'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg mb-1 ${b.active ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}
            >
              {b.icon}
            </div>
            <span className="text-[11px] font-bold block leading-tight">{b.label}</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">{b.desc}</span>
          </div>
        ))}
      </div>

      {/* Motivational Feedback */}
      <div className="bg-lime-500/10 dark:bg-pastel-lime/10 border border-lime-500/20 dark:border-pastel-lime/20 rounded-xl p-3.5 mb-5 flex items-start gap-3 relative z-content">
        {isMaster ? (
          <Sparkles className="w-5 h-5 text-lime-600 dark:text-pastel-lime shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-lime-600 dark:text-pastel-lime shrink-0 mt-0.5" />
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
      <div className="flex items-center gap-3 relative z-content">
        <button
          type="button"
          onClick={onRestart}
          aria-label="Repetir práctica"
          className={`flex-1 py-2.5 px-4 text-sm ${modalButton.primary}`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Volver a intentarlo</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`py-2.5 px-4 text-sm font-medium ${modalButton.secondary}`}
        >
          Cerrar
        </button>
      </div>
    </ModalBase>
  );
};
