import React, { useEffect } from 'react';
import { Mic, MicOff, X, Activity, Volume2, AlertCircle } from 'lucide-react';
import { useMicPitch } from '../../hooks/useMicPitch';
import { centsToStatus } from '../../utils/pitchDetection';
import { NamingConvention } from '../../types/music';
import { formatPitchName } from '../../constants/pitches';

interface TunerModalProps {
  isOpen: boolean;
  onClose: () => void;
  namingConvention: NamingConvention;
}

export const TunerModal: React.FC<TunerModalProps> = ({
  isOpen,
  onClose,
  namingConvention,
}) => {
  const {
    isListening,
    error,
    pitchResult,
    startListening,
    stopListening,
  } = useMicPitch();

  // Auto-start listening on open, stop on close
  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      stopListening();
    }
  }, [isOpen, startListening, stopListening]);

  if (!isOpen) return null;

  const cents = pitchResult ? pitchResult.cents : 0;
  const status = pitchResult ? centsToStatus(cents) : null;
  const noteName = pitchResult
    ? formatPitchName(pitchResult.pitch, namingConvention)
    : '--';

  // Needle position percentage from -50 to +50 mapped to 0% - 100%
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const needlePercent = ((clampedCents + 50) / 100) * 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-fadeIn no-print"
    >
      <div className="bg-white dark:bg-[#181b25] text-slate-900 dark:text-slate-100 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#bef264]/15 dark:bg-[#bef264]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-5 relative z-10">
          <div className="flex items-center gap-2.5 font-bold text-base text-slate-800 dark:text-white">
            <div className="p-2 rounded-xl bg-lime-500/10 text-lime-600 dark:text-[#bef264]">
              <Activity className="w-5 h-5" />
            </div>
            <span>Afinador Cromático en Vivo</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Center Note Display */}
        <div className="flex flex-col items-center justify-center py-4 relative z-10">
          <div className="relative flex flex-col items-center">
            {/* Note text */}
            <span
              className={`text-6xl font-black tracking-tight transition-all duration-150 ${
                status === 'in-tune'
                  ? 'text-lime-500 dark:text-[#bef264] scale-105 drop-shadow-[0_0_15px_rgba(190,242,100,0.3)]'
                  : status === 'flat'
                  ? 'text-amber-500 dark:text-[#fed7aa]'
                  : status === 'sharp'
                  ? 'text-rose-500'
                  : 'text-slate-300 dark:text-slate-600'
              }`}
            >
              {noteName}
            </span>

            {/* Frequency readout */}
            <div className="mt-2 flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
              <Volume2 className="w-3.5 h-3.5" />
              <span>{pitchResult ? `${pitchResult.frequency} Hz` : 'Esperando sonido...'}</span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="mt-3">
            {status === 'in-tune' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-lime-500/15 text-lime-600 dark:text-[#bef264] border border-lime-500/30 animate-pulse">
                ✓ ¡Perfectamente Afinado!
              </span>
            )}
            {status === 'flat' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-[#fed7aa] border border-amber-500/30">
                ↓ Bajo ({cents}¢) — Sube la afinación
              </span>
            )}
            {status === 'sharp' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                ↑ Alto (+{cents}¢) — Baja la afinación
              </span>
            )}
            {!status && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400">
                Canta o toca una nota en tu instrumento
              </span>
            )}
          </div>
        </div>

        {/* Visual Cents Gauge / Needle */}
        <div className="my-5 px-2 relative z-10">
          <div className="flex justify-between text-[11px] font-mono text-slate-400 dark:text-slate-500 mb-1.5">
            <span>-50¢</span>
            <span>-25¢</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">0¢</span>
            <span>+25¢</span>
            <span>+50¢</span>
          </div>

          {/* Scale Bar */}
          <div className="relative h-3 w-full bg-slate-100 dark:bg-slate-800/90 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700/80">
            {/* Center sweet spot */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-4 bg-lime-500/30 dark:bg-[#bef264]/30" />

            {/* Needle */}
            {pitchResult && (
              <div
                className={`absolute top-0 bottom-0 w-1.5 rounded-full transition-all duration-75 shadow-md ${
                  status === 'in-tune'
                    ? 'bg-lime-500 dark:bg-[#bef264]'
                    : status === 'flat'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{
                  left: `calc(${needlePercent}% - 3px)`,
                }}
              />
            )}
          </div>
        </div>

        {/* Microphone Toggle & Quality Note */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between relative z-10">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              isListening
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                : 'bg-slate-900 hover:bg-slate-800 dark:bg-[#bef264] dark:hover:bg-[#a8df4b] text-white dark:text-slate-950 shadow-sm'
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

          <span className="text-[11px] text-slate-400">
            100% en tiempo real sin latencia
          </span>
        </div>
      </div>
    </div>
  );
};
