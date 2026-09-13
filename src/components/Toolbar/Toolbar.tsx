import React from 'react';
import { NoteDuration, Accidental } from '../../types/music';

interface ToolbarProps {
  activeDuration: NoteDuration;
  onSelectDuration: (duration: NoteDuration) => void;
  isRestMode: boolean;
  onToggleRestMode: () => void;
  activeAccidental: Accidental;
  onSelectAccidental: (acc: Accidental) => void;
  isDotted: boolean;
  onToggleDot: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeDuration,
  onSelectDuration,
  isRestMode,
  onToggleRestMode,
  activeAccidental,
  onSelectAccidental,
  isDotted,
  onToggleDot,
}) => {
  const durations: { key: NoteDuration; label: string; symbol: string; shortcut: string }[] = [
    { key: 'w', label: 'Redonda', symbol: '𝅝', shortcut: '1' },
    { key: 'h', label: 'Blanca', symbol: '𝅗𝅥', shortcut: '2' },
    { key: 'q', label: 'Negra', symbol: '𝅘𝅥', shortcut: '3' },
    { key: '8', label: 'Corchea', symbol: '𝅘𝅥𝅮', shortcut: '4' },
    { key: '16', label: 'Semicorchea', symbol: '𝅘𝅥𝅯', shortcut: '5' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-slate-100 dark:bg-[#161922] border-b border-slate-200 dark:border-[#232836] select-none text-xs rounded-t-2xl transition-colors">
      {/* Note Durations Selector */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#111319] p-1 rounded-xl border border-slate-200 dark:border-[#232836] shadow-xs">
        {durations.map((d) => (
          <button
            key={d.key}
            onClick={() => onSelectDuration(d.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
              activeDuration === d.key
                ? isRestMode
                  ? 'bg-[#fed7aa] text-amber-950 font-bold shadow-xs'
                  : 'bg-[#bef264] text-lime-950 font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1d28]'
            }`}
            title={`${d.label} (Tecla ${d.shortcut})`}
          >
            <span className="text-base leading-none">{d.symbol}</span>
            <span className="text-[11px] font-medium hidden sm:inline">{d.label}</span>
            <span className="text-[9px] opacity-60 font-mono">{d.shortcut}</span>
          </button>
        ))}

        <div className="h-4 w-px bg-slate-200 dark:bg-[#232836] mx-1" />

        {/* Rest Mode Toggle */}
        <button
          onClick={onToggleRestMode}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
            isRestMode
              ? 'bg-[#fed7aa] text-amber-950 font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1d28]'
          }`}
          title="Modo Silencio (Tecla R)"
        >
          <span className="text-sm leading-none">𝄽</span>
          <span className="text-[11px] font-medium">Silencio</span>
          <span className="text-[9px] opacity-60 ml-0.5 font-mono">R</span>
        </button>

        {/* Dot Toggle */}
        <button
          onClick={onToggleDot}
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
            isDotted
              ? 'bg-[#c4b5fd] text-purple-950 font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1d28]'
          }`}
          title="Puntillo - añade 50% de duración (Tecla .)"
        >
          <span className="font-bold text-sm leading-none">•</span>
          <span className="text-[11px] font-medium">Puntillo</span>
          <span className="text-[9px] opacity-60 font-mono">.</span>
        </button>
      </div>

      {/* Accidentals Palette (#, b, natural) */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#111319] p-1 rounded-xl border border-slate-200 dark:border-[#232836] shadow-xs">
        <span className="text-[10px] text-slate-500 font-bold px-1.5 uppercase tracking-wider">
          Alt:
        </span>
        <button
          onClick={() => onSelectAccidental(activeAccidental === '#' ? null : '#')}
          className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
            activeAccidental === '#'
              ? 'bg-[#fed7aa] text-amber-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1d28]'
          }`}
          title="Sostenido (+ / #)"
        >
          ♯
        </button>
        <button
          onClick={() => onSelectAccidental(activeAccidental === 'b' ? null : 'b')}
          className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
            activeAccidental === 'b'
              ? 'bg-[#c4b5fd] text-purple-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1d28]'
          }`}
          title="Bemol (- / _)"
        >
          ♭
        </button>
        <button
          onClick={() => onSelectAccidental(activeAccidental === 'n' ? null : 'n')}
          className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
            activeAccidental === 'n'
              ? 'bg-[#bef264] text-lime-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1d28]'
          }`}
          title="Becuadro (N)"
        >
          ♮
        </button>
      </div>
    </div>
  );
};
