import React from 'react';
import {
  FileMusic,
  Github,
  GraduationCap,
  Heart,
  HelpCircle,
  Keyboard,
  Settings,
  Sparkles,
  Sun,
  Moon,
  X,
} from '../ui/icons';
import { NamingConvention } from '../../types/music';

interface SidebarProps {
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
  onOpenDonate: () => void;
  onOpenTutorial: () => void;
  onOpenShortcuts: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
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
  onOpenDonate,
  onOpenTutorial,
  onOpenShortcuts,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden no-print"
        />
      )}

      <aside
        id="sidebar-container"
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-studio-surface text-slate-700 dark:text-slate-300 flex flex-col justify-between p-5 border-r border-slate-200 dark:border-studio-border select-none shrink-0 transition-transform duration-200 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } min-h-screen overflow-y-auto`}
      >
        {/* Brand Logo & Name */}
        <div>
          <div className="flex items-center justify-between mb-7 px-1">
            <div className="flex items-center gap-3">
              {/* Brand icon */}
              <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                <img
                  src="./icon.svg"
                  alt="Pautello Logo"
                  className="w-8 h-8 rounded-[3.5px] shrink-0 select-none shadow-sm"
                  width={32}
                  height={32}
                />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white block leading-none">
                  Pautello
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
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation List */}
          <nav className="space-y-1" aria-label="Acciones principales">
            {/* Obras y Plantillas */}
            <button
              onClick={() => {
                onOpenTemplates();
                onCloseMobile?.();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover transition-all"
            >
              <div className="flex items-center gap-3">
                <FileMusic className="w-4 h-4" />
                <span>Obras y Plantillas</span>
              </div>
            </button>

            {/* Repositorio GitHub */}
            <a
              href="https://github.com/JasonS-V/Pautello"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onCloseMobile?.()}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-amber-700 dark:text-pastel-amber bg-amber-500/10 dark:bg-amber-400/10 hover:bg-amber-500/20 dark:hover:bg-amber-400/20 transition-all border border-amber-300/40 dark:border-amber-500/20"
              title="Repositorio oficial en GitHub: https://github.com/JasonS-V/Pautello"
            >
              <div className="flex items-center gap-3">
                <Github className="w-4 h-4 text-amber-500" />
                <span className="font-semibold">GitHub Repo</span>
              </div>
              <span className="text-[9px] bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-pastel-amber px-1.5 py-0.5 rounded font-bold tracking-wider">
                REPO
              </span>
            </a>

            {/* Conmutador: piano virtual de solfeo */}
            <button
              onClick={() => {
                onTogglePiano();
                onCloseMobile?.();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                !isPianoCollapsed
                  ? 'text-lime-700 dark:text-pastel-lime bg-lime-500/10 dark:bg-studio-elevated'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-studio-hover'
              }`}
            >
              <div className="flex items-center gap-3">
                <Keyboard className="w-4 h-4" />
                <span>Teclado Solfeo</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  !isPianoCollapsed
                    ? 'bg-pastel-lime/30 text-lime-900 dark:text-pastel-lime'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {!isPianoCollapsed ? 'ON' : 'OFF'}
              </span>
            </button>
          </nav>
        </div>

        {/* Center/Bottom: Lilac Promo Card (matching the reference image's card) */}
        <div className="my-5">
          <div className="bg-pastel-purple rounded-2xl p-4 text-purple-950 flex flex-col items-center text-center relative overflow-hidden shadow-sm">
            {/* Subtle decoration */}
            <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center mb-2 shadow-inner">
              <Heart className="w-5 h-5 fill-purple-900 text-purple-900" />
            </div>

            <h5 className="font-bold text-xs tracking-tight text-purple-950 leading-snug">
              ¿Creas o estudias música?
            </h5>
            <p className="text-[10px] text-purple-900/85 mt-1 font-medium leading-relaxed">
              Pautello es 100% libre y sin muros de pago. Tu apoyo mantiene este software gratuito
              para todos.
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

        {/* Sidebar Footer: preferencias, tema y ayuda */}
        <div className="space-y-1.5 border-t border-slate-200 dark:border-studio-border pt-4 text-xs text-slate-600 dark:text-slate-400">
          {/* Solfeggio / Latin toggle */}
          <button
            onClick={onToggleNamingConvention}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-studio-hover hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Alternar entre nomenclatura latina y cifrado americano"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Notación</span>
            </div>
            <span className="font-bold text-[10px] bg-slate-100 dark:bg-studio-elevated text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded border border-slate-200 dark:border-studio-line">
              {namingConvention === 'latin' ? 'Do-Re-Mi' : 'C-D-E'}
            </span>
          </button>

          {/* Note names display on staves */}
          <button
            onClick={onToggleShowNoteNames}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-studio-hover hover:text-slate-900 dark:hover:text-white transition-colors"
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
                  : 'bg-slate-100 dark:bg-studio-elevated text-slate-500 dark:text-slate-400'
              }`}
            >
              {showNoteNames ? 'Visible' : 'Oculto'}
            </span>
          </button>

          {/* Guitar Tablature Toggle */}
          {onToggleTablature && (
            <button
              onClick={onToggleTablature}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-studio-hover hover:text-slate-900 dark:hover:text-white transition-colors"
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
                    ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-pastel-amber'
                    : 'bg-slate-100 dark:bg-studio-elevated text-slate-500 dark:text-slate-400'
                }`}
              >
                {showTablature ? 'ON' : 'OFF'}
              </span>
            </button>
          )}

          {/* Dark / Light Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-studio-hover hover:text-slate-900 dark:hover:text-white transition-colors"
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

          {/* Tutorial de bienvenida */}
          <button
            onClick={() => {
              onOpenTutorial();
              onCloseMobile?.();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-studio-hover hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Ver tutorial interactivo de inicio"
          >
            <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
            <span>Tutorial de bienvenida</span>
          </button>

          {/* Atajos de teclado */}
          <button
            onClick={() => {
              onOpenShortcuts();
              onCloseMobile?.();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-studio-hover hover:text-slate-900 dark:hover:text-white transition-colors"
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
