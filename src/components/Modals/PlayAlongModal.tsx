import React, { useRef } from 'react';
import {
  UploadCloud,
  Music,
  Play,
  Pause,
  Square,
  Volume2,
  Gauge,
  Trash2,
  Headphones,
} from '../ui/icons';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader, ModalFooter } from '../ui/ModalChrome';
import { modalButton } from '../ui/modalButton';
import { useToast } from '../ui/toastContext';

interface PlayAlongModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioName: string | null;
  audioDuration: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  volume: number;
  isAudioLoaded: boolean;
  onLoadAudio: (file: File) => void;
  onRemoveAudio: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onSetPlaybackRate: (rate: number) => void;
  onSetVolume: (vol: number) => void;
}

export const PlayAlongModal: React.FC<PlayAlongModalProps> = ({
  isOpen,
  onClose,
  audioName,
  audioDuration,
  currentTime,
  isPlaying,
  playbackRate,
  volume,
  isAudioLoaded,
  onLoadAudio,
  onRemoveAudio,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSetPlaybackRate,
  onSetVolume,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        toast.warning(
          'Formato no admitido',
          'Selecciona un archivo de audio válido (.mp3, .wav, .m4a).'
        );
        return;
      }
      try {
        onLoadAudio(file);
        toast.success('Pista cargada', `"${file.name}" cargada para acompañamiento.`);
      } catch (err) {
        console.error(err);
        toast.error('Error al cargar audio', 'No se pudo procesar el archivo de audio.');
      }
    }
  };

  const speedOptions = [0.5, 0.75, 1.0, 1.25];
  const progressPercent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  const handleSeekKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!audioDuration) return;
    const step = 2; // 2 seconds step
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onSeek(Math.min(audioDuration, currentTime + step));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onSeek(Math.max(0, currentTime - step));
    }
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Pista de acompañamiento Play-Along"
      maxWidth="max-w-md"
      clipPanel
    >
      <ModalHeader
        icon={<Headphones className="w-4 h-4" />}
        title="Pista de Acompañamiento"
        subtitle="Play-Along sincronizado con la partitura"
        onClose={onClose}
        closeLabel="Cerrar reproductor"
        className="mb-5"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Cargar archivo de audio"
      />

      {!isAudioLoaded ? (
        /* Empty / Upload State */
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className="border-2 border-dashed border-slate-300 dark:border-studio-line hover:border-studio-accent rounded-2xl p-8 flex flex-col items-center text-center cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group bg-slate-50 dark:bg-studio-elevated"
        >
          <div className="p-4 rounded-2xl bg-studio-accent/10 text-amber-700 dark:text-studio-accent group-hover:scale-110 transition-transform mb-3">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            Cargar audio de acompañamiento
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
            Sube una canción original o base musical (.mp3, .wav, .m4a) para ensayar sincronizado a
            tu propio ritmo.
          </p>
        </div>
      ) : (
        /* Active Track Control Deck */
        <div className="space-y-4 relative z-content">
          {/* Track Info Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-studio-elevated border border-slate-200 dark:border-studio-lineSoft rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-studio-accent/10 text-amber-700 dark:text-studio-accent shrink-0">
                <Music className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {audioName}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {formatTime(currentTime)} / {formatTime(audioDuration)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onRemoveAudio}
              aria-label="Quitar pista de acompañamiento"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 active:scale-90 hover:scale-110 transition-all shrink-0 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Accessible Scrubber Seekbar with Buffer and Thumb */}
          <div className="space-y-1.5">
            <div
              role="slider"
              tabIndex={0}
              aria-label="Posición de la pista"
              aria-valuemin={0}
              aria-valuemax={Math.round(audioDuration) || 1}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${formatTime(currentTime)} de ${formatTime(audioDuration)}`}
              onKeyDown={handleSeekKeyDown}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                onSeek(ratio * audioDuration);
              }}
              className="relative h-3 w-full bg-slate-200 dark:bg-studio-raised rounded-full overflow-hidden cursor-pointer flex items-center group focus:outline-none focus:ring-2 focus:ring-studio-accent/60"
            >
              {/* Progress fill */}
              <div
                className={`h-full transition-all duration-75 ${
                  isPlaying ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
              {/* Thumb */}
              <div
                className="absolute w-3.5 h-3.5 bg-white border-2 border-studio-accent rounded-full shadow-md group-hover:scale-125 transition-transform -translate-x-1/2 pointer-events-none"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(audioDuration)}</span>
            </div>
          </div>

          {/* Transport Buttons */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={isPlaying ? onPause : onPlay}
              aria-label={isPlaying ? 'Pausar reproducción' : 'Iniciar reproducción'}
              className="px-5 py-2.5 rounded-xl bg-studio-accent hover:bg-amber-600 dark:hover:bg-amber-400 text-slate-950 shadow-xs transition-all active:scale-95 flex items-center gap-2 font-semibold text-xs cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
            </button>

            <button
              type="button"
              onClick={onStop}
              aria-label="Detener reproducción"
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-studio-hover text-slate-600 dark:text-slate-300 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Control Pills */}
          <div className="pt-2 border-t border-slate-200 dark:border-studio-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" />
                Velocidad de Estudio
              </span>
              <span className="text-xs font-bold text-amber-700 dark:text-studio-accent">
                {playbackRate}x
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {speedOptions.map((rate) => (
                <button
                  type="button"
                  key={rate}
                  onClick={() => onSetPlaybackRate(rate)}
                  aria-pressed={playbackRate === rate}
                  aria-label={`Velocidad ${rate}x`}
                  className={`py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    playbackRate === rate
                      ? 'bg-studio-accent text-slate-950 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-studio-hover dark:hover:bg-studio-lineSoft text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Backing Volume */}
          <div className="pt-2 border-t border-slate-200 dark:border-studio-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                Volumen del Acompañamiento
              </span>
              <span className="text-xs font-mono text-slate-500">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onSetVolume(parseFloat(e.target.value))}
              aria-label="Volumen del acompañamiento"
              className="w-full accent-studio-accent h-1.5 bg-slate-200 dark:bg-studio-raised rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}

      <ModalFooter hint={<span>Sincronizado con el tempo de la partitura</span>}>
        <button type="button" onClick={onClose} className={modalButton.secondary}>
          Listo
        </button>
      </ModalFooter>
    </ModalBase>
  );
};
