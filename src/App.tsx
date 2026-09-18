import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { useScore } from './hooks/useScore';
import { useAudio } from './hooks/useAudio';
import { useKeyboard } from './hooks/useKeyboard';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Navbar } from './components/Navbar/Navbar';
import { StatusBar } from './components/Cards/StatusBar';
import {
  FilePlus,
  BookOpen,
  Upload,
  Download,
  Share2,
  Mic,
  Headphones,
  Target,
  Sliders,
  HelpCircle,
  GraduationCap,
} from './components/ui/icons';
import { DropdownItem } from './components/ui/Dropdown';
import { ScoreInspector } from './components/Inspector/ScoreInspector';
import { ScoreView } from './components/ScoreView/ScoreView';
import { Toolbar } from './components/Toolbar/Toolbar';
import { VirtualPiano } from './components/PianoRoll/VirtualPiano';
/**
 * Modales de diálogo cargados por demanda. Entre los diez suman miles de líneas
 * y ninguno hace falta para pintar el editor, así que con `lazy` cada uno viaja
 * en su propio chunk y solo se descarga al abrirse: el render los monta bajo un
 * `Suspense` únicamente cuando su condición se cumple.
 */
const ImportModal = lazy(() =>
  import('./components/Modals/ImportModal').then((module) => ({ default: module.ImportModal }))
);

const ExportModal = lazy(() =>
  import('./components/Modals/ExportModal').then((module) => ({ default: module.ExportModal }))
);

const TemplatesModal = lazy(() =>
  import('./components/Modals/TemplatesModal').then((module) => ({
    default: module.TemplatesModal,
  }))
);

const MixerModal = lazy(() =>
  import('./components/Modals/MixerModal').then((module) => ({ default: module.MixerModal }))
);

const ShortcutsModal = lazy(() =>
  import('./components/Modals/ShortcutsModal').then((module) => ({
    default: module.ShortcutsModal,
  }))
);

const DonateModal = lazy(() =>
  import('./components/Modals/DonateModal').then((module) => ({ default: module.DonateModal }))
);

const ShareModal = lazy(() =>
  import('./components/Modals/ShareModal').then((module) => ({ default: module.ShareModal }))
);

const TunerModal = lazy(() =>
  import('./components/Modals/TunerModal').then((module) => ({ default: module.TunerModal }))
);

const PlayAlongModal = lazy(() =>
  import('./components/Modals/PlayAlongModal').then((module) => ({
    default: module.PlayAlongModal,
  }))
);

const PracticeResultModal = lazy(() =>
  import('./components/Modals/PracticeResultModal').then((module) => ({
    default: module.PracticeResultModal,
  }))
);
import { OnboardingTour, TUTORIAL_STORAGE_KEY } from './components/Onboarding/OnboardingTour';
import { useMidiInput } from './hooks/useMidiInput';
import { usePracticeMode } from './hooks/usePracticeMode';
import { useMicPitch } from './hooks/useMicPitch';
import { usePlayAlong } from './hooks/usePlayAlong';
import { useTimeout } from './hooks/useTimeout';
import { decompressScoreFromHash } from './utils/shareUrl';
import { normalizeScore } from './utils/scoreSchema';

import {
  loadThemePreference,
  saveThemePreference,
  loadNamingPreference,
  saveNamingPreference,
  loadKeyboardModePreference,
  saveKeyboardModePreference,
} from './utils/storage';
import {
  NamingConvention,
  Pitch,
  Step,
  Accidental,
  Clef,
  KeyboardInputMode,
  getItemPitches,
} from './types/music';
import {
  pitchToMidi,
  midiToPitch,
  KEY_SIGNATURE_DATA,
  formatPitchName,
  DURATION_SPANISH_NAMES,
} from './constants/pitches';
import { audioEngine } from './audio/synth';

// Identificadores de los modales de la aplicación. El estado `activeModal`
// garantiza que solo haya uno abierto a la vez (Fase 6 del plan de UI).
type AppModal =
  | 'export'
  | 'import'
  | 'share'
  | 'shortcuts'
  | 'donate'
  | 'templates'
  | 'mixer'
  | 'tuner'
  | 'playalong';

