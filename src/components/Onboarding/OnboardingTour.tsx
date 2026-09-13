import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Music,
  Sliders,
  Keyboard,
  FileMusic,
  CheckCircle2,
  FileText,
} from 'lucide-react';

export const TUTORIAL_STORAGE_KEY = 'sonata_tutorial_completed';

interface TourStep {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  targetSelector: string | null;
  icon: React.ReactNode;
  accentColor: 'amber' | 'purple' | 'lime';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: '¡Bienvenido a Sonata Studio Libre!',
    subtitle: 'Tu creador y editor de partituras 100% gratuito',
    content:
      'Sonata está diseñado para estudiantes de música, profesores y compositores. Crea partituras profesionales en tu navegador, sin muros de pago, con sonido polifónico en vivo y exportación para atril.',
    targetSelector: null,
    icon: <Sparkles className="w-6 h-6 text-amber-500" />,
    accentColor: 'amber',
  },
  {
    id: 'score-canvas',
    title: 'Lienzo Interactivo de Partitura',
    subtitle: 'Notación vectorial en alta definición',
    content:
      'El centro de tu estudio musical. Haz clic en el pentagrama para agregar notas con precisión, o haz clic en cualquier nota para escucharla y ver su nombre pedagógico (Do-Re-Mi) flotando sobre ella.',
    targetSelector: '#score-canvas',
    icon: <Music className="w-6 h-6 text-lime-600 dark:text-[#bef264]" />,
    accentColor: 'lime',
  },
  {
    id: 'toolbar',
    title: 'Barra de Figuras y Alteraciones',
    subtitle: 'Valores rítmicos y alteraciones con atajos de teclado',
    content:
      'Selecciona figuras desde redonda hasta semicorchea (teclas 1 al 5). Activa el modo silencio con la tecla R, añade puntillos con la tecla "." y asigna sostenidos (♯) o bemoles (♭).',
    targetSelector: '#toolbar-container',
    icon: <FileText className="w-6 h-6 text-amber-600 dark:text-[#fed7aa]" />,
    accentColor: 'amber',
  },
  {
    id: 'virtual-piano',
    title: 'Teclado de Solfeo Interactivo',
    subtitle: 'Entrada visual y auditiva directa',
    content:
      'Toca las teclas del piano para escuchar las frecuencias reales e insertar notas automáticamente en la partitura. Además, se ilumina en sincronía perfecta cuando reproduces tu obra.',
    targetSelector: '#piano-container',
    icon: <Keyboard className="w-6 h-6 text-purple-600 dark:text-[#c4b5fd]" />,
    accentColor: 'purple',
  },
  {
    id: 'stat-cards',
    title: 'Tarjetas de Estructura y Audio',
    subtitle: 'Métrica, tonalidad, sintetizador y compases',
    content:
      'Accede rápidamente a la armadura y métrica (tarjeta ámbar), abre el sintetizador con timbres de piano, marimba, cuerdas y flauta (tarjeta morada), o añade compases con un solo toque (tarjeta verde).',
    targetSelector: '#stat-cards-container',
    icon: <Sliders className="w-6 h-6 text-lime-600 dark:text-[#bef264]" />,
    accentColor: 'lime',
  },
  {
    id: 'inspector',
    title: 'Inspector de Propiedades & Letras',
    subtitle: 'Edición fina de cada nota y armonía',
    content:
      'Escribe la letra de la canción (lyrics) para cada nota, cambia su altura diatónica con botones Do-Re-Mi, transporta por semitonos o saltos de octava (+8va/-8va) y cambia la tonalidad de la obra.',
    targetSelector: '#inspector-container',
    icon: <Sliders className="w-6 h-6 text-amber-600 dark:text-[#fed7aa]" />,
    accentColor: 'amber',
  },
  {
    id: 'transport',
    title: 'Deck de Reproducción y Tempo',
    subtitle: 'Escucha en tiempo real con cursor dinámico',
    content:
      'Presiona la barra espaciadora para reproducir o pausar. Ajusta el tempo en BPM numéricamente, activa el metrónomo rítmico o activa el bucle continuo (loop) para estudiar pasajes difíciles.',
    targetSelector: '#navbar-transport',
    icon: <Music className="w-6 h-6 text-purple-600 dark:text-[#c4b5fd]" />,
    accentColor: 'purple',
  },
  {
    id: 'import-export',
    title: 'Importación y Exportación Universal',
    subtitle: 'Compatible con MusicXML, MIDI y PDF para atril',
    content:
      'Abre archivos MusicXML de Sibelius o MuseScore, secuencias MIDI y proyectos guardados con detección automática de tonalidad. Exporta en PDF listo para imprimir en tamaño A4 o Carta.',
    targetSelector: '#sidebar-container',
    icon: <FileMusic className="w-6 h-6 text-lime-600 dark:text-[#bef264]" />,
    accentColor: 'lime',
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = TOUR_STEPS[currentStepIdx];
  const isFirstStep = currentStepIdx === 0;
  const isLastStep = currentStepIdx === TOUR_STEPS.length - 1;

  const updateTargetPosition = useCallback(() => {
    if (!step.targetSelector) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!isOpen) return;
    updateTargetPosition();

    const handleResize = () => updateTargetPosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen, currentStepIdx, updateTargetPosition]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLastStep) {
      handleFinish();
    } else {
      setCurrentStepIdx((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    onClose();
  };

  const handleFinish = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    onComplete();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center select-none animate-fadeIn no-print"
    >
      {/* Dimmed Background Overlay */}
      <div
        onClick={handleSkip}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Spotlight cutout highlight if target exists */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: Math.max(0, targetRect.top - 6),
            left: Math.max(0, targetRect.left - 6),
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            pointerEvents: 'none',
          }}
          className="rounded-2xl ring-4 ring-[#f59e0b] shadow-[0_0_50px_rgba(245,158,11,0.5)] z-50 transition-all duration-300"
        />
      )}

      {/* Floating Tutorial Dialog Box */}
      <div className="relative z-50 max-w-md w-full mx-4 bg-white dark:bg-[#161922] text-slate-900 dark:text-white rounded-3xl p-6 border border-slate-200 dark:border-[#282d40] shadow-2xl animate-scaleUp">
        {/* Top Header with step counter & skip */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                step.accentColor === 'amber'
                  ? 'bg-[#fed7aa] text-amber-950'
                  : step.accentColor === 'purple'
                  ? 'bg-[#c4b5fd] text-purple-950'
                  : 'bg-[#bef264] text-lime-950'
              }`}
            >
              Paso {currentStepIdx + 1} de {TOUR_STEPS.length}
            </span>
          </div>

          <button
            onClick={handleSkip}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <span>Saltar tutorial</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Icon & Titles */}
        <div className="flex items-start gap-3.5 mb-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
              step.accentColor === 'amber'
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : step.accentColor === 'purple'
                ? 'bg-purple-100 dark:bg-purple-900/30'
                : 'bg-lime-100 dark:bg-lime-900/30'
            }`}
          >
            {step.icon}
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
              {step.title}
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {step.subtitle}
            </p>
          </div>
        </div>

        {/* Content Body */}
        <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-normal">
          {step.content}
        </p>

        {/* Progress Dots Indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {TOUR_STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStepIdx(idx)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                idx === currentStepIdx
                  ? 'w-6 bg-[#f59e0b]'
                  : 'w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
              }`}
              title={`Ir al paso ${idx + 1}`}
            />
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-[#232836]">
          <button
            onClick={handlePrev}
            disabled={isFirstStep}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-[#1f2330] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <button
            onClick={handleNext}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              isLastStep
                ? 'bg-[#bef264] hover:bg-[#a3e635] text-lime-950'
                : 'bg-[#fed7aa] hover:bg-[#fcd34d] text-amber-950'
            }`}
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
