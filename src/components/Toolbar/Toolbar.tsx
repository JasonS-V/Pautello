import React from 'react';
import { NoteDuration, Accidental } from '../../types/music';
import { ACCIDENTAL_GLYPHS } from '../../engraver/glyphPaths';

interface ToolbarProps {
  activeDuration: NoteDuration;
  onSelectDuration: (duration: NoteDuration) => void;
  isRestMode: boolean;
  onToggleRestMode: () => void;
  activeAccidental: Accidental;
  onSelectAccidental: (acc: Accidental) => void;
  isDotted: boolean;
  onToggleDot: () => void;
  isTuplet?: boolean;
  onToggleTuplet?: () => void;
  isTied?: boolean;
  onToggleTie?: () => void;
}

/**
 * Botón de herramienta de notación. El estado activo usa siempre el acento
 * editorial (ámbar), nunca un color por herramienta; además lo anuncia con
 * tipografía en negrita y `aria-pressed` para no depender sólo del color.
 */
const toolButtonClass = (active: boolean) =>
  `flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg transition-all duration-150 ${
    active
      ? 'bg-studio-accent text-slate-950 font-bold shadow-xs'
      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-elevated'
  }`;

const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold px-1.5 uppercase tracking-wider hidden md:inline select-none">
    {children}
  </span>
);

