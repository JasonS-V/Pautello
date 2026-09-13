import React from 'react';
import {
  Music2,
  FileMusic,
  Sliders,
  Download,
  Keyboard,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  Heart,
  Sparkles,
} from 'lucide-react';
import { NamingConvention } from '../../types/music';

export type SidebarTab = 'editor' | 'templates' | 'mixer' | 'piano' | 'export';

interface SidebarProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  namingConvention: NamingConvention;
  onToggleNamingConvention: () => void;
  showNoteNames: boolean;
  onToggleShowNoteNames: () => void;
  isPianoCollapsed: boolean;
  onTogglePiano: () => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
  onOpenDonate: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  theme,
  onToggleTheme,
  namingConvention,
  onToggleNamingConvention,
  showNoteNames,
  onToggleShowNoteNames,
  isPianoCollapsed,
  onTogglePiano,
  onOpenExport,
  onOpenShortcuts,
  onOpenDonate,
}) => {
  return (
    <aside
      id="sidebar-container"
      className="w-64 bg-[#111319] dark:bg-[#111319] text-slate-300 flex flex-col justify-between p-5 border-r border-[#202433] select-none shrink-0 min-h-screen"
    >
      {/* Brand Logo & Name */}
      <div>
        <div className="flex items-center gap-3 mb-8 px-2">
          {/* Stylized colorful rainbow wave logo from reference */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none">
              <path
                d="M6 24 C6 14, 14 6, 24 6"
                stroke="#fed7aa"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M11 26 C11 18, 17 11, 26 11"
                stroke="#c4b5fd"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M16 28 C16 22, 20 16, 28 16"
                stroke="#bef264"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-white block leading-none">
              Sonata
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">
              Studio Libre
            </span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="space-y-1.5">
          {/* Tab: Editor */}
          <button
            onClick={() => onSelectTab('editor')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all relative ${
              activeTab === 'editor'
                ? 'text-[#f59e0b] bg-[#1a1d29]'
                : 'text-slate-400 hover:text-white hover:bg-[#161822]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Music2 className="w-4 h-4" />
              <span>Editor</span>
            </div>
            {activeTab === 'editor' && (
              <span className="w-1.5 h-5 bg-[#f59e0b] rounded-full absolute right-2" />
            )}
          </button>

          {/* Tab: Plantillas / Obras */}
          <button
            onClick={() => onSelectTab('templates')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all relative ${
              activeTab === 'templates'
                ? 'text-[#f59e0b] bg-[#1a1d29]'
                : 'text-slate-400 hover:text-white hover:bg-[#161822]'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileMusic className="w-4 h-4" />
              <span>Obras y Plantillas</span>
            </div>
            {activeTab === 'templates' && (
              <span className="w-1.5 h-5 bg-[#f59e0b] rounded-full absolute right-2" />
            )}
          </button>

          {/* Tab: Piano Roll / Teclado */}
          <button
            onClick={() => {
              onTogglePiano();
              onSelectTab('piano');
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all relative ${
              !isPianoCollapsed
                ? 'text-[#bef264] bg-[#1a1d29]'
                : 'text-slate-400 hover:text-white hover:bg-[#161822]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Keyboard className="w-4 h-4" />
              <span>Teclado Solfeo</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              !isPianoCollapsed ? 'bg-[#bef264]/20 text-[#bef264]' : 'bg-slate-800 text-slate-400'
            }`}>
              {!isPianoCollapsed ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Tab: Mezclador / Audio */}
          <button
            onClick={() => onSelectTab('mixer')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all relative ${
              activeTab === 'mixer'
                ? 'text-[#f59e0b] bg-[#1a1d29]'
                : 'text-slate-400 hover:text-white hover:bg-[#161822]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sliders className="w-4 h-4" />
              <span>Sintetizador</span>
            </div>
          </button>

          {/* Tab: Exportar */}
          <button
            onClick={onOpenExport}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-[#161822] transition-all"
          >
            <div className="flex items-center gap-3">
              <Download className="w-4 h-4" />
              <span>Exportar Partitura</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Center/Bottom: Lilac Promo Card (matching the reference image's card) */}
      <div className="my-5">
        <div className="bg-[#c4b5fd] rounded-2xl p-4 text-purple-950 flex flex-col items-center text-center relative overflow-hidden shadow-md">
          {/* Subtle decoration */}
          <div className="w-12 h-12 rounded-full bg-white/40 flex items-center justify-center mb-2.5 shadow-inner">
            <Heart className="w-6 h-6 fill-purple-900 text-purple-900" />
          </div>

          <h5 className="font-bold text-xs tracking-tight text-purple-950 leading-snug">
            ¿Creas o estudias música?
          </h5>
          <p className="text-[10px] text-purple-900/85 mt-1 font-medium leading-relaxed">
            Sonata es 100% libre y sin muros de pago. Tu apoyo mantiene este software gratuito para todos.
          </p>

          <button
            onClick={onOpenDonate}
            className="mt-3 w-full py-1.5 px-3 bg-slate-950 hover:bg-black text-white text-[11px] font-bold rounded-xl transition-all shadow hover:shadow-lg active:scale-95"
          >
            Apoyar Proyecto
          </button>
        </div>
      </div>

      {/* Sidebar Footer: Settings, Theme & Help */}
      <div className="space-y-2 border-t border-[#202433] pt-4 text-xs text-slate-400">
        {/* Solfeggio / Latin toggle */}
        <button
          onClick={onToggleNamingConvention}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#161822] hover:text-white transition-colors"
          title="Alternar entre nomenclatura latina y cifrado americano"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#fed7aa]" />
            <span>Notación</span>
          </div>
          <span className="font-bold text-[10px] bg-[#1d212f] text-slate-200 px-1.5 py-0.5 rounded">
            {namingConvention === 'latin' ? 'Do-Re-Mi' : 'C-D-E'}
          </span>
        </button>

        {/* Note names display on staves */}
        <button
          onClick={onToggleShowNoteNames}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#161822] hover:text-white transition-colors"
          title="Mostrar nombres de notas sobre las cabezas de nota"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Guía de notas</span>
          </div>
          <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${
            showNoteNames ? 'bg-blue-900/60 text-blue-300' : 'bg-[#1d212f] text-slate-400'
          }`}>
            {showNoteNames ? 'Visible' : 'Oculto'}
          </span>
        </button>

        {/* Dark / Light Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#161822] hover:text-white transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>Tema</span>
          </div>
          <span className="capitalize text-[10px] text-slate-300 font-medium">
            {theme === 'dark' ? 'Oscuro' : 'Claro'}
          </span>
        </button>

        {/* Shortcuts / Help */}
        <button
          onClick={onOpenShortcuts}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#161822] hover:text-white transition-colors"
          title="Atajos de teclado (?)"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Atajos de teclado</span>
        </button>
      </div>
    </aside>
  );
};
