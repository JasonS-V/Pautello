import React from 'react';
import {
  Music2,
  FileMusic,
  Download,
  Keyboard,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  Heart,
  Sparkles,
  X,
  Sliders,
  Upload,
  GraduationCap,
  Share2,
  Activity,
  Headphones,
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
  showTablature?: boolean;
  onToggleTablature?: () => void;
  isPianoCollapsed: boolean;
  onTogglePiano: () => void;
  onOpenTemplates: () => void;
  onOpenMixer: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenShare?: () => void;
  onOpenTuner?: () => void;
  onOpenPlayAlong?: () => void;
  onOpenShortcuts: () => void;
  onOpenDonate: () => void;
  onOpenTutorial: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
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
  showTablature = false,
  onToggleTablature,
  isPianoCollapsed,
  onTogglePiano,
  onOpenTemplates,
  onOpenMixer,
  onOpenExport,
  onOpenImport,
  onOpenShare,
  onOpenTuner,
  onOpenPlayAlong,
  onOpenShortcuts,
  onOpenDonate,
  onOpenTutorial,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden no-print"
        />
      )}

      <aside
        id="sidebar-container"
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-[#111319] text-slate-700 dark:text-slate-300 flex flex-col justify-between p-5 border-r border-slate-200 dark:border-[#202433] select-none shrink-0 transition-transform duration-200 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } min-h-screen overflow-y-auto`}
      >
        {/* Brand Logo & Name */}
        <div>
          <div className="flex items-center justify-between mb-7 px-1">
            <div className="flex items-center gap-3">
              {/* Stylized colorful rainbow wave logo from reference */}
              <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
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
                <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white block leading-none">
                  Sonata
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                  Studio Libre
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161822]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation List */}
          <nav className="space-y-1">
            {/* Tab: Editor */}
            <button
              onClick={() => {
                onSelectTab('editor');
                onCloseMobile?.();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all relative ${
                activeTab === 'editor'
                  ? 'text-[#f59e0b] bg-amber-500/10 dark:bg-[#1a1d29]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161822]'
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
              onClick={() => {
                onOpenTemplates();
                onCloseMobile?.();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161822] transition-all"
            >
              <div className="flex items-center gap-3">
                <FileMusic className="w-4 h-4" />
                <span>Obras y Plantillas</span>
              </div>
            </button>

            {/* Tab: Piano Roll / Teclado */}
            <button
              onClick={() => {
                onTogglePiano();
                onCloseMobile?.();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                !isPianoCollapsed
                  ? 'text-lime-700 dark:text-[#bef264] bg-lime-500/10 dark:bg-[#1a1d29]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161822]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Keyboard className="w-4 h-4" />
                <span>Teclado Solfeo</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  !isPianoCollapsed
                    ? 'bg-[#bef264]/30 text-lime-900 dark:text-[#bef264]'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {!isPianoCollapsed ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Tab: Sintetizador / Audio */}
            <button
              onClick={() => {
                onOpenMixer();
                onCloseMobile?.();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161822] transition-all"
            >
              <div className="flex items-center gap-3">
                <Sliders className="w-4 h-4 text-[#c4b5fd]" />
                <span>Sintetizador & Audio</span>
              </div>
            </button>

            {/* Tab: Importar */}
            <button
              onClick={() => {
                onOpenImport();
                onCloseMobile?.();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161822] transition-all"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-blue-500" />
                <span>Importar Partitura</span>
              </div>
            </button>

            {/* Tab: Exportar */}
            <button
              onClick={() => {
                onOpenExport();
                onCloseMobile?.();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161822] transition-all"
            >
              <div className="flex items-center gap-3">
                <Download className="w-4 h-4" />
                <span>Exportar Partitura</span>
              </div>
            </button>

            {/* Tab: Compartir Enlace */}
            {onOpenShare && (
              <button
                onClick={() => {
                  onOpenShare();
                  onCloseMobile?.();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-amber-700 dark:text-[#fed7aa] bg-amber-500/10 dark:bg-amber-400/10 hover:bg-amber-500/20 dark:hover:bg-amber-400/20 transition-all border border-amber-300/40 dark:border-amber-500/20"
              >
                <div className="flex items-center gap-3">
                  <Share2 className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold">Compartir Enlace</span>
                </div>
                <span className="text-[9px] bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-[#fed7aa] px-1.5 py-0.5 rounded font-bold">
                  URL
                </span>
              </button>
            )}

            {/* Tab: Afinador en Vivo */}
            {onOpenTuner && (
              <button
                onClick={() => {
                  onOpenTuner();
                  onCloseMobile?.();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161822] transition-all"
              >
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-lime-500 dark:text-[#bef264]" />
                  <span>Afinador en Vivo</span>
                </div>
                <span className="text-[9px] bg-lime-500/15 text-lime-600 dark:text-[#bef264] px-1.5 py-0.5 rounded font-bold">
                  MIC
                </span>
              </button>
            )}

            {/* Tab: Play-Along Multimedia */}
            {onOpenPlayAlong && (
              <button
                onClick={() => {
                  onOpenPlayAlong();
                  onCloseMobile?.();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161822] transition-all"
              >
                <div className="flex items-center gap-3">
                  <Headphones className="w-4 h-4 text-purple-500 dark:text-[#c4b5fd]" />
                  <span>Play-Along (Audio)</span>
                </div>
                <span className="text-[9px] bg-purple-500/15 text-purple-600 dark:text-[#c4b5fd] px-1.5 py-0.5 rounded font-bold">
                  MP3
                </span>
              </button>
            )}
          </nav>
        </div>

        {/* Center/Bottom: Lilac Promo Card (matching the reference image's card) */}
        <div className="my-5">
          <div className="bg-[#c4b5fd] rounded-2xl p-4 text-purple-950 flex flex-col items-center text-center relative overflow-hidden shadow-sm">
            {/* Subtle decoration */}
            <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center mb-2 shadow-inner">
              <Heart className="w-5 h-5 fill-purple-900 text-purple-900" />
            </div>

            <h5 className="font-bold text-xs tracking-tight text-purple-950 leading-snug">
              ¿Creas o estudias música?
            </h5>
            <p className="text-[10px] text-purple-900/85 mt-1 font-medium leading-relaxed">
              Sonata es 100% libre y sin muros de pago. Tu apoyo mantiene este software gratuito para todos.
            </p>

            <button
              onClick={() => {
                onOpenDonate();
                onCloseMobile?.();
              }}
              className="mt-3 w-full py-1.5 px-3 bg-slate-950 hover:bg-black text-white text-[11px] font-bold rounded-xl transition-all shadow hover:shadow-lg active:scale-95"
            >
              Apoyar Proyecto
            </button>
          </div>
        </div>

        {/* Sidebar Footer: Settings, Theme & Help */}
        <div className="space-y-1.5 border-t border-slate-200 dark:border-[#202433] pt-4 text-xs text-slate-600 dark:text-slate-400">
          {/* Solfeggio / Latin toggle */}
          <button
            onClick={onToggleNamingConvention}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#161822] hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Alternar entre nomenclatura latina y cifrado americano"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Notación</span>
            </div>
            <span className="font-bold text-[10px] bg-slate-100 dark:bg-[#1d212f] text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#2c3244]">
              {namingConvention === 'latin' ? 'Do-Re-Mi' : 'C-D-E'}
            </span>
          </button>

          {/* Note names display on staves */}
          <button
            onClick={onToggleShowNoteNames}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#161822] hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Mostrar nombres de notas sobre las cabezas de nota"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Guía de notas</span>
            </div>
            <span
              className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${
                showNoteNames
                  ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-100 dark:bg-[#1d212f] text-slate-500 dark:text-slate-400'
              }`}
            >
              {showNoteNames ? 'Visible' : 'Oculto'}
            </span>
          </button>

          {/* Guitar Tablature Toggle */}
          {onToggleTablature && (
            <button
              onClick={onToggleTablature}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#161822] hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Mostrar u ocultar la tablatura de guitarra (TAB) bajo el pentagrama"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-black text-amber-500 bg-amber-100 dark:bg-amber-950/80 px-1 rounded">
                  TAB
                </span>
                <span>Tablatura</span>
              </div>
              <span
                className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${
                  showTablature
                    ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-[#fed7aa]'
                    : 'bg-slate-100 dark:bg-[#1d212f] text-slate-500 dark:text-slate-400'
                }`}
              >
                {showTablature ? 'ON' : 'OFF'}
              </span>
            </button>
          )}

          {/* Dark / Light Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#161822] hover:text-slate-900 dark:hover:text-white transition-colors"
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>Tema</span>
            </div>
            <span className="capitalize text-[10px] font-semibold text-slate-800 dark:text-slate-200">
              {theme === 'dark' ? 'Oscuro' : 'Claro'}
            </span>
          </button>

          {/* Welcome Guided Tutorial */}
          <button
            onClick={() => {
              onOpenTutorial();
              onCloseMobile?.();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#161822] hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Ver tutorial interactivo de inicio"
          >
            <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
            <span>Tutorial de bienvenida</span>
          </button>

          {/* Shortcuts / Help */}
          <button
            onClick={() => {
              onOpenShortcuts();
              onCloseMobile?.();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#161822] hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Atajos de teclado (?)"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Atajos de teclado</span>
          </button>
        </div>
      </aside>
    </>
  );
};
