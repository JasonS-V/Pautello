import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Music,
  Music2,
  Piano,
  Check,
  CheckCircle2,
  Sliders,
  Edit2,
  Download,
} from '../ui/icons';
import { KeyboardInputMode } from '../../types/music';

export const TUTORIAL_STORAGE_KEY = 'pautello_tutorial_completed';

interface ShortcutTip {
  key: string;
  desc: string;
}

interface BulletTip {
  label: string;
  text: string;
  badge?: string;
}

interface TourStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  content: string;
  targetSelector: string | null;
  icon: React.ReactNode;
  bullets?: BulletTip[];
  shortcuts?: ShortcutTip[];
}

const KbdKey: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 text-[11px] font-mono font-bold text-amber-950 dark:text-amber-100 bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800/80 rounded-md shadow-[0_1px_1px_rgba(0,0,0,0.08)] select-none">
    {children}
  </kbd>
);

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    badge: '100% Libre & Profesional',
    title: '¡Te damos la bienvenida a Pautello!',
    subtitle: 'Tu estudio completo de partituras en el navegador',
    content:
      'Pautello está diseñado para estudiantes, profesores y compositores. Crea, edita y escucha partituras con calidad de edición clásica, sonido polifónico en tiempo real y exportación directa para atril sin registros ni muros de pago.',
    targetSelector: null,
    icon: <Sparkles className="w-6 h-6" />,
    bullets: [
      {
        label: 'Libre y sin suscripciones',
        text: 'Todas las herramientas habilitadas para siempre en tu navegador.',
        badge: '100% Gratis',
      },
      {
        label: 'Audio Polifónico en Vivo',
        text: 'Sintetizador interactivo que interpreta cada nota al instante.',
        badge: 'Sonido Real',
      },
      {
        label: 'Edición Clásica Estándar',
        text: 'Reglas de grabado profesional, claves de sol, fa y do, y múltiples pentagramas.',
        badge: 'Editorial',
      },
    ],
  },
  {
    id: 'toolbar',
    badge: 'Figuras & Alteraciones',
    title: 'Barra de Herramientas Superior',
    subtitle: 'Controla el ritmo, silencios y articulaciones',
    content:
      'En la barra superior seleccionas la duración y los modificadores de las notas. Puedes alternar figuras con un solo clic o con atajos numéricos rápidos:',
    targetSelector: '#toolbar-container',
    icon: <Sliders className="w-6 h-6" />,
    shortcuts: [
      {
        key: '1 – 6',
        desc: 'Duraciones: Redonda (1), Blanca (2), Negra (3), Corchea (4), Semicorchea (5), Fusa (6)',
      },
      { key: 'R o 0', desc: 'Modo Silencio: inserta silencios de la figura activa' },
      { key: '.', desc: 'Puntillo de aumento (añade 50% de duración a notas y silencios)' },
      { key: 'T', desc: 'Tresillo (3 notas en el espacio rítmico de 2)' },
      { key: '# / b / N', desc: 'Alteraciones: Sostenido, Bemol y Becuadro' },
    ],
  },
  {
    id: 'score-canvas',
    badge: 'Pentagrama Interactivo',
    title: 'Escritura y Arrastre en el Lienzo',
    subtitle: 'Introduce notas con el ratón o arrástralas libremente',
    content:
      'Escribe directamente en el pentagrama con precisión milimétrica y herramientas táctiles de edición musical:',
    targetSelector: '#score-canvas',
    icon: <Edit2 className="w-6 h-6" />,
    bullets: [
      {
        label: 'Nota fantasma guía',
        text: 'Al pasar el ratón verás la altura y nombre de la nota antes de hacer clic.',
      },
      {
        label: 'Arrastre (Drag & Drop)',
        text: 'Arrastra cualquier nota hacia arriba/abajo para cambiar su tono, o entre compases para moverla.',
      },
      {
        label: "Botón rápido '+'",
        text: 'Pasa el ratón por el final de cualquier compás: aparece un botón blanco con un "+" azul para añadir un compás al vuelo.',
      },
      {
        label: 'Borrado instantáneo',
        text: 'Selecciona cualquier elemento y pulsa Supr o Backspace para volverlo silencio.',
      },
    ],
  },
  {
    id: 'piano-input',
    badge: 'Entrada por Teclado',
    title: 'Modos de Entrada y Piano Virtual',
    subtitle: 'Elige cómo prefieres introducir tus notas con el teclado',
    content:
      'Pautello te permite escribir a la velocidad del pensamiento. Elige el método que te resulte más natural (puedes cambiarlo cuando quieras):',
    targetSelector: '#piano-container',
    icon: <Piano className="w-6 h-6" />,
  },
  {
    id: 'inspector',
    badge: 'Inspector de Propiedades',
    title: 'Panel Inspector: Tonalidad y Claves',
    subtitle: 'Configura armaduras, métricas, compases y dinámicas',
    content:
      'En el panel lateral derecho tienes el control editorial completo de tu obra y del compás seleccionado:',
    targetSelector: '#inspector-container',
    icon: <Music2 className="w-6 h-6" />,
    bullets: [
      {
        label: 'Tonalidad y Armadura',
        text: 'Selecciona la tonalidad (ej. Mi Mayor con 4 sostenidos) para que aparezca después de la clave.',
      },
      {
        label: 'Métricas y Tempo',
        text: 'Configura compases (4/4, 3/4, 6/8...) y el tempo en BPM con indicaciones como Allegro o Andante.',
      },
      {
        label: 'Claves e Instrumentos',
        text: 'Cambia entre Clave de Sol, Clave de Fa y Clave de Do con soporte para partituras de piano (gran pentagrama).',
      },
      {
        label: 'Matices y Expresión',
        text: 'Dinámicas (p, f, mf), ligaduras de unión y fraseo, marcas de ensayo ([A], [B]), calderón y voltas.',
      },
    ],
  },
  {
    id: 'playback-export',
    badge: 'Audio & Exportación',
    title: 'Escucha, Practica y Comparte',
    subtitle: 'Tu música lista para sonar y para el atril',
    content:
      'Todo tu progreso se guarda automáticamente en tu navegador local. Importar, exportar y compartir viven en el menú «Archivo», y la práctica y el audio en «Herramientas»:',
    targetSelector: '#navbar-menus',
    icon: <Download className="w-6 h-6" />,
    shortcuts: [
      { key: 'Espacio', desc: 'Reproducir / Pausar la partitura con cursor en tiempo real' },
      { key: 'Ctrl + Z / Y', desc: 'Deshacer y Rehacer con historial ilimitado de cambios' },
      { key: 'M', desc: 'Modo "Toca Conmigo" (evaluación en vivo con micrófono o teclado)' },
    ],
    bullets: [
      {
        label: 'Múltiples formatos',
        text: 'Exporta a PDF listo para impresión en atril, MIDI para tu DAW, WAV y MusicXML.',
      },
      {
        label: 'Autoguardado continuo',
        text: 'Tus partituras quedan protegidas en tu navegador sin requerir conexión a internet.',
      },
    ],
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  keyboardMode?: KeyboardInputMode;
  onSelectKeyboardMode?: (mode: KeyboardInputMode) => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  onComplete,
  keyboardMode = 'piano',
  onSelectKeyboardMode,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [dialogHeight, setDialogHeight] = useState<number>(420);
  const dialogRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStepIdx] || TOUR_STEPS[0];
  const isFirstStep = currentStepIdx === 0;
  const isLastStep = currentStepIdx === TOUR_STEPS.length - 1;

  // Actualización fluida de la posición del elemento objetivo
  const updateTargetPosition = useCallback(() => {
    if (!step.targetSelector) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [step]);

  // Medir la altura real del diálogo para anclarlo con precisión al borde
  useEffect(() => {
    if (!isOpen) return;
    if (dialogRef.current) {
      setDialogHeight(dialogRef.current.offsetHeight);
    }
  }, [isOpen, currentStepIdx]);

  useEffect(() => {
    if (!isOpen) return;
    updateTargetPosition();

    const handleResize = () => {
      updateTargetPosition();
      if (dialogRef.current) {
        setDialogHeight(dialogRef.current.offsetHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen, currentStepIdx, updateTargetPosition]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
      onComplete();
    } else {
      setCurrentStepIdx((prev) => prev + 1);
    }
  }, [isLastStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx((prev) => prev - 1);
    }
  }, [currentStepIdx]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    onClose();
  }, [onClose]);

  // Atajos de teclado durante el tutorial (←, →, Enter, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, handleSkip]);

  if (!isOpen) return null;

  // Coordenadas del Spotlight con margen visual
  const spotLeft = targetRect ? Math.max(6, targetRect.left - 6) : 0;
  const spotTop = targetRect ? Math.max(6, targetRect.top - 6) : 0;
  const spotWidth = targetRect
    ? Math.min(targetRect.width + 12, window.innerWidth - spotLeft - 6)
    : 0;
  const spotHeight = targetRect
    ? Math.min(targetRect.height + 12, window.innerHeight - spotTop - 6)
    : 0;

  // Cálculo de la posición anclada/pegada directamente al borde del panel objetivo
  const computeDialogStyle = () => {
    const margin = 16;
    const pad = 12; // separación elegante entre el borde y el diálogo
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const dW = Math.min(winW - margin * 2, 470);
    const dH = dialogHeight || 420;

    // Si no hay objetivo (Paso 1): Centrado fluido en el viewport
    if (!targetRect) {
      return {
        top: Math.max(margin, (winH - dH) / 2),
        left: Math.max(margin, (winW - dW) / 2),
        width: dW,
      };
    }

    const spotCenterX = targetRect.left + targetRect.width / 2;
    const spotCenterY = targetRect.top + targetRect.height / 2;

    const isTargetOnRight = targetRect.left > winW * 0.6;
    const isTargetOnLeft = targetRect.right < winW * 0.4;
    const isTargetOnBottom = spotCenterY > winH * 0.65;
    const isTargetOnTop = spotCenterY < winH * 0.35;

    let targetTop: number;
    let targetLeft: number;

    if (isTargetOnRight) {
      // Si el borde está a la derecha (Inspector): se coloca a la izquierda PEGANTE al borde
      targetLeft = targetRect.left - dW - pad;
      targetTop = Math.max(margin, Math.min(winH - dH - margin, spotCenterY - dH / 2));
    } else if (isTargetOnLeft) {
      // Si el borde está a la izquierda (Sidebar): se coloca a la derecha PEGANTE al borde
      targetLeft = targetRect.right + pad;
      targetTop = Math.max(margin, Math.min(winH - dH - margin, spotCenterY - dH / 2));
    } else if (isTargetOnBottom) {
      // Si el borde está abajo (Piano): se coloca ENCIMA PEGANTE al borde superior
      targetTop = targetRect.top - dH - pad;
      targetLeft = Math.max(margin, Math.min(winW - dW - margin, spotCenterX - dW / 2));
    } else if (isTargetOnTop) {
      // Si el borde está arriba (Toolbar): se coloca DEBAJO PEGANTE al borde inferior
      targetTop = targetRect.bottom + pad;
      targetLeft = Math.max(margin, Math.min(winW - dW - margin, spotCenterX - dW / 2));
    } else {
      // Para objetivos centrales (Score canvas): anclado en la parte inferior o superior cómoda
      targetTop = Math.max(margin, Math.min(winH - dH - margin, targetRect.bottom - dH - 24));
      targetLeft = Math.max(margin, Math.min(winW - dW - margin, (winW - dW) / 2));
    }

    // Clamping seguro para que nunca se desborde fuera de la ventana
    const clampedLeft = Math.max(margin, Math.min(winW - dW - margin, targetLeft));
    const clampedTop = Math.max(margin, Math.min(winH - dH - margin, targetTop));

    return {
      top: clampedTop,
      left: clampedLeft,
      width: dW,
    };
  };

  const dialogStyle = computeDialogStyle();
  const progressPercent = ((currentStepIdx + 1) / TOUR_STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-tour select-none no-print">
      {/* Fondo oscuro traslúcido */}
      <button
        type="button"
        aria-label="Cerrar guía interactiva"
        onClick={handleSkip}
        className="fixed inset-0 w-full h-full bg-slate-950/65 backdrop-blur-xs transition-opacity duration-300 border-none cursor-default"
      />

      {/* Spotlight interactivo: se desplaza, crece o se reduce fluidamente junto con el panel */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: spotTop,
            left: spotLeft,
            width: spotWidth,
            height: spotHeight,
            pointerEvents: 'none',
            transition: 'all 500ms cubic-bezier(0.2, 0.9, 0.25, 1)',
          }}
          className="rounded-2xl ring-4 ring-amber-500/85 shadow-[0_0_50px_rgba(245,158,11,0.45)]"
        />
      )}

      {/* Diálogo del tutorial: arrastre suave y crecimiento/reducción fluido pegado al borde */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${step.title} (paso ${currentStepIdx + 1} de ${TOUR_STEPS.length})`}
        style={{
          position: 'fixed',
          top: dialogStyle.top,
          left: dialogStyle.left,
          width: dialogStyle.width,
          transition:
            'top 500ms cubic-bezier(0.2, 0.9, 0.25, 1), left 500ms cubic-bezier(0.2, 0.9, 0.25, 1), width 500ms cubic-bezier(0.2, 0.9, 0.25, 1)',
        }}
        className="z-50 max-h-[88vh] overflow-y-auto bg-white dark:bg-studio-card text-slate-900 dark:text-white rounded-3xl p-6 sm:p-7 border border-amber-200/60 dark:border-amber-900/40 shadow-2xl flex flex-col justify-between"
      >
        {/* Barra de progreso superior en color ámbar */}
        <div className="w-full bg-amber-100/60 dark:bg-amber-950/40 h-1.5 rounded-full overflow-hidden mb-4">
          <div
            style={{ width: `${progressPercent}%` }}
            className="h-full bg-amber-500 transition-all duration-300 ease-out"
          />
        </div>

        {/* Cabecera: Badge ámbar, contador de paso y botón salir */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800/80">
              {step.badge}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Paso {currentStepIdx + 1} de {TOUR_STEPS.length}
            </span>
          </div>

          <button
            onClick={handleSkip}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
            title="Saltar tutorial (Esc)"
          >
            <span>Saltar</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Título e Icono principal en ámbar */}
        <div className="flex items-start gap-4 mb-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner bg-amber-500/10 text-amber-600 dark:text-amber-400">
            {step.icon}
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
              {step.title}
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {step.subtitle}
            </p>
          </div>
        </div>

        {/* Texto explicativo */}
        <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
          {step.content}
        </p>

        {/* Bloque de Viñetas / Características destacadas */}
        {step.bullets && (
          <div className="space-y-2 mb-4">
            {step.bullets.map((b, bIdx) => (
              <div
                key={bIdx}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100/70 dark:border-amber-900/30 text-xs"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{b.label}: </span>
                  <span className="text-slate-600 dark:text-slate-300">{b.text}</span>
                </div>
                {b.badge && (
                  <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                    {b.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bloque de Atajos de Teclado con estilo físico <KbdKey> */}
        {step.shortcuts && (
          <div className="space-y-1.5 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800/70 dark:text-amber-300/70 block mb-1">
              Atajos indispensables:
            </span>
            {step.shortcuts.map((sc, sIdx) => (
              <div
                key={sIdx}
                className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg bg-amber-50/30 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-xs"
              >
                <span className="text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs">
                  {sc.desc}
                </span>
                <KbdKey>{sc.key}</KbdKey>
              </div>
            ))}
          </div>
        )}

        {/* Selector Interactivo de Teclado (Paso: piano-input) */}
        {step.id === 'piano-input' && (
          <div className="space-y-2.5 mb-5">
            {/* Opción 1: Piano QWERTY */}
            <button
              type="button"
              onClick={() => onSelectKeyboardMode?.('piano')}
              className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer ${
                keyboardMode === 'piano'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-500/30 shadow-xs'
                  : 'border-slate-200 dark:border-studio-line hover:border-slate-300 dark:hover:border-studio-border bg-slate-50/50 dark:bg-studio-surface/50'
              }`}
            >
              <div
                className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                  keyboardMode === 'piano'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Piano className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    🎹 Modo Piano QWERTY
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                    Recomendado
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                  Toca como un piano real: <strong>A=Do, S=Re, D=Mi, F=Fa...</strong> y teclas
                  superiores <strong>W, E, T, Y, U</strong> para sostenidos (♯).{' '}
                  <strong>Z/X</strong> para cambiar octavas. Ideal para componer de oído.
                </p>
              </div>
              {keyboardMode === 'piano' && (
                <div className="shrink-0 mt-1 text-amber-600 dark:text-amber-400">
                  <Check className="w-5 h-5" />
                </div>
              )}
            </button>

            {/* Opción 2: Notación Clásica */}
            <button
              type="button"
              onClick={() => onSelectKeyboardMode?.('notation')}
              className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer ${
                keyboardMode === 'notation'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-500/30 shadow-xs'
                  : 'border-slate-200 dark:border-studio-line hover:border-slate-300 dark:hover:border-studio-border bg-slate-50/50 dark:bg-studio-surface/50'
              }`}
            >
              <div
                className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                  keyboardMode === 'notation'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Music className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    🎼 Modo Notación Clásica
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    MuseScore / Sibelius
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                  Entrada diatónica directa por letras anglosajonas:{' '}
                  <strong>C=Do, D=Re, E=Mi, F=Fa, G=Sol, A=La, B=Si</strong>. Preferido por quienes
                  ya usan editores tradicionales de partituras.
                </p>
              </div>
              {keyboardMode === 'notation' && (
                <div className="shrink-0 mt-1 text-amber-600 dark:text-amber-400">
                  <Check className="w-5 h-5" />
                </div>
              )}
            </button>
          </div>
        )}

        {/* Dots Indicadores de Progreso interactivos en ámbar */}
        <div className="flex items-center justify-center gap-1.5 my-3">
          {TOUR_STEPS.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentStepIdx(idx)}
              className={`h-2 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                idx === currentStepIdx
                  ? 'w-7 bg-amber-500'
                  : 'w-2 bg-amber-200/80 dark:bg-amber-950/60 hover:bg-amber-300 dark:hover:bg-amber-900'
              }`}
              title={`Paso ${idx + 1}: ${s.title}`}
            />
          ))}
        </div>

        {/* Acciones Inferiores (Anterior / Siguiente / ¡Empezar!) en ámbar */}
        <div className="flex items-center justify-between pt-3.5 border-t border-amber-200/70 dark:border-amber-900/40">
          <button
            onClick={handlePrev}
            disabled={isFirstStep}
            className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-amber-50/60 dark:hover:bg-amber-950/40 active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25"
          >
            {isLastStep ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>¡Empezar a Crear!</span>
              </>
            ) : (
              <>
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
