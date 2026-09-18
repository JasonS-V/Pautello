import React, { useEffect } from 'react';
import { Mic, MicOff, Activity, Volume2, AlertCircle } from '../ui/icons';
import { useMicPitch } from '../../hooks/useMicPitch';
import { centsToStatus } from '../../utils/pitchDetection';
import { NamingConvention } from '../../types/music';
import { formatPitchName } from '../../constants/pitches';
import { formatCents } from '../../utils/format';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader } from '../ui/ModalChrome';
import { useToast } from '../ui/toastContext';

interface TunerModalProps {
  isOpen: boolean;
  onClose: () => void;
  namingConvention: NamingConvention;
}

export const TunerModal: React.FC<TunerModalProps> = ({ isOpen, onClose, namingConvention }) => {
  const toast = useToast();
  const { isListening, error, pitchResult, startListening, stopListening } = useMicPitch();

  // Auto-start listening on open, stop on close
  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      stopListening();
    }
  }, [isOpen, startListening, stopListening]);

  useEffect(() => {
    if (error) {
      toast.error('Acceso al micrófono', error);
    }
  }, [error, toast]);

  if (!isOpen) return null;

  const cents = pitchResult ? pitchResult.cents : 0;
  const status = pitchResult ? centsToStatus(cents) : null;
  const fullPitchName = pitchResult ? formatPitchName(pitchResult.pitch, namingConvention) : '--';
  const octave = pitchResult?.pitch.octave ?? '';
  const noteName = pitchResult ? fullPitchName.replace(String(octave), '') : '--';

  // Needle angle: map -50 to +50 cents to -60 to +60 degrees
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const needleAngle = (clampedCents / 50) * 60;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Afinador cromático en vivo"
      maxWidth="max-w-md"
      clipPanel
    >
      <ModalHeader
        icon={<Activity className="w-4 h-4" />}
        title="Afinador Cromático en Vivo"
        onClose={onClose}
        closeLabel="Cerrar afinador"
        className="relative z-content"
      />

      {/* Error message banner */}
      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Chromatic Arc SVG Meter */}
      <div className="flex flex-col items-center justify-center pt-2 relative z-content">
        <div className="relative w-64 h-36 flex items-center justify-center">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 200 120">
            {/* Background track */}
            <path
              d="M 25 105 A 75 75 0 0 1 175 105"
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-studio-line"
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Flat zone (-50 to -10) */}
            <path
              d="M 25 105 A 75 75 0 0 1 65 42"
              fill="none"
              stroke="currentColor"
              className="text-rose-500/40"
              strokeWidth="8"
            />
            {/* Flat warning (-10 to -3) */}
            <path
              d="M 65 42 A 75 75 0 0 1 93 31"
              fill="none"
              stroke="currentColor"
              className="text-amber-500/60"
              strokeWidth="8"
            />
            {/* Sweet in-tune zone (-3 to +3) */}
            <path
              d="M 93 31 A 75 75 0 0 1 107 31"
              fill="none"
              stroke="currentColor"
              className="text-lime-500"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Sharp warning (+3 to +10) */}
            <path
              d="M 107 31 A 75 75 0 0 1 135 42"
              fill="none"
              stroke="currentColor"
              className="text-amber-500/60"
              strokeWidth="8"
            />
            {/* Sharp zone (+10 to +50) */}
            <path
              d="M 135 42 A 75 75 0 0 1 175 105"
              fill="none"
              stroke="currentColor"
              className="text-rose-500/40"
              strokeWidth="8"
            />

            {/* Center tick */}
            <line
              x1="100"
              y1="26"
              x2="100"
              y2="36"
              stroke="currentColor"
              className="text-lime-600 dark:text-lime-400"
              strokeWidth="2"
            />

            {/* Needle */}
            {pitchResult && (
              <g
                transform={`rotate(${needleAngle}, 100, 105)`}
                className="transition-transform duration-100 ease-out"
              >
                <line
                  x1="100"
                  y1="105"
                  x2="100"
                  y2="30"
                  stroke="currentColor"
                  className={
                    status === 'in-tune'
                      ? 'text-lime-500 drop-shadow-[0_0_8px_rgba(132,204,22,0.8)]'
                      : status === 'flat'
                        ? 'text-amber-500'
                        : 'text-rose-500'
                  }
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle
                  cx="100"
                  cy="105"
                  r="5"
                  fill="currentColor"
                  className="text-slate-800 dark:text-slate-200"
                />
              </g>
            )}
          </svg>

          {/* Cents readouts at arc sides */}
          <span className="absolute bottom-2 left-4 text-[10px] font-mono text-slate-400">
            -50¢
          </span>
          <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-lime-600 dark:text-lime-400">
            0¢
          </span>
          <span className="absolute bottom-2 right-4 text-[10px] font-mono text-slate-400">
            +50¢
          </span>
        </div>

        {/* Note Display in classical serif */}
        <div className="flex flex-col items-center mt-1">
          <div className="flex items-baseline justify-center">
            <span
              className={`text-5xl font-serif font-black tracking-tight transition-all duration-150 ${
                status === 'in-tune'
                  ? 'text-lime-500 dark:text-pastel-lime scale-105 drop-shadow-[0_0_15px_rgba(190,242,100,0.3)]'
                  : status === 'flat'
                    ? 'text-amber-500 dark:text-pastel-amber'
                    : status === 'sharp'
                      ? 'text-rose-500'
                      : 'text-slate-300 dark:text-slate-600'
              }`}
            >
              {noteName}
            </span>
            {octave !== '' && (
              <span className="text-xl font-serif font-bold text-slate-400 ml-1.5">{octave}</span>
            )}
          </div>

          {/* Cents readout */}
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                status === 'in-tune'
                  ? 'bg-lime-500/15 text-lime-700 dark:text-pastel-lime'
                  : status === 'flat'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-pastel-amber'
                    : status === 'sharp'
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                      : 'text-slate-400'
              }`}
            >
              {pitchResult ? formatCents(cents) : '--'}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <Volume2 className="w-3 h-3" />
              <span>
                {pitchResult ? `${pitchResult.frequency.toFixed(1)} Hz` : 'Esperando sonido...'}
              </span>
            </div>
          </div>

          {/* Status badge */}
          <div className="mt-3">
            {status === 'in-tune' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-lime-500/15 text-lime-600 dark:text-pastel-lime border border-lime-500/30 animate-pulse">
                Afinación exacta
              </span>
            )}
            {status === 'flat' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-pastel-amber border border-amber-500/30">
                Grave ({formatCents(cents)}) — Tensa o sube la afinación
              </span>
            )}
            {status === 'sharp' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                Agudo ({formatCents(cents)}) — Destensa o baja la afinación
              </span>
            )}
            {!status && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-studio-elevated text-slate-500">
                Canta o toca una nota en tu instrumento
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Microphone Toggle & Footer */}
      <div className="mt-5 pt-3 border-t border-slate-200 dark:border-studio-border flex items-center justify-between relative z-content">
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          aria-label={isListening ? 'Pausar micrófono' : 'Activar micrófono'}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
            isListening
              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              : 'bg-studio-accent hover:bg-amber-600 dark:hover:bg-amber-400 text-slate-950 shadow-xs'
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-4 h-4" />
              <span>Pausar Micrófono</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Activar Micrófono</span>
            </>
          )}
        </button>

        <span className="text-[11px] text-slate-400">Respuesta en tiempo real</span>
      </div>
    </ModalBase>
  );
};
