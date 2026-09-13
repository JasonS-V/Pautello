import React from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  Volume2,
  FolderOpen,
  Edit2,
  Clock,
} from 'lucide-react';
import { Score } from '../../types/music';
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
  onLoadTemplate: (template: ScoreTemplate) => void;
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
  onLoadTemplate,
}) => {
  return (
    <header className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 select-none bg-transparent">
      {/* Title & Greeting style (inspired by "Hello, Daniel" from reference image) */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={score.title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-[#1c202c] px-2 py-0.5 rounded-lg outline-none transition-colors border border-transparent focus:border-[#f59e0b] tracking-tight max-w-[320px] sm:max-w-[450px]"
            placeholder="Título de la Obra"
            title="Haz clic para renombrar la partitura"
          />
          <Edit2 className="w-3.5 h-3.5 text-slate-400 opacity-60 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 px-2 text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
          <input
            type="text"
            value={score.composer}
            onChange={(e) => onUpdateComposer(e.target.value)}
            className="bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-white dark:focus:bg-[#1c202c] px-1 rounded outline-none transition-colors border border-transparent focus:border-[#f59e0b] text-[11px]"
            placeholder="Compositor / Arreglista"
            title="Haz clic para cambiar el compositor"
          />
          <span>•</span>
          <span className="text-[#f59e0b] font-semibold">{score.keySignature} Mayor</span>
          <span>•</span>
          <span>{score.timeSignature.beats}/{score.timeSignature.beatType}</span>
        </div>
      </div>

      {/* Right controls: Playback & Audio Deck */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Playback Transport Pill Deck */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-[#161922] p-1.5 rounded-2xl border border-slate-200 dark:border-[#232836] shadow-xs">
          {/* Main Play/Pause Button in Bright Amber from reference */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-xs transition-all duration-150 shadow-sm ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-[#fed7aa] hover:bg-[#fcd34d] text-amber-950 active:scale-95'
            }`}
            title="Espacio: Reproducir / Pausar"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
          </button>

          {/* Stop Button */}
          <button
            onClick={onStop}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
            title="Detener"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Loop Button */}
          <button
            onClick={onToggleLoop}
            className={`p-2 rounded-xl transition-colors ${
              isLooping
                ? 'bg-[#c4b5fd]/30 text-[#8b5cf6] font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2330]'
            }`}
            title="Repetir en bucle continuo"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Metronome Button */}
          <button
            onClick={onToggleMetronome}
            className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 font-semibold transition-colors ${
              metronomeEnabled
                ? 'bg-[#bef264] text-lime-950 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2330]'
            }`}
            title="Metrónomo auditivo"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Metr.</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-[#232836] mx-1" />

          {/* BPM Tempo Input */}
          <div className="flex items-center gap-1 px-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">BPM</span>
            <input
              type="number"
              min={30}
              max={300}
              value={score.tempo}
              onChange={(e) => onUpdateTempo(parseInt(e.target.value, 10) || 120)}
              className="w-12 text-center bg-slate-100 dark:bg-[#111319] border border-slate-300 dark:border-[#2a3042] rounded-lg px-1 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#f59e0b]"
            />
          </div>
        </div>

        {/* Instrument & Volume Widget */}
        <div className="hidden md:flex items-center gap-2 bg-white dark:bg-[#161922] px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-[#232836] shadow-xs">
          <select
            value={instrument}
            onChange={(e) => onSetInstrument(e.target.value as InstrumentType)}
            className="text-xs font-semibold bg-transparent text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-2"
            title="Instrumento de síntesis"
          >
            <option value="piano" className="bg-white dark:bg-[#161922]">Piano Acústico</option>
            <option value="marimba" className="bg-white dark:bg-[#161922]">Marimba</option>
            <option value="strings" className="bg-white dark:bg-[#161922]">Cuerdas (Strings)</option>
            <option value="flute" className="bg-white dark:bg-[#161922]">Flauta / Viento</option>
          </select>

          <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200 dark:border-[#232836]">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onSetVolume(parseFloat(e.target.value))}
              className="w-14 accent-[#f59e0b] cursor-pointer h-1 bg-slate-200 dark:bg-[#2a3042] rounded-lg appearance-none"
              title="Volumen general"
            />
          </div>
        </div>

        {/* Templates Quick Menu Dropdown */}
        <div className="relative group">
          <button
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-2xl bg-white dark:bg-[#161922] hover:bg-slate-50 dark:hover:bg-[#1f2330] border border-slate-200 dark:border-[#232836] text-slate-700 dark:text-slate-200 transition-all shadow-xs"
            title="Cargar obras de ejemplo clásicas"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#fed7aa]" />
            <span>Ejemplos</span>
          </button>
          <div className="hidden group-hover:block absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-[#161922] border border-slate-200 dark:border-[#232836] rounded-2xl shadow-xl z-50 p-2 space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Obras de Demostración
            </div>
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onLoadTemplate(tmpl)}
                className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-[#202534] text-slate-800 dark:text-slate-200 transition-colors flex flex-col"
              >
                <span className="font-bold text-slate-900 dark:text-white">{tmpl.name}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {tmpl.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