export const Toolbar: React.FC<ToolbarProps> = ({
  activeDuration,
  onSelectDuration,
  isRestMode,
  onToggleRestMode,
  activeAccidental,
  onSelectAccidental,
  isDotted,
  onToggleDot,
  isTuplet = false,
  onToggleTuplet,
  isTied = false,
  onToggleTie,
}) => {
  const durations: { key: NoteDuration; label: string; symbol: string; shortcut: string }[] = [
    { key: 'w', label: 'Redonda', symbol: '𝅝', shortcut: '1' },
    { key: 'h', label: 'Blanca', symbol: '𝅗𝅥', shortcut: '2' },
    { key: 'q', label: 'Negra', symbol: '𝅘𝅥', shortcut: '3' },
    { key: '8', label: 'Corchea', symbol: '𝅘𝅥𝅮', shortcut: '4' },
    { key: '16', label: 'Semicorchea', symbol: '𝅘𝅥𝅯', shortcut: '5' },
    { key: '32', label: 'Fusa', symbol: '𝅘𝅥𝅰', shortcut: '6' },
  ];

  const accidentals: { key: NonNullable<Accidental>; symbol: string; label: string }[] = [
    { key: '#', symbol: '♯', label: 'Sostenido (+ / #)' },
    { key: 'b', symbol: '♭', label: 'Bemol (- / _)' },
    { key: 'n', symbol: '♮', label: 'Becuadro (N)' },
  ];

  // Fila única compacta y responsiva: cada grupo es una superficie plana que
  // nunca se corta; en anchos medios sólo esta barra desplaza horizontalmente.
  return (
    <div className="flex items-center justify-start gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 bg-slate-50 dark:bg-studio-surface border-b border-slate-200 dark:border-studio-border select-none text-xs rounded-t-xl transition-colors overflow-x-auto no-scrollbar min-w-0">
      {/* Grupo 1: Figuras (duración rítmica) */}
      <div
        role="group"
        aria-label="Figuras rítmicas"
        className="flex items-center gap-1 bg-white/80 dark:bg-studio-card p-1 rounded-lg border border-slate-200 dark:border-studio-border shrink-0"
      >
        <GroupLabel>Figuras:</GroupLabel>
        {durations.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => onSelectDuration(d.key)}
            aria-pressed={activeDuration === d.key && !isRestMode}
            className={toolButtonClass(activeDuration === d.key && !isRestMode)}
            title={`${d.label} (Tecla ${d.shortcut})`}
            aria-label={`${d.label} (Tecla ${d.shortcut})`}
          >
            <span className="text-base leading-none">{d.symbol}</span>
            <span className="text-[11px] font-medium hidden 2xl:inline">{d.label}</span>
            <span className="text-[9px] opacity-60 font-mono">{d.shortcut}</span>
          </button>
        ))}
      </div>

      {/* Grupo 2: Modificadores de la figura (silencio, puntillo, tresillo, ligadura) */}
      <div
        role="group"
        aria-label="Modificadores de figura"
        className="flex items-center gap-1 bg-white/80 dark:bg-studio-card p-1 rounded-lg border border-slate-200 dark:border-studio-border shrink-0"
      >
        <GroupLabel>Modif:</GroupLabel>

        {/* Rest Mode Toggle */}
        <button
          type="button"
          onClick={onToggleRestMode}
          aria-pressed={isRestMode}
          className={toolButtonClass(isRestMode)}
          title="Modo Silencio (Tecla R)"
          aria-label="Modo Silencio (Tecla R)"
        >
          <span className="text-sm leading-none">𝄽</span>
          <span className="text-[11px] font-medium hidden 2xl:inline">Silencio</span>
          <span className="text-[9px] opacity-60 ml-0.5 font-mono">R</span>
        </button>

        {/* Dot Toggle */}
        <button
          type="button"
          onClick={onToggleDot}
          aria-pressed={isDotted}
          className={toolButtonClass(isDotted)}
          title="Puntillo - añade 50% de duración (Tecla .)"
          aria-label="Puntillo (Tecla .)"
        >
          <span className="font-bold text-sm leading-none">•</span>
          <span className="text-[11px] font-medium hidden 2xl:inline">Puntillo</span>
          <span className="text-[9px] opacity-60 font-mono">.</span>
        </button>

        {/* Tuplet Toggle (Tresillo 3:2) */}
        {onToggleTuplet && (
          <button
            type="button"
            onClick={onToggleTuplet}
            aria-pressed={isTuplet}
            className={toolButtonClass(isTuplet)}
            title="Tresillo (3:2) - 3 notas en lugar de 2 (Tecla T o Ctrl+3)"
            aria-label="Tresillo (Tecla T)"
          >
            <span className="font-bold text-xs leading-none">┌3┐</span>
            <span className="text-[11px] font-medium hidden 2xl:inline">Tresillo</span>
            <span className="text-[9px] opacity-60 font-mono">T</span>
          </button>
        )}

        {/* Tie Toggle (Ligadura de prolongación) */}
        {onToggleTie && (
          <button
            type="button"
            onClick={onToggleTie}
            aria-pressed={isTied}
            className={toolButtonClass(isTied)}
            title="Ligadura de prolongación (Tecla L)"
            aria-label="Ligadura de prolongación (Tecla L)"
          >
            <span className="font-black text-sm leading-none">‿</span>
            <span className="text-[11px] font-medium hidden 2xl:inline">Ligadura</span>
            <span className="text-[9px] opacity-60 font-mono">L</span>
          </button>
        )}
      </div>

      {/* Grupo 3: Alteraciones (sostenido, bemol, becuadro) */}
      <div
        role="group"
        aria-label="Alteraciones"
        className="flex items-center gap-1 bg-white/80 dark:bg-studio-card p-1 rounded-lg border border-slate-200 dark:border-studio-border shrink-0"
      >
        <GroupLabel>Alt:</GroupLabel>
        {accidentals.map((a) => {
          const glyph = ACCIDENTAL_GLYPHS[a.key];
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => onSelectAccidental(activeAccidental === a.key ? null : a.key)}
              aria-pressed={activeAccidental === a.key}
              className={`flex items-center justify-center font-bold text-xs h-6 min-w-[24px] ${toolButtonClass(activeAccidental === a.key)}`}
              title={a.label}
              aria-label={a.label}
            >
              {glyph ? (
                <svg
                  viewBox={glyph.viewBox}
                  className="w-2.5 h-3.5 fill-current inline-block pointer-events-none select-none"
                  aria-hidden="true"
                >
                  <path d={glyph.d} fill="currentColor" />
                </svg>
              ) : (
                a.symbol
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
