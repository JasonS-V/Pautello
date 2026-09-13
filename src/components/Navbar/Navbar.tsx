import React from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  Volume2,
  Sun,
  Moon,
  Download,
  HelpCircle,
  Heart,
  FolderOpen,
  Music,
} from 'lucide-react';
import { Score, NamingConvention } from '../../types/music';
import { TEMPLATES, ScoreTemplate } from '../../constants/templates';
import { InstrumentType } from '../../audio/synth';

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
  instrument: InstrumentType;
  onSetInstrument: (inst: InstrumentType) => void;
  volume: number;
  onSetVolume: (vol: number) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  namingConvention: NamingConvention;
  onToggleNamingConvention: () => void;
  showNoteNames: boolean;
  onToggleShowNoteNames: () => void;
  onLoadTemplate: (template: ScoreTemplate) => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
  onOpenDonate: () => void;
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
  instrument,
  onSetInstrument,
  volume,
  onSetVolume,
  theme,
  onToggleTheme,
  namingConvention,
  onToggleNamingConvention,
  showNoteNames,
  onToggleShowNoteNames,
  onLoadTemplate,
  onOpenExport,
  onOpenShortcuts,
  onOpenDonate,
}) => {
  return (
    <header className="bg-white dark:bg-[#13161f] border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 select-none px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      {/* Brand & Score Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight leading-none block">Sonata</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Editor Libre</span>
          </div>
        </div>

        {/* Title and Composer inputs */}
        <div className="flex flex-col">
          <input
            type="text"
            value={score.title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            className="text-sm font-semibold bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:bg-slate-100 dark:focus:bg-slate-800 px-1.5 py-0.5 rounded outline-none transition-colors border border-transparent focus:border-blue-500"
            placeholder="Título de la obra"
            title="Haz clic para cambiar el título"
          />
          <input
            type="text"
            value={score.composer}
            onChange={(e) => onUpdateComposer(e.target.value)}
            className="text-[11px] text-slate-500 dark:text-slate-400 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:bg-slate-100 dark:focus:bg-slate-800 px-1.5 py-0.2 rounded outline-none transition-colors border border-transparent focus:border-blue-500"
            placeholder="Compositor"
            title="Haz clic para cambiar el autor"
          />
        </div>
      </div>

      {/* Playback Controls & Tempo */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#1a1e2b] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
        <button
          onClick={onTogglePlay}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium text-xs transition-all shadow-xs ${
            isPlaying
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
          title="Espacio: Reproducir / Pausar"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
        </button>

        <button
          onClick={onStop}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          title="Detener reproducción"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
        </button>

        <button
          onClick={onToggleLoop}
          className={`p-1.5 rounded transition-colors ${
            isLooping
              ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 font-bold'
              : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}
          title="Repetir en bucle"
        >
          <Repeat className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onToggleMetronome}
          className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
            metronomeEnabled
              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold'
              : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}
          title="Metrónomo de compás"
        >
          <span>⏱️</span>
          <span>Metr.</span>
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* BPM Tempo */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
          <span className="text-[11px] text-slate-500">BPM:</span>
          <input
            type="number"
            min={30}
            max={300}
            value={score.tempo}
            onChange={(e) => onUpdateTempo(parseInt(e.target.value, 10) || 120)}
            className="w-14 text-center bg-white dark:bg-[#12151c] border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5 text-xs outline-none focus:border-blue-500 font-mono"
            title="Pulsaciones por minuto (Tempo)"
          />
        </div>

        {/* Instrument Selector */}
        <select
          value={instrument}
          onChange={(e) => onSetInstrument(e.target.value as InstrumentType)}
          className="text-xs bg-white dark:bg-[#12151c] border border-slate-300 dark:border-slate-700 rounded px-2 py-1 outline-none text-slate-700 dark:text-slate-200 cursor-pointer"
          title="Sonido del instrumento"
        >
          <option value="piano">Piano Acústico</option>
          <option value="marimba">Marimba</option>
          <option value="strings">Cuerdas (Strings)</option>
          <option value="flute">Flauta / Viento</option>
        </select>

        {/* Volume */}
        <div className="flex items-center gap-1 pl-1">
          <Volume2 className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onSetVolume(parseFloat(e.target.value))}
            className="w-16 accent-blue-600 cursor-pointer h-1 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none"
            title="Volumen general"
          />
        </div>
      </div>

      {/* Utilities & Actions */}
      <div className="flex items-center gap-2">
        {/* Note Names Solfeggio Toggle */}
        <button
          onClick={onToggleShowNoteNames}
          className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
            showNoteNames
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 text-blue-600 dark:text-blue-300 font-semibold'
              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
          title="Mostrar u ocultar nombres de notas (Do-Re-Mi) sobre el pentagrama"
        >
          {showNoteNames ? 'Notas: ON' : 'Notas: OFF'}
        </button>

        {/* Naming Convention Toggle */}
        <button
          onClick={onToggleNamingConvention}
          className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          title="Alternar entre nomenclatura latina (Do-Re-Mi) y anglosajona (C-D-E)"
        >
          {namingConvention === 'latin' ? 'Do-Re-Mi' : 'C-D-E'}
        </button>

        {/* Templates dropdown */}
        <div className="relative group">
          <button
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
            title="Cargar obras de ejemplo y plantillas"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Ejemplos</span>
          </button>
          <div className="hidden group-hover:block absolute right-0 top-full mt-1 w-64 bg-white dark:bg-[#1b1f2b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1">
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Obras y Plantillas
            </div>
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onLoadTemplate(tmpl)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors flex flex-col"
              >
                <span className="font-semibold">{tmpl.name}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  {tmpl.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 transition-colors shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>

        {/* Keyboard Shortcuts */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          title="Atajos de teclado (?)"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Donate Button */}
        <button
          onClick={onOpenDonate}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
          title="Apoyar el proyecto gratuito"
        >
          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
          <span>Donar</span>
        </button>
      </div>
    </header>
  );
};
