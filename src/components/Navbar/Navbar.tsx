import React from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  Volume2,
  VolumeX,
  Edit2,
  Clock,
  Menu,
  Target,
  FolderOpen,
  Wrench,
  Minus,
  Plus,
  Cable,
  Flame,
} from '../ui/icons';
import { Score } from '../../types/music';
import { Dropdown, DropdownItem } from '../ui/Dropdown';

interface NavbarProps {
  score: Score;
  onUpdateTitle: (title: string) => void;
  onUpdateComposer: (composer: string) => void;
  onUpdateTempo: (tempo: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  metronomeEnabled: boolean;
  onToggleMetronome: () => void;
  volume: number;
  onSetVolume: (vol: number) => void;
  onToggleMute: () => void;
  onOpenMobileMenu?: () => void;
  isMidiConnected?: boolean;
  connectedDevices?: string[];
  isPracticeMode?: boolean;
  practiceAccuracy?: number;
  practiceStreak?: number;
  onTogglePractice?: () => void;
  fileItems: DropdownItem[];
  toolsItems: DropdownItem[];
  activeVoice?: 1 | 2;
  onSelectVoice?: (voice: 1 | 2) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  score,
  onUpdateTitle,
  onUpdateComposer,
  onUpdateTempo,
  isPlaying,
  onTogglePlay,
  onStop,
  isLooping,
  onToggleLoop,
  metronomeEnabled,
  onToggleMetronome,
  volume,
  onSetVolume,
  onToggleMute,
  onOpenMobileMenu,
  isMidiConnected,
  connectedDevices,
  isPracticeMode,
  practiceAccuracy = 100,
  practiceStreak = 0,
  onTogglePractice,
  fileItems,
  toolsItems,
  activeVoice = 1,
  onSelectVoice,
}) => {
  return (
    <header className="select-none bg-transparent relative z-header">
      {/* Row 1 — Document identity + file/tool menus: fixed height, never wraps */}
      <div className="flex h-12 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          {onOpenMobileMenu && (
            <button
              onClick={onOpenMobileMenu}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-studio-hover transition-all duration-150 hover:scale-105 active:scale-90 shrink-0"
              title="Abrir menú"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex flex-col min-w-0">
            <div className="group flex items-center gap-1.5 min-w-0">
              <input
                type="text"
                value={score.title}
                onChange={(e) => onUpdateTitle(e.target.value)}
                className="text-base sm:text-xl font-black text-slate-900 dark:text-white bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-studio-elevated px-2 py-0.5 rounded-lg outline-none transition-colors border border-transparent focus:border-studio-accent tracking-tight truncate w-full max-w-[320px] min-w-0"
                placeholder="Título de la Obra"
                title="Renombrar la partitura"
                aria-label="Título de la obra"
              />
              <Edit2 className="w-3 h-3 shrink-0 text-slate-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1.5 px-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 overflow-hidden whitespace-nowrap">
              <input
                type="text"
                value={score.composer}
                onChange={(e) => onUpdateComposer(e.target.value)}
                className="bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-studio-elevated px-1 rounded outline-none transition-colors border border-transparent focus:border-studio-accent max-w-[200px] min-w-0 font-serif italic text-xs text-slate-600 dark:text-slate-300"
                placeholder="Compositor"
                title="Cambiar el compositor"
                aria-label="Compositor de la obra"
              />
              {isMidiConnected && (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-300 dark:border-emerald-800 truncate max-w-[160px]"
                  title={`Dispositivo MIDI conectado: ${connectedDevices?.[0] || 'MIDI'}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <Cable className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{connectedDevices?.[0] || 'MIDI'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Archivo / Herramientas: labels collapse to icon-only when the row is narrow */}
        <div id="navbar-menus" className="flex items-center gap-2 shrink-0">
          <Dropdown
            label="Archivo"
            labelClassName="hidden sm:inline"
            icon={<FolderOpen className="w-3.5 h-3.5" />}
            items={fileItems}
            sectionLabel="Partitura"
          />
          <Dropdown
            label="Herramientas"
            labelClassName="hidden sm:inline"
            icon={<Wrench className="w-3.5 h-3.5" />}
            items={toolsItems}
            sectionLabel="Práctica y audio"
          />
        </div>
      </div>

      {/* Row 2 — Transport & audio: fixed height. The transport deck and voice selector
          scroll horizontally when narrow; volume stays pinned on the right. */}
      <div className="flex h-11 items-center gap-2 px-3 sm:px-6 min-w-0">
        <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar flex items-center gap-2 py-0.5 pr-2">
          {/* Transport deck */}
          <div
            id="navbar-transport"
            className="inline-flex items-center gap-1 bg-white dark:bg-studio-card p-1 rounded-xl border border-slate-200 dark:border-studio-border shadow-xs shrink-0"
          >
            <button
              onClick={onTogglePlay}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl font-bold text-xs transition-all duration-150 shadow-sm active:scale-95 shrink-0 ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20 shadow-md ring-2 ring-amber-500/40'
                  : 'bg-pastel-amber hover:bg-amber-300 text-amber-950 hover:shadow-xs'
              }`}
              title="Espacio: Reproducir / Pausar"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current animate-pulse" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span className="hidden md:inline">{isPlaying ? 'Pausar' : 'Reproducir'}</span>
            </button>

            <button
              onClick={onStop}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover transition-all duration-150 hover:scale-105 active:scale-90 shrink-0"
              title="Detener"
              aria-label="Detener reproducción"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              onClick={onToggleLoop}
              className={`p-2 rounded-xl transition-all duration-150 hover:scale-105 active:scale-90 shrink-0 ${
                isLooping
                  ? 'bg-purple-100 dark:bg-pastel-purple/30 text-purple-700 dark:text-violet-400 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover'
              }`}
              title="Repetir en bucle continuo"
              aria-label="Repetir en bucle continuo"
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onToggleMetronome}
              className={`p-2 rounded-xl transition-all duration-150 hover:scale-105 active:scale-90 shrink-0 ${
                metronomeEnabled
                  ? 'bg-lime-200 dark:bg-pastel-lime text-lime-900 dark:text-lime-950 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover'
              }`}
              title="Metrónomo auditivo"
              aria-label="Metrónomo auditivo"
            >
              <Clock
                className={`w-3.5 h-3.5 origin-top ${metronomeEnabled ? 'animate-pendulum text-lime-800' : ''}`}
              />
            </button>

            {onTogglePractice && (
              <button
                onClick={onTogglePractice}
                className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 font-bold transition-all duration-150 hover:scale-105 active:scale-95 shrink-0 ${
                  isPracticeMode
                    ? 'bg-pastel-lime text-lime-950 shadow-xs ring-1 ring-lime-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-studio-hover'
                }`}
                title="Modo Práctica: la partitura espera a que toques cada nota"
                aria-pressed={isPracticeMode}
              >
                <Target
                  className={`w-3.5 h-3.5 ${isPracticeMode ? 'animate-pulse text-lime-800' : ''}`}
                  aria-hidden="true"
                />
                <span className="hidden md:inline">
                  {isPracticeMode ? `${practiceAccuracy}%` : 'Práctica'}
                </span>
                {isPracticeMode && (practiceStreak ?? 0) > 1 && (
                  <span
                    className="flex items-center gap-0.5 rounded-full bg-lime-400/60 px-1.5 py-0.5 font-mono text-[10px] text-lime-950"
                    title={`${practiceStreak} notas seguidas acertadas`}
                  >
                    <Flame
                      className="w-2.5 h-2.5 fill-amber-500/30 text-amber-700"
                      aria-hidden="true"
                    />
                    {practiceStreak}
                  </span>
                )}
              </button>
            )}

            <div className="h-4 w-px bg-slate-200 dark:bg-studio-border mx-0.5 shrink-0" />

            {/* Stepper de tempo simetrico: [- ] [ 120 ] [ +] con pulsadores tactiles */}
            <div className="flex items-center gap-1.5 px-1 text-xs text-slate-500 dark:text-slate-400 shrink-0">
              <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:inline">
                BPM
              </span>
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-studio-line dark:bg-studio-surface shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateTempo(Math.max(30, score.tempo - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-white hover:text-slate-900 active:scale-90 dark:text-slate-400 dark:hover:bg-studio-elevated dark:hover:text-white"
                  title="Disminuir BPM"
                  aria-label="Disminuir tempo"
                >
                  <Minus className="w-3 h-3" aria-hidden="true" />
                </button>
                <input
                  type="number"
                  min={30}
                  max={300}
                  value={score.tempo}
                  onChange={(e) => onUpdateTempo(parseInt(e.target.value, 10) || 120)}
                  className="w-11 bg-transparent py-0.5 text-center font-mono text-xs font-bold text-slate-800 outline-none select-none dark:text-slate-200"
                  aria-label="Tempo en pulsaciones por minuto"
                />
                <button
                  type="button"
                  onClick={() => onUpdateTempo(Math.min(300, score.tempo + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-white hover:text-slate-900 active:scale-90 dark:text-slate-400 dark:hover:bg-studio-elevated dark:hover:text-white"
                  title="Aumentar BPM"
                  aria-label="Aumentar tempo"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Voice Selector: al costado del mazo de transporte */}
          {onSelectVoice && (
            <div
              id="navbar-voice-selector"
              className="flex items-center gap-1 bg-white dark:bg-studio-card p-1 rounded-xl border border-slate-200 dark:border-studio-border shadow-xs shrink-0"
            >
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold px-1.5 uppercase tracking-wider hidden md:inline">
                Voz:
              </span>
              <button
                type="button"
                onClick={() => onSelectVoice(1)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all duration-150 active:scale-90 font-bold text-xs shrink-0 ${
                  activeVoice === 1
                    ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-500/50'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover'
                }`}
                title="Voz 1 (Plicas arriba por defecto) - Tecla V"
                aria-label="Voz 1 (Plicas arriba)"
              >
                <span className="hidden sm:inline">Voz </span>
                <span>1</span>
                <span className="text-xs font-bold leading-none">↑</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectVoice(2)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all duration-150 active:scale-90 font-bold text-xs shrink-0 ${
                  activeVoice === 2
                    ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-500/50'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover'
                }`}
                title="Voz 2 (Plicas abajo por defecto) - Tecla V"
                aria-label="Voz 2 (Plicas abajo)"
              >
                <span className="hidden sm:inline">Voz </span>
                <span>2</span>
                <span className="text-xs font-bold leading-none">↓</span>
              </button>
            </div>
          )}
        </div>

        {/* Master volume controls: always visible on the right, clean and compact */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-studio-card px-2 sm:px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-studio-border shadow-xs shrink-0">
          <button
            onClick={onToggleMute}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover transition-all duration-150 hover:scale-105 active:scale-90"
            title={volume > 0 ? 'Silenciar' : 'Reactivar sonido'}
            aria-label={volume > 0 ? 'Silenciar' : 'Reactivar sonido'}
          >
            {volume > 0 ? (
              <Volume2 className="w-3.5 h-3.5 text-studio-accent" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-rose-500" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onSetVolume(parseFloat(e.target.value))}
            style={{ '--range-progress': `${Math.round(volume * 100)}%` } as React.CSSProperties}
            className="studio-range w-14 sm:w-20 transition-opacity hover:opacity-100 opacity-90"
            title="Volumen general"
            aria-label="Volumen general"
          />
        </div>
      </div>
    </header>
  );
};