export default function App() {
  const {
    score,
    saveState,
    selectedItemId,
    selectedMeasureIdx,
    selectedStaffIdx,
    setSelectedStaffIdx,
    toggleGrandStaff,
    isGrandStaff,
    activeDuration,
    setActiveDuration,
    activeAccidental,
    setActiveAccidental,
    isRestMode,
    setIsRestMode,
    isDotted,
    setIsDotted,
    isTuplet,
    setIsTuplet,
    toggleSelectedTuplet,
    activeVoice,
    setActiveVoice,
    setSelectedItemVoice,
    selectItem,
    insertNoteAt,
    insertRestAt,
    deleteSelected,
    transposeSelected,
    changeSelectedDuration,
    toggleSelectedDot,
    toggleSelectedTie,
    toggleSelectedSlur,
    setSelectedAccidental,
    setSelectedArticulation,
    setSelectedDynamic,
    updateSelectedLyric,
    updateSelectedChord,
    updateSelectedStep,
    moveScoreItem,
    addPitchToSelectedChord,
    removePitchFromSelectedChord,
    addMeasure,
    deleteMeasure,
    toggleMeasureRepeatStart,
    toggleMeasureRepeatEnd,
    setMeasureVolta,
    setMeasureAnacrusis,
    updateTitle,
    updateComposer,
    updateTempo,
    updateTimeSignature,
    updateKeySignature,
    transposeScore,
    changeKeySignatureAndTranspose,
    updateClef,
    loadTemplate,
    clearScore,
    undo,
    redo,
    canUndo,
    canRedo,
    viewMode,
    setViewMode,
    activePartStaffIdx,
    setActivePartStaffIdx,
    layoutMode,
    setLayoutMode,
    measuresPerSystem,
    setMeasuresPerSystem,
    toggleMeasureSystemBreak,
    toggleMeasurePageBreak,
    setMeasureMultimeasureRest,
    addStaff,
    removeStaff,
    updateStaffName,
    updateStaffClef,
    measureRange,
    clipboard,
    selectMeasure,
    extendMeasureRange,
    copySelectedMeasures,
    pasteMeasures,
    deleteSelectedMeasures,
    navigatePreviousItem,
    navigateNextItem,
    setSelectedOrnament,
    setSelectedHairpin,
    setSelectedNoteType,
    setSelectedFingering,
    setSelectedPedal,
    setMeasureBarline,
    setMeasureNavigationMark,
    setMeasureRehearsalMark,
    toggleMeasureRepeatSign,
    toggleMeasureCaesura,
    toggleMeasureBreathMark,
    setMeasureTempoText,
    setMeasureTimeSignatureChange,
    setMeasureKeySignatureChange,
    updateScoreMetadata,
    updateStaffShortName,
    updateStaffTransposition,
  } = useScore();

  const {
    playbackState,
    isLooping,
    metronomeEnabled,
    instrument,
    volume,
    togglePlay,
    stop,
    toggleLoop,
    toggleMetronome,
    setInstrument,
    setVolume,
  } = useAudio(score);

  // Layout & Navigation State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadThemePreference());
  const [namingConvention, setNamingConvention] = useState<NamingConvention>(() =>
    loadNamingPreference()
  );
  const [keyboardMode, setKeyboardMode] = useState<KeyboardInputMode>(() =>
    loadKeyboardModePreference()
  );
  const [pianoBaseOctave, setPianoBaseOctave] = useState<number>(4);
  const [isOctaveLockEnabled, setIsOctaveLockEnabled] = useState<boolean>(true);
  const [showNoteNames, setShowNoteNames] = useState<boolean>(true);
  const [showTablature, setShowTablature] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  // Bajo lg el Inspector funciona como cajón en superposición (overlay) y no
  // comprime el lienzo, así que basta con arrancar cerrado en pantallas
  // estrechas; no hace falta observar el ancho tras el montaje.
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 1024
  );
  const [isPianoCollapsed, setIsPianoCollapsed] = useState<boolean>(false);

  // Gestor de modales exclusivo: `activeModal` a lo sumo contiene uno.
  // El tour de bienvenida bloquea las aperturas mientras está activo.
  const [activeModal, setActiveModal] = useState<AppModal | null>(null);
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(() => {
    try {
      // Limpiar claves obsoletas de prototipos anteriores (Sonata/Stavio) para que no bloqueen el nuevo tutorial de Pautello
      localStorage.removeItem('stavio_tutorial_completed');
      localStorage.removeItem('sonata_tutorial_completed');
    } catch {
      // Almacenamiento no disponible
    }
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) !== 'true';
  });
  const openModal = useCallback(
    (id: AppModal) => {
      if (!isTutorialOpen) setActiveModal(id);
    },
    [isTutorialOpen]
  );
  const closeModal = useCallback(() => setActiveModal(null), []);

  // Interactive Practice Mode ("Toca conmigo")
  const {
    isActive: isPracticeActive,
    targetNote: practiceTargetNote,
    accuracy: practiceAccuracy,
    streak: practiceStreak,
    lastHitResult: practiceHitResult,
    isCompleted: isPracticeCompleted,
    startPractice,
    stopPractice,
    resetPractice,
    checkPlayedMidi,
  } = usePracticeMode({
    score,
    onNoteHit: (mIdx) => {
      selectItem(mIdx, null);
    },
  });

  // Web MIDI & External Keyboard state
  const [activeMidiPitch, setActiveMidiPitch] = useState<number | null>(null);
  // El resalte de la nota MIDI se apaga solo; una nota nueva reinicia el apagado.
  const midiFlash = useTimeout();

  const { isConnected: isMidiConnected, connectedDevices } = useMidiInput({
    onNoteOn: (midi) => {
      setActiveMidiPitch(midi);
      if (isPracticeActive) {
        checkPlayedMidi(midi);
      } else {
        const pitch = midiToPitch(midi);
        // insertNoteAt ya emite la nota al insertarla: no duplicar el sonido aquí.
        insertNoteAt(selectedMeasureIdx, pitch, undefined, undefined, true);
      }
      midiFlash.schedule(() => setActiveMidiPitch(null), 250);
    },
    onNoteOff: () => {
      setActiveMidiPitch(null);
    },
  });

  const toggleKeyboardMode = useCallback(() => {
    setKeyboardMode((prev) => {
      const next = prev === 'piano' ? 'notation' : 'piano';
      saveKeyboardModePreference(next);
      return next;
    });
  }, []);

  const handleSelectKeyboardMode = useCallback((mode: KeyboardInputMode) => {
    setKeyboardMode(mode);
    saveKeyboardModePreference(mode);
  }, []);

  const handleShiftPianoOctave = useCallback((delta: number) => {
    setPianoBaseOctave((prev) => Math.max(1, Math.min(8, prev + delta)));
  }, []);

  const handleToggleOctaveLock = useCallback(() => {
    setIsOctaveLockEnabled((prev) => !prev);
  }, []);

  const handleInsertPitchDirect = useCallback(
    (pitch: Pitch) => {
      const midi = pitchToMidi(pitch);
      setActiveMidiPitch(midi);
      midiFlash.schedule(() => setActiveMidiPitch(null), 250);
      if (isPracticeActive) {
        audioEngine.playMidi(midi, 0.4, 0.85);
        checkPlayedMidi(midi);
      } else {
        insertNoteAt(selectedMeasureIdx, pitch, undefined, undefined, true);
      }
    },
    [isPracticeActive, checkPlayedMidi, insertNoteAt, selectedMeasureIdx, midiFlash]
  );

  const handleAddPitchDirectToChord = useCallback(
    (pitch: Pitch) => {
      const midi = pitchToMidi(pitch);
      setActiveMidiPitch(midi);
      midiFlash.schedule(() => setActiveMidiPitch(null), 250);
      addPitchToSelectedChord(pitch);
    },
    [addPitchToSelectedChord, midiFlash]
  );

  // (Afinador y Play-Along se abren vía el gestor `activeModal`.)

  // Phase 3: Play-Along Multimedia Backing Track
  const {
    audioName: playAlongName,
    audioDuration: playAlongDuration,
    currentTime: playAlongTime,
    isPlaying: isPlayAlongPlaying,
    playbackRate: playAlongSpeed,
    volume: playAlongVolume,
    isAudioLoaded: isPlayAlongLoaded,
    loadAudioFile: loadPlayAlongAudio,
    removeAudio: removePlayAlongAudio,
    play: playPlayAlong,
    pause: pausePlayAlong,
    stop: stopPlayAlong,
    seek: seekPlayAlong,
    setPlaybackRate: setPlayAlongSpeed,
    setVolume: setPlayAlongVolume,
  } = usePlayAlong();

  // Phase 3: Real-time Microphone Pitch Detection for Acoustic Practice
  const { startListening: startMicPractice, stopListening: stopMicPractice } = useMicPitch({
    onPitchDetected: (res) => {
      if (isPracticeActive) {
        checkPlayedMidi(res.midi);
      }
    },
  });

  const handleTogglePlay = () => {
    togglePlay();
    if (isPlayAlongLoaded) {
      if (playbackState.isPlaying) {
        pausePlayAlong();
      } else {
        playPlayAlong();
      }
    }
  };

  // Memorizado: entra en las dependencias del useMemo de `toolsItems` y sin esto
  // el menú de Herramientas se reconstruye en cada render.
  const handleStop = useCallback(() => {
    stop();
    if (isPlayAlongLoaded) {
      stopPlayAlong();
    }
  }, [stop, isPlayAlongLoaded, stopPlayAlong]);

  // Recuerda el último volumen audible para que el botón de mute lo restaure
  const lastAudibleVolumeRef = useRef<number>(0.8);

  const handleToggleMute = () => {
    if (volume > 0) {
      lastAudibleVolumeRef.current = volume;
      setVolume(0);
    } else {
      setVolume(lastAudibleVolumeRef.current);
    }
  };

  // Auto-load shared score from URL hash on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#share=')) {
      decompressScoreFromHash(window.location.hash)
        .then((sharedScore) => {
          // El enlace lo pudo generar cualquier versión de la app: se valida antes de cargarlo.
          const normalized = sharedScore ? normalizeScore(sharedScore) : null;
          if (!normalized) {
            if (sharedScore)
              console.error('El enlace compartido no contiene una partitura legible.');
            return;
          }
          loadTemplate({
            id: 'shared',
            name: normalized.title || 'Partitura Compartida',
            description: `Por ${normalized.composer || 'Anónimo'} (abierta desde enlace)`,
            score: normalized,
          });
        })
        .catch((err) => console.error('Error al cargar enlace de partitura:', err));
    }
  }, [loadTemplate]);

  // Sync theme with HTML root class
  useEffect(() => {
    saveThemePreference(theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleNamingConvention = () => {
    setNamingConvention((prev) => {
      const next = prev === 'latin' ? 'english' : 'latin';
      saveNamingPreference(next);
      return next;
    });
  };

  // Active MIDI pitch for visual feedback on the Virtual Piano during playback
  const activePlaybackMidi = useMemo(() => {
    if (!playbackState.isPlaying) return null;
    const staff = score.staves[0];
    if (!staff) return null;
    const measure = staff.measures[playbackState.currentMeasureIndex];
    if (!measure) return null;
    const item = measure.items[playbackState.currentItemIndex];
    if (item && item.type === 'note' && item.pitch) {
      return pitchToMidi(item.pitch);
    }
    return null;
  }, [playbackState, score]);

  // Total notes count
  const totalNotes = useMemo(() => {
    const staff = score.staves[0];
    if (!staff) return 0;
    return staff.measures.reduce(
      (acc, m) => acc + m.items.filter((it) => it.type === 'note').length,
      0
    );
  }, [score]);

  // Estimated duration in M:SS
  const estimatedDuration = useMemo(() => {
    const staff = score.staves[0];
    if (!staff || score.tempo <= 0) return '0:00';
    const measureCount = staff.measures.length;
    const secondsPerMeasure = (score.timeSignature.beats * 60) / score.tempo;
    const totalSeconds = Math.round(measureCount * secondsPerMeasure);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [score]);

  // Texto que se anuncia al cambiar la selección. El pentagrama es puramente
  // visual: sin este anuncio, quien navega con el teclado y un lector de
  // pantalla mueve el resaltado sin recibir ninguna confirmación de dónde está.
  const selectionAnnouncement = useMemo(() => {
    const total = score.staves[0]?.measures.length ?? 0;
    if (total === 0) return 'Partitura vacía.';

    if (measureRange) {
      const first = Math.min(measureRange.start, measureRange.end) + 1;
      const last = Math.max(measureRange.start, measureRange.end) + 1;
      return first === last
        ? `Compás ${first} de ${total}.`
        : `Compases ${first} a ${last} de ${total} seleccionados.`;
    }

    const measureNumber = selectedMeasureIdx + 1;
    const item = selectedItemId
      ? score.staves[0]?.measures[selectedMeasureIdx]?.items.find((it) => it.id === selectedItemId)
      : null;

    if (!item) return `Compás ${measureNumber} de ${total}.`;

    const durationName = DURATION_SPANISH_NAMES[item.duration].toLowerCase();
    if (item.type === 'rest') {
      return `Compás ${measureNumber}: silencio de ${durationName}.`;
    }

    const names = getItemPitches(item)
      .map((pitch) => formatPitchName(pitch, namingConvention))
      .join(', ');
    return `Compás ${measureNumber}: ${names}, ${durationName}.`;
  }, [score, selectedItemId, selectedMeasureIdx, measureRange, namingConvention]);

  // Keyboard shortcut handlers
  useKeyboard({
    inputMode: keyboardMode,
    pianoBaseOctave,
    onShiftOctave: handleShiftPianoOctave,
    onInsertPitchDirect: handleInsertPitchDirect,
    onAddPitchDirectToChord: handleAddPitchDirectToChord,
    onTogglePlay: handleTogglePlay,
    onDeleteSelected: deleteSelected,
    onAddMeasure: () => addMeasure(selectedMeasureIdx),
    onExtendMeasureRange: extendMeasureRange,
    onTransposeSelected: transposeSelected,
    onSelectDuration: (dur) => {
      setActiveDuration(dur);
    },
    onInsertNoteStep: (step: Step) => {
      const pitch: Pitch = {
        step,
        octave: pianoBaseOctave,
        accidental: activeAccidental,
      };
      insertNoteAt(selectedMeasureIdx, pitch, undefined, undefined, true);
    },
    onAddPitchToChord: (step: Step) => {
      const pitch: Pitch = {
        step,
        octave: pianoBaseOctave,
        accidental: activeAccidental,
      };
      addPitchToSelectedChord(pitch);
    },
    onToggleRestMode: () => setIsRestMode((prev) => !prev),
    onToggleDot: () => {
      setIsDotted((prev) => !prev);
      if (selectedItemId) toggleSelectedDot();
    },
    onToggleTuplet: () => {
      setIsTuplet((prev) => !prev);
      if (selectedItemId) toggleSelectedTuplet();
    },
    onToggleTie: () => {
      if (selectedItemId) toggleSelectedTie();
    },
    onToggleSlur: () => {
      if (selectedItemId) toggleSelectedSlur();
    },
    onSetAccidental: (acc: Accidental) => {
      setActiveAccidental(acc);
      if (selectedItemId) setSelectedAccidental(acc);
    },
    onUndo: undo,
    onRedo: redo,
    onDeselect: () => selectItem(selectedMeasureIdx, null),
    onOpenShortcuts: () => openModal('shortcuts'),
    onNavigatePreviousItem: navigatePreviousItem,
    onNavigateNextItem: navigateNextItem,
    onCopyMeasureRange: copySelectedMeasures,
    onPasteMeasureRange: pasteMeasures,
    onToggleVoice: () => setActiveVoice((prev) => (prev === 1 ? 2 : 1)),
    onSelectVoice: setActiveVoice,
  });

  const primaryClef: Clef = score.staves[0]?.clef || 'treble';
  const keyLabel = KEY_SIGNATURE_DATA[score.keySignature]?.name || score.keySignature;

  const fileItems: DropdownItem[] = useMemo(
    () => [
      {
        id: 'new',
        label: 'Nueva Partitura en Blanco',
        description: 'Limpiar lienzo actual',
        icon: <FilePlus className="w-4 h-4 text-amber-500" />,
        onSelect: () => {
          if (window.confirm('¿Deseas reiniciar la partitura con un lienzo en blanco?')) {
            clearScore();
          }
        },
      },
      {
        id: 'templates',
        label: 'Obras y Plantillas...',
        description: 'Obras maestras y ejercicios',
        icon: <BookOpen className="w-4 h-4 text-purple-500" />,
        onSelect: () => openModal('templates'),
      },
      {
        id: 'import',
        label: 'Importar...',
        description: 'MusicXML, MIDI, JSON, PDF',
        icon: <Upload className="w-4 h-4 text-blue-500" />,
        onSelect: () => openModal('import'),
      },
      {
        id: 'export',
        label: 'Exportar...',
        description: 'PDF, MIDI, WAV, MusicXML',
        icon: <Download className="w-4 h-4 text-emerald-500" />,
        onSelect: () => openModal('export'),
      },
      {
        id: 'share',
        label: 'Compartir Enlace',
        description: 'Generar URL para compartir',
        icon: <Share2 className="w-4 h-4 text-blue-500" />,
        onSelect: () => openModal('share'),
      },
    ],
    [clearScore, openModal]
  );

  const toolsItems: DropdownItem[] = useMemo(
    () => [
      {
        id: 'tuner',
        label: 'Afinador en Vivo',
        description: 'Detección por micrófono',
        icon: <Mic className="w-4 h-4 text-lime-600 dark:text-pastel-lime" />,
        onSelect: () => openModal('tuner'),
      },
      {
        id: 'playalong',
        label: 'Play-Along Multimedia',
        description: 'Pista de audio MP3',
        icon: <Headphones className="w-4 h-4 text-purple-500 dark:text-pastel-purple" />,
        onSelect: () => openModal('playalong'),
      },
      {
        id: 'practice',
        label: isPracticeActive ? 'Detener Práctica' : 'Modo Práctica ("Toca conmigo")',
        description: 'Espera a que toques cada nota',
        active: isPracticeActive,
        icon: <Target className="w-4 h-4 text-lime-500" />,
        onSelect: () => {
          if (isPracticeActive) {
            stopMicPractice();
            stopPractice();
          } else {
            handleStop();
            startPractice();
            startMicPractice().catch(() => {});
          }
        },
      },
      {
        id: 'mixer',
        label: 'Sintetizador & Audio',
        description: 'Efectos, volumen y tempo',
        icon: <Sliders className="w-4 h-4 text-purple-500" />,
        onSelect: () => openModal('mixer'),
      },
      {
        id: 'shortcuts',
        label: 'Atajos de Teclado',
        description: 'Ver combinaciones rápidas (?)',
        shortcut: '?',
        icon: <HelpCircle className="w-4 h-4 text-slate-400" />,
        onSelect: () => openModal('shortcuts'),
      },
      {
        id: 'tutorial',
        label: 'Tutorial de Bienvenida',
        description: 'Guía interactiva inicial',
        icon: <GraduationCap className="w-4 h-4 text-amber-500" />,
        onSelect: () => setIsTutorialOpen(true),
      },
    ],
    [
      isPracticeActive,
      stopMicPractice,
      stopPractice,
      handleStop,
      startPractice,
      startMicPractice,
      openModal,
    ]
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden print:h-auto print:overflow-visible print:block print:w-full print:max-w-full bg-slate-100 dark:bg-studio-bg text-slate-900 dark:text-slate-100 font-sans transition-colors">
      {/* 1. Left Sidebar Navigation (Matching reference design with full light/dark support) */}
      <Sidebar
        theme={theme}
        onToggleTheme={toggleTheme}
        namingConvention={namingConvention}
        onToggleNamingConvention={toggleNamingConvention}
        showNoteNames={showNoteNames}
        onToggleShowNoteNames={() => setShowNoteNames((prev) => !prev)}
        showTablature={showTablature}
        onToggleTablature={() => setShowTablature((prev) => !prev)}
        isPianoCollapsed={isPianoCollapsed}
        onTogglePiano={() => setIsPianoCollapsed((prev) => !prev)}
        onOpenTemplates={() => openModal('templates')}
        onOpenShare={() => openModal('share')}
        onOpenDonate={() => openModal('donate')}
        onOpenTutorial={() => setIsTutorialOpen(true)}
        onOpenShortcuts={() => openModal('shortcuts')}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Main Central Studio Deck */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto print:overflow-visible print:block print:w-full print:max-w-full print:h-auto bg-slate-50 dark:bg-studio-bg transition-all duration-300 ease-in-out">
        {/* Top Navbar / Greeting Header */}
        <Navbar
          score={score}
          onUpdateTitle={updateTitle}
          onUpdateComposer={updateComposer}
          onUpdateTempo={updateTempo}
          isPlaying={playbackState.isPlaying}
          onTogglePlay={handleTogglePlay}
          onStop={handleStop}
          isLooping={isLooping}
          onToggleLoop={toggleLoop}
          metronomeEnabled={metronomeEnabled}
          onToggleMetronome={toggleMetronome}
          volume={volume}
          onSetVolume={setVolume}
          onToggleMute={handleToggleMute}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          isMidiConnected={isMidiConnected}
          connectedDevices={connectedDevices}
          isPracticeMode={isPracticeActive}
          practiceAccuracy={practiceAccuracy}
          practiceStreak={practiceStreak}
          onTogglePractice={() => {
            if (isPracticeActive) {
              stopMicPractice();
              stopPractice();
            } else {
              handleStop();
              startPractice();
              startMicPractice().catch(() => {});
            }
          }}
          fileItems={fileItems}
          toolsItems={toolsItems}
          activeVoice={activeVoice}
          onSelectVoice={setActiveVoice}
        />

        {/* Center Stage: Card container for Score Canvas + Modern Toolbar */}
        <div className="flex-1 px-4 sm:px-6 pb-4 flex flex-col min-h-0 print:px-0 print:pb-0 print:block print:w-full print:max-w-full">
          <div className="flex-1 flex flex-col bg-white dark:bg-studio-card rounded-2xl border border-slate-200 dark:border-studio-border shadow-md overflow-hidden min-h-0 transition-colors print:rounded-none print:border-none print:shadow-none print:overflow-visible print:block print:w-full print:max-w-full">
            {/* Embedded Toolbar for Note Durations & Accidentals with full reactive selection updates */}
            <div id="toolbar-container">
              <Toolbar
                activeDuration={activeDuration}
                onSelectDuration={(dur) => {
                  setActiveDuration(dur);
                }}
                isRestMode={isRestMode}
                onToggleRestMode={() => setIsRestMode((prev) => !prev)}
                activeAccidental={activeAccidental}
                onSelectAccidental={(acc) => {
                  setActiveAccidental(acc);
                  if (selectedItemId) setSelectedAccidental(acc);
                }}
                isDotted={isDotted}
                onToggleDot={() => {
                  setIsDotted((prev) => !prev);
                  if (selectedItemId) toggleSelectedDot();
                }}
                isTuplet={isTuplet}
                onToggleTuplet={() => {
                  setIsTuplet((prev) => !prev);
                  if (selectedItemId) toggleSelectedTuplet();
                }}
                isTied={(() => {
                  if (!selectedItemId) return false;
                  for (const staff of score.staves) {
                    const it = staff.measures[selectedMeasureIdx]?.items.find(
                      (i) => i.id === selectedItemId
                    );
                    if (it) return !!it.isTied;
                  }
                  return false;
                })()}
                onToggleTie={() => {
                  if (selectedItemId) toggleSelectedTie();
                }}
              />
            </div>

            {/* Interactive Vector Score Canvas */}
            <div
              id="score-canvas"
              role="region"
              aria-label="Partitura"
              aria-describedby="score-selection-status"
              className="flex-1 flex overflow-auto relative print:overflow-visible print:block print:w-full print:max-w-full"
            >
              {/* Estado de la selección para lectores de pantalla. Va dentro de
                  la región para que `aria-describedby` lo resuelva. */}
              <p id="score-selection-status" aria-live="polite" className="sr-only">
                {selectionAnnouncement}
              </p>

              <ScoreView
                score={score}
                selectedItemId={selectedItemId}
                selectedMeasureIdx={selectedMeasureIdx}
                selectedStaffIdx={selectedStaffIdx}
                onSelectItem={(mIdx, itemId, sIdx) => selectItem(mIdx, itemId, sIdx)}
                onInsertNoteAt={(mIdx, pitch, sIdx) =>
                  insertNoteAt(mIdx, pitch, undefined, sIdx, true)
                }
                onInsertRestAt={(mIdx, sIdx) => insertRestAt(mIdx, undefined, sIdx, true)}
                onDeleteMeasure={deleteMeasure}
                activeDuration={activeDuration}
                isDotted={isDotted}
                isTuplet={isTuplet}
                activeAccidental={activeAccidental}
                isRestMode={isRestMode}
                namingConvention={namingConvention}
                showNoteNames={showNoteNames}
                playbackState={playbackState}
                showTablature={showTablature}
                practiceTargetNote={
                  isPracticeActive && practiceTargetNote
                    ? {
                        measureIdx: practiceTargetNote.measureIdx,
                        itemIdx: practiceTargetNote.itemIdx,
                      }
                    : null
                }
                practiceHitResult={practiceHitResult}
                viewMode={viewMode}
                activePartStaffIdx={activePartStaffIdx}
                layoutMode={layoutMode}
                measuresPerSystem={measuresPerSystem}
                onToggleSystemBreak={toggleMeasureSystemBreak}
                onTogglePageBreak={toggleMeasurePageBreak}
                onSetMultimeasureRest={setMeasureMultimeasureRest}
                measureRange={measureRange}
                onSelectMeasure={selectMeasure}
                activeOctave={pianoBaseOctave}
                isOctaveLockEnabled={isOctaveLockEnabled}
                onMoveItem={moveScoreItem}
                onAddMeasureAfter={addMeasure}
              />
            </div>
          </div>
        </div>

        {/* Bottom Integrated Piano Roll (Collapsible) */}
        {/* El id #piano-container vive en la raíz de VirtualPiano: no duplicarlo aquí */}
        <div>
          <VirtualPiano
            onNoteClick={(pitch) => {
              if (isPracticeActive) {
                checkPlayedMidi(pitchToMidi(pitch));
              } else {
                insertNoteAt(selectedMeasureIdx, pitch, undefined, undefined, true);
              }
            }}
            namingConvention={namingConvention}
            activePlaybackMidi={activePlaybackMidi}
            activeMidiPitch={activeMidiPitch}
            isMidiConnected={isMidiConnected}
            connectedDevices={connectedDevices}
            collapsed={isPianoCollapsed}
            onToggleCollapse={() => setIsPianoCollapsed((prev) => !prev)}
            keyboardMode={keyboardMode}
            onToggleKeyboardMode={toggleKeyboardMode}
            pianoBaseOctave={pianoBaseOctave}
            onShiftOctave={handleShiftPianoOctave}
            onSelectOctave={(oct) => setPianoBaseOctave(oct)}
            isOctaveLockEnabled={isOctaveLockEnabled}
            onToggleOctaveLock={handleToggleOctaveLock}
          />
        </div>

        {/* Bottom status bar (IDE-style footer): estructura, conteo y autoguardado */}
        <StatusBar
          saveState={saveState}
          timeSignature={`${score.timeSignature.beats}/${score.timeSignature.beatType}`}
          keyLabel={keyLabel}
          clefLabel={`Clave de ${primaryClef === 'treble' ? 'Sol' : primaryClef === 'bass' ? 'Fa' : 'Do'}`}
          measureCount={score.staves[0]?.measures.length || 0}
          totalNotes={totalNotes}
          duration={estimatedDuration}
          onOpenStructure={() => setIsInspectorCollapsed(false)}
        />
      </main>

      {/* 3. Right Inspector Column (Collapsible & Responsive with stacked cards) */}
      <ScoreInspector
        score={score}
        selectedMeasureIdx={selectedMeasureIdx}
        selectedItemId={selectedItemId}
        namingConvention={namingConvention}
        clef={primaryClef}
        onUpdateClef={updateClef}
        timeSignature={score.timeSignature}
        onUpdateTimeSignature={updateTimeSignature}
        keySignature={score.keySignature}
        onUpdateKeySignature={updateKeySignature}
        onChangeKeySignatureAndTranspose={changeKeySignatureAndTranspose}
        onTransposeScore={transposeScore}
        onAddMeasure={addMeasure}
        onDeleteMeasure={() => deleteMeasure(selectedMeasureIdx)}
        onDeleteSelected={deleteSelected}
        onTransposeSelected={transposeSelected}
        onChangeDuration={changeSelectedDuration}
        onToggleDot={toggleSelectedDot}
        onToggleTuplet={toggleSelectedTuplet}
        onToggleTie={toggleSelectedTie}
        onToggleSlur={toggleSelectedSlur}
        onSetAccidental={setSelectedAccidental}
        onSetArticulation={setSelectedArticulation}
        onSetDynamic={setSelectedDynamic}
        onUpdateLyric={updateSelectedLyric}
        onUpdateChord={updateSelectedChord}
        onUpdateStep={updateSelectedStep}
        onAddPitchToChord={addPitchToSelectedChord}
        onRemovePitchFromChord={removePitchFromSelectedChord}
        onClearScore={clearScore}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        isGrandStaff={isGrandStaff}
        onToggleGrandStaff={toggleGrandStaff}
        onToggleRepeatStart={toggleMeasureRepeatStart}
        onToggleRepeatEnd={toggleMeasureRepeatEnd}
        onSetVolta={setMeasureVolta}
        onSetAnacrusis={setMeasureAnacrusis}
        onToggleSystemBreak={toggleMeasureSystemBreak}
        onTogglePageBreak={toggleMeasurePageBreak}
        onSetMultimeasureRest={setMeasureMultimeasureRest}
        measuresPerSystem={measuresPerSystem}
        onSetMeasuresPerSystem={setMeasuresPerSystem}
        layoutMode={layoutMode}
        onSelectLayoutMode={setLayoutMode}
        viewMode={viewMode}
        activePartStaffIdx={activePartStaffIdx}
        onSelectViewMode={setViewMode}
        onSelectPartStaffIdx={setActivePartStaffIdx}
        selectedStaffIdx={selectedStaffIdx}
        onSelectStaff={setSelectedStaffIdx}
        onAddStaff={addStaff}
        onRemoveStaff={removeStaff}
        onUpdateStaffName={updateStaffName}
        onUpdateStaffClef={updateStaffClef}
        measureRange={measureRange}
        onCopyMeasureRange={copySelectedMeasures}
        onPasteMeasureRange={pasteMeasures}
        onDeleteSelectedMeasures={deleteSelectedMeasures}
        hasClipboardMeasures={!!(clipboard && clipboard.stavesMeasures.length > 0)}
        isCollapsed={isInspectorCollapsed}
        onToggleCollapse={() => setIsInspectorCollapsed((prev) => !prev)}
        onSetOrnament={setSelectedOrnament}
        onSetHairpin={setSelectedHairpin}
        onSetNoteType={setSelectedNoteType}
        onSetFingering={setSelectedFingering}
        onSetPedal={setSelectedPedal}
        onSetBarline={setMeasureBarline}
        onSetNavigationMark={setMeasureNavigationMark}
        onSetRehearsalMark={setMeasureRehearsalMark}
        onToggleRepeatSign={toggleMeasureRepeatSign}
        onToggleCaesura={toggleMeasureCaesura}
        onToggleBreathMark={toggleMeasureBreathMark}
        onSetTempoText={setMeasureTempoText}
        onSetTimeSignatureChange={setMeasureTimeSignatureChange}
        onSetKeySignatureChange={setMeasureKeySignatureChange}
        onUpdateScoreMetadata={updateScoreMetadata}
        onUpdateStaffShortName={updateStaffShortName}
        onUpdateStaffTransposition={updateStaffTransposition}
        onSetItemVoice={setSelectedItemVoice}
      />

      {/* Dialog Modals. Solo se monta el que está abierto, para que su código
          llegue en su propio chunk y no en el arranque. */}
      <Suspense fallback={null}>
        {activeModal === 'import' && (
          <ImportModal
            isOpen
            onClose={closeModal}
            onImportScore={(importedScore) => {
              loadTemplate({
                id: 'imported',
                name: importedScore.title,
                description: 'Partitura importada',
                score: importedScore,
              });
            }}
          />
        )}

        {activeModal === 'export' && (
          <ExportModal
            score={score}
            instrument={instrument}
            isOpen
            onClose={closeModal}
            onOpenImport={() => openModal('import')}
            onImportScore={(importedScore) => {
              loadTemplate({
                id: 'imported',
                name: importedScore.title,
                description: 'Partitura importada',
                score: importedScore,
              });
            }}
          />
        )}

        {activeModal === 'templates' && (
          <TemplatesModal isOpen onClose={closeModal} onLoadTemplate={loadTemplate} />
        )}

        {activeModal === 'mixer' && (
          <MixerModal
            isOpen
            onClose={closeModal}
            instrument={instrument}
            onSetInstrument={setInstrument}
            volume={volume}
            onSetVolume={setVolume}
            tempo={score.tempo}
            onSetTempo={updateTempo}
            metronomeEnabled={metronomeEnabled}
            onToggleMetronome={toggleMetronome}
          />
        )}

        {activeModal === 'shortcuts' && (
          <ShortcutsModal
            isOpen
            onClose={closeModal}
            keyboardMode={keyboardMode}
            onToggleKeyboardMode={toggleKeyboardMode}
          />
        )}

        {activeModal === 'donate' && <DonateModal isOpen onClose={closeModal} />}

        {activeModal === 'share' && <ShareModal score={score} isOpen onClose={closeModal} />}

        {/* Real-time Chromatic Tuner Modal */}
        {activeModal === 'tuner' && (
          <TunerModal isOpen onClose={closeModal} namingConvention={namingConvention} />
        )}

        {/* Play-Along Audio Backing Track Modal */}
        {activeModal === 'playalong' && (
          <PlayAlongModal
            isOpen
            onClose={closeModal}
            audioName={playAlongName}
            audioDuration={playAlongDuration}
            currentTime={playAlongTime}
            isPlaying={isPlayAlongPlaying}
            playbackRate={playAlongSpeed}
            volume={playAlongVolume}
            isAudioLoaded={isPlayAlongLoaded}
            onLoadAudio={loadPlayAlongAudio}
            onRemoveAudio={removePlayAlongAudio}
            onPlay={playPlayAlong}
            onPause={pausePlayAlong}
            onStop={stopPlayAlong}
            onSeek={seekPlayAlong}
            onSetPlaybackRate={setPlayAlongSpeed}
            onSetVolume={setPlayAlongVolume}
          />
        )}

        {/* Practice Mode Completion Scorecard */}
        {isPracticeCompleted && (
          <PracticeResultModal
            isOpen
            accuracy={practiceAccuracy}
            streak={practiceStreak}
            onRestart={() => {
              resetPractice();
              startPractice();
            }}
            onClose={stopPractice}
          />
        )}
      </Suspense>

      {/* Interactive First-Launch Onboarding Walkthrough */}
      <OnboardingTour
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onComplete={() => setIsTutorialOpen(false)}
        keyboardMode={keyboardMode}
        onSelectKeyboardMode={handleSelectKeyboardMode}
      />
    </div>
  );
}
