import React from 'react';
import { Music, Layers, Check, Loader2 } from '../ui/icons';

interface StatusChipProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  title?: string;
  onClick?: () => void;
  accent: 'amber' | 'signal';
}

const accentStyles: Record<StatusChipProps['accent'], string> = {
  amber: 'text-amber-600 dark:text-pastel-amber bg-amber-500/10',
  signal: 'text-teal-700 dark:text-teal-300 bg-teal-500/10',
};

const StatusChip: React.FC<StatusChipProps> = ({ icon, label, value, title, onClick, accent }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`group flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-150 shrink-0 ${
      onClick
        ? 'cursor-pointer hover:bg-slate-200/60 dark:hover:bg-studio-hover active:scale-95'
        : 'cursor-default'
    }`}
  >
    <span
      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-110 ${accentStyles[accent]}`}
    >
      {icon}
    </span>
    <span className="flex items-baseline gap-1.5 leading-tight">
      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{label}</span>
      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
        {value}
      </span>
    </span>
  </button>
);

interface StatusBarProps {
  timeSignature: string;
  keyLabel: string;
  clefLabel: string;
  measureCount: number;
  totalNotes: number;
  duration: string;
  saveState?: 'saved' | 'saving';
  onOpenStructure: () => void;
}

/**
 * IDE-style footer at the bottom of the main column. It shows structural
 * info that used to be duplicated in the Navbar subtitle, plus score stats
 * and the autosave indicator. The id is referenced by the onboarding tour
 * and the bar is excluded from print via .no-print.
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  timeSignature,
  keyLabel,
  clefLabel,
  measureCount,
  totalNotes,
  duration,
  saveState = 'saved',
  onOpenStructure,
}) => {
  const isSaving = saveState === 'saving';
  const shortKey = keyLabel.split('/')[0].split('(')[0].trim();
  return (
    <footer
      id="status-bar-container"
      className="no-print flex items-center gap-1 px-4 sm:px-6 py-1 border-t border-slate-200 dark:border-studio-border bg-slate-50 dark:bg-studio-surface overflow-x-auto no-scrollbar shrink-0"
    >
      <StatusChip
        accent="amber"
        icon={<Music className="w-3.5 h-3.5" />}
        label="Estructura"
        value={`${timeSignature} · ${shortKey} · ${clefLabel}`}
        title="Ver y modificar en el inspector"
        onClick={onOpenStructure}
      />
      <StatusChip
        accent="signal"
        icon={<Layers className="w-3.5 h-3.5" />}
        label="Partitura"
        value={`${measureCount} compases · ${totalNotes} notas · ${duration}`}
      />
      <StatusChip
        accent="signal"
        icon={
          isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )
        }
        label="Autoguardado"
        value={isSaving ? 'Guardando…' : 'Guardado'}
        title={
          isSaving
            ? 'Guardando la partitura en este navegador'
            : 'La partitura está guardada en este navegador'
        }
      />
    </footer>
  );
};
