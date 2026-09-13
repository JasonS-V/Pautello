import React, { useRef } from 'react';
import {
  X,
  UploadCloud,
  Music,
  Play,
  Pause,
  Square,
  Volume2,
  Gauge,
  Trash2,
  Headphones,
} from 'lucide-react';

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
      onLoadAudio(file);
    }
  };

  const speedOptions = [0.5, 0.75, 1.0, 1.25];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-fadeIn no-print"
    >
      <div className="bg-white dark:bg-[#181b25] text-slate-900 dark:text-slate-100 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#c4b5fd]/15 dark:bg-[#c4b5fd]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-5 relative z-10">
          <div className="flex items-center gap-2.5 font-bold text-base text-slate-800 dark:text-white">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-[#c4b5fd]">
              <Headphones className="w-5 h-5" />
            </div>
            <span>Pista de Acompañamiento (Play-Along)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {!isAudioLoaded ? (
          /* Empty / Upload State */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-purple-500/50 dark:hover:border-[#c4b5fd]/50 rounded-2xl p-8 flex flex-col items-center text-center cursor-pointer transition-colors group"
          >
            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-[#c4b5fd] group-hover:scale-110 transition-transform mb-3">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              Cargar audio de acompañamiento
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
              Sube una canción original o base musical (.mp3, .wav, .m4a) para ensayar sincronizado a tu propio ritmo.
            </p>
          </div>
        ) : (
          /* Active Track Control Deck */
          <div className="space-y-4 relative z-10">
            {/* Track Info Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-[#c4b5fd] shrink-0">
                  <Music className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                    {audioName}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {formatTime(currentTime)} / {formatTime(audioDuration)}
                  </div>
                </div>
              </div>
              <button
                onClick={onRemoveAudio}
                title="Quitar pista"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Scrubber Progress Slider */}
            <div>
              <input
                type="range"
                min={0}
                max={audioDuration || 1}
                step={0.1}
                value={currentTime}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                className="w-full accent-purple-600 dark:accent-[#c4b5fd] h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Transport Buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={isPlaying ? onPause : onPlay}
                className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#c4b5fd] dark:hover:bg-[#b3a1fc] text-white dark:text-slate-950 shadow-sm transition-all flex items-center gap-2 font-semibold text-xs"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
              </button>

              <button
                onClick={onStop}
                title="Detener audio"
                className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>

            {/* Speed Control (0.5x, 0.75x, 1x, 1.25x) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" />
                  Velocidad de Estudio
                </span>
                <span className="text-xs font-bold text-purple-600 dark:text-[#c4b5fd]">
                  {playbackRate}x
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {speedOptions.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => onSetPlaybackRate(rate)}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      playbackRate === rate
                        ? 'bg-purple-600 dark:bg-[#c4b5fd] text-white dark:text-slate-950 shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Backing Volume */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" />
                  Volumen del Acompañamiento
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => onSetVolume(parseFloat(e.target.value))}
                className="w-full accent-purple-600 dark:accent-[#c4b5fd] h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>Se sincroniza automáticamente con la partitura</span>
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-slate-300 hover:underline font-medium"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
