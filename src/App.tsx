import { useState, useEffect, useMemo } from 'react';
import { useScore } from './hooks/useScore';
import { useAudio } from './hooks/useAudio';
import { useKeyboard } from './hooks/useKeyboard';
import { Sidebar, SidebarTab } from './components/Sidebar/Sidebar';
import { Navbar } from './components/Navbar/Navbar';
import { Toolbar } from './components/Toolbar/Toolbar';
import { StatCard } from './components/Cards/StatCard';
import { ScoreInspector } from './components/Inspector/ScoreInspector';
import { ScoreView } from './components/ScoreView/ScoreView';
import { VirtualPiano } from './components/PianoRoll/VirtualPiano';
import { ExportModal } from './components/Modals/ExportModal';
import { ShortcutsModal } from './components/Modals/ShortcutsModal';
import { DonateModal } from './components/Modals/DonateModal';
import { TemplatesModal } from './components/Modals/TemplatesModal';
import { MixerModal } from './components/Modals/MixerModal';
import { ImportModal } from './components/Modals/ImportModal';
import { ShareModal } from './components/Modals/ShareModal';
import { PracticeResultModal } from './components/Modals/PracticeResultModal';
import { TunerModal } from './components/Modals/TunerModal';
import { PlayAlongModal } from './components/Modals/PlayAlongModal';
import { OnboardingTour, TUTORIAL_STORAGE_KEY } from './components/Onboarding/OnboardingTour';
import { useMidiInput } from './hooks/useMidiInput';
import { usePracticeMode } from './hooks/usePracticeMode';
import { useMicPitch } from './hooks/useMicPitch';
import { usePlayAlong } from './hooks/usePlayAlong';
import { decompressScoreFromHash } from './utils/shareUrl';
import { audioEngine } from './audio/synth';

import {
  loadThemePreference,
  saveThemePreference,
  loadNamingPreference,
  saveNamingPreference,
} from './utils/storage';
import { NamingConvention, Pitch, Step, Accidental, Clef } from './types/music';
import { pitchToMidi, midiToPitch, KEY_SIGNATURE_DATA } from './constants/pitches';

export default function App() {
  const {
    score,
    selectedItemId,
    selectedMeasureIdx,
    selectedStaffIdx,
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
    selectItem,
    insertNoteAt,
    insertRestAt,
    deleteSelected,
    transposeSelected,
    changeSelectedDuration,
    toggleSelectedDot,
    setSelectedAccidental,
    updateSelectedLyric,
    updateSelectedChord,
    updateSelectedStep,
    addMeasure,
    deleteMeasure,
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
  const [activeTab, setActiveTab] = useState<SidebarTab>('editor');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadThemePreference());
  const [namingConvention, setNamingConvention] = useState<NamingConvention>(() =>
    loadNamingPreference()
  );
  const [showNoteNames, setShowNoteNames] = useState<boolean>(true);
  const [showTablature, setShowTablature] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState<boolean>(false);
  const [isPianoCollapsed, setIsPianoCollapsed] = useState<boolean>(false);

  // Modals state
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isDonateOpen, setIsDonateOpen] = useState<boolean>(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState<boolean>(false);
  const [isMixerOpen, setIsMixerOpen] = useState<boolean>(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(() => {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) !== 'true';
  });

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

  const { isConnected: isMidiConnected, connectedDevices } = useMidiInput({
    onNoteOn: (midi, velocity) => {
      setActiveMidiPitch(midi);
      if (isPracticeActive) {
        checkPlayedMidi(midi);
      } else {
        const pitch = midiToPitch(midi);
        insertNoteAt(selectedMeasureIdx, pitch);
        audioEngine.playMidi(midi, 0.4, velocity / 127);
      }
      setTimeout(() => setActiveMidiPitch(null), 250);
    },
    onNoteOff: () => {
      setActiveMidiPitch(null);
    },
  });

  // Phase 3: Tuner & Play-Along Modals state
  const [isTunerOpen, setIsTunerOpen] = useState<boolean>(false);
  const [isPlayAlongOpen, setIsPlayAlongOpen] = useState<boolean>(false);

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

  const handleStop = () => {
    stop();
    if (isPlayAlongLoaded) {
      stopPlayAlong();
    }
  };

  // Auto-load shared score from URL hash on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#share=')) {
      decompressScoreFromHash(window.location.hash)
        .then((sharedScore) => {
          if (sharedScore) {
            loadTemplate({
              id: 'shared',
              name: sharedScore.title || 'Partitura Compartida',
              description: `Por ${sharedScore.composer || 'Anónimo'} (abierta desde enlace)`,
              score: sharedScore,
            });
          }
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

  // Keyboard shortcut handlers
  useKeyboard({
    onTogglePlay: togglePlay,
    onDeleteSelected: deleteSelected,
    onTransposeSelected: transposeSelected,
    onSelectDuration: (dur) => {
      setActiveDuration(dur);
      if (selectedItemId) changeSelectedDuration(dur);
    },
    onInsertNoteStep: (step: Step) => {
      const defaultOctave = score.staves[0]?.clef === 'bass' ? 3 : 4;
      const pitch: Pitch = {
        step,
        octave: defaultOctave,
        accidental: activeAccidental,
      };
      insertNoteAt(selectedMeasureIdx, pitch);
    },
    onToggleRestMode: () => setIsRestMode((prev) => !prev),
    onToggleDot: () => {
      setIsDotted((prev) => !prev);
      if (selectedItemId) toggleSelectedDot();
    },
    onSetAccidental: (acc: Accidental) => {
      setActiveAccidental(acc);
      if (selectedItemId) setSelectedAccidental(acc);
    },
    onUndo: undo,
    onRedo: redo,
    onDeselect: () => selectItem(selectedMeasureIdx, null),
    onOpenShortcuts: () => setIsShortcutsOpen(true),
  });

  const primaryClef: Clef = score.staves[0]?.clef || 'treble';
  const keyLabel = KEY_SIGNATURE_DATA[score.keySignature]?.name || score.keySignature;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f1f3f7] dark:bg-[#0c0d12] text-slate-900 dark:text-slate-100 font-sans transition-colors">
      {/* 1. Left Sidebar Navigation (Matching reference design with full light/dark support) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'templates') {
            setIsTemplatesOpen(true);
          } else if (tab === 'mixer') {
            setIsMixerOpen(true);
          }
        }}
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
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onOpenMixer={() => setIsMixerOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
        onOpenTuner={() => setIsTunerOpen(true)}
        onOpenPlayAlong={() => setIsPlayAlongOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenDonate={() => setIsDonateOpen(true)}
        onOpenTutorial={() => setIsTutorialOpen(true)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Main Central Studio Deck */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#f8fafc] dark:bg-[#0f1117] transition-colors">
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
          instrument={instrument}
          onSetInstrument={setInstrument}
          volume={volume}
          onSetVolume={setVolume}
          onLoadTemplate={loadTemplate}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onToggleInspector={() => setIsInspectorCollapsed((prev) => !prev)}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenShare={() => setIsShareOpen(true)}
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
          onOpenTuner={() => setIsTunerOpen(true)}
          onOpenPlayAlong={() => setIsPlayAlongOpen(true)}
          isPlayAlongLoaded={isPlayAlongLoaded}
        />

        {/* 3 Pastel Feature Cards (Matching the 3 top macaron cards in the reference image) */}
        <div id="stat-cards-container" className="px-4 sm:px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Card 1: Amber Pastel Card - Métrica & Tonalidad */}
          <StatCard
            variant="amber"
            title="Estructura Musical"
            countLabel={`${score.timeSignature.beats}/${score.timeSignature.beatType}`}
            subtitle="Métrica & Tonalidad"
            value={keyLabel}
            detail={`Clave de ${primaryClef === 'treble' ? 'Sol' : primaryClef === 'bass' ? 'Fa' : 'Do'}`}
            actionTitle="Ver y modificar en el inspector"
            onCardClick={() => setIsInspectorCollapsed(false)}
            onAction={() => setIsInspectorCollapsed(false)}
          />

          {/* Card 2: Purple / Lavender Pastel Card - Instrumento & Tempo */}
          <StatCard
            variant="purple"
            title="Audio & Síntesis"
            countLabel={`${score.tempo} BPM`}
            subtitle="Timbre Polifónico"
            value={
              instrument === 'piano'
                ? 'Piano Acústico'
                : instrument === 'marimba'
                ? 'Marimba'
                : instrument === 'strings'
                ? 'Cuerdas'
                : 'Flauta'
            }
            detail={`${playbackState.isPlaying ? 'Reproduciendo en vivo' : 'En pausa (Espacio)'}`}
            actionTitle="Reproducir / Pausar (Espacio)"
            onCardClick={() => setIsMixerOpen(true)}
            onAction={togglePlay}
          />

          {/* Card 3: Lime Pastel Card - Notas & Compases */}
          <StatCard
            variant="lime"
            title="Partitura"
            countLabel={`${score.staves[0]?.measures.length || 0} C`}
            subtitle="Extensión y Pasaje"
            value={`${totalNotes} notas`}
            detail={`Duración est.: ${estimatedDuration}`}
            actionTitle="Añadir nuevo compás"
            onAction={addMeasure}
          />
        </div>

        {/* Center Stage: Card container for Score Canvas + Modern Toolbar */}
        <div className="flex-1 px-4 sm:px-6 pb-4 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col bg-white dark:bg-[#161922] rounded-2xl border border-slate-200 dark:border-[#232836] shadow-md overflow-hidden min-h-[450px] transition-colors">
            {/* Embedded Toolbar for Note Durations & Accidentals with full reactive selection updates */}
            <div id="toolbar-container">
              <Toolbar
                activeDuration={activeDuration}
                onSelectDuration={(dur) => {
                  setActiveDuration(dur);
                  if (selectedItemId) changeSelectedDuration(dur);
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
              />
            </div>

            {/* Interactive Vector Score Canvas */}
            <div id="score-canvas" className="flex-1 flex overflow-auto relative">
              <ScoreView
                score={score}
                selectedItemId={selectedItemId}
                selectedMeasureIdx={selectedMeasureIdx}
                selectedStaffIdx={selectedStaffIdx}
                onSelectItem={(mIdx, itemId, sIdx) => selectItem(mIdx, itemId, sIdx)}
                onInsertNoteAt={(mIdx, pitch, sIdx) => insertNoteAt(mIdx, pitch, undefined, sIdx)}
                onInsertRestAt={(mIdx, sIdx) => insertRestAt(mIdx, undefined, sIdx)}
                onDeleteMeasure={deleteMeasure}
                activeDuration={activeDuration}
                activeAccidental={activeAccidental}
                isRestMode={isRestMode}
                namingConvention={namingConvention}
                showNoteNames={showNoteNames}
                playbackState={playbackState}
                showTablature={showTablature}
                practiceTargetNote={
                  isPracticeActive && practiceTargetNote
                    ? { measureIdx: practiceTargetNote.measureIdx, itemIdx: practiceTargetNote.itemIdx }
                    : null
                }
                practiceHitResult={practiceHitResult}
              />
            </div>
          </div>
        </div>

        {/* Bottom Integrated Piano Roll (Collapsible) */}
        <div id="piano-container">
          <VirtualPiano
            onNoteClick={(pitch) => {
              if (isPracticeActive) {
                checkPlayedMidi(pitchToMidi(pitch));
              } else {
                insertNoteAt(selectedMeasureIdx, pitch);
              }
            }}
            namingConvention={namingConvention}
            activePlaybackMidi={activePlaybackMidi}
            activeMidiPitch={activeMidiPitch}
            isMidiConnected={isMidiConnected}
            connectedDevices={connectedDevices}
            collapsed={isPianoCollapsed}
            onToggleCollapse={() => setIsPianoCollapsed((prev) => !prev)}
          />
        </div>
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
        onSetAccidental={setSelectedAccidental}
        onUpdateLyric={updateSelectedLyric}
        onUpdateChord={updateSelectedChord}
        onUpdateStep={updateSelectedStep}
        onClearScore={clearScore}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onOpenExport={() => setIsExportOpen(true)}
        isGrandStaff={isGrandStaff}
        onToggleGrandStaff={toggleGrandStaff}
        isCollapsed={isInspectorCollapsed}
        onToggleCollapse={() => setIsInspectorCollapsed((prev) => !prev)}
      />

      {/* Dialog Modals */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportScore={(importedScore) => {
          loadTemplate({
            id: 'imported',
            name: importedScore.title,
            description: 'Partitura importada',
            score: importedScore,
          });
        }}
      />

      <ExportModal
        score={score}
        instrument={instrument}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onOpenImport={() => setIsImportOpen(true)}
        onImportScore={(importedScore) => {
          loadTemplate({
            id: 'imported',
            name: importedScore.title,
            description: 'Partitura importada',
            score: importedScore,
          });
        }}
      />

      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onLoadTemplate={loadTemplate}
      />

      <MixerModal
        isOpen={isMixerOpen}
        onClose={() => setIsMixerOpen(false)}
        instrument={instrument}
        onSetInstrument={setInstrument}
        volume={volume}
        onSetVolume={setVolume}
        tempo={score.tempo}
        onSetTempo={updateTempo}
        metronomeEnabled={metronomeEnabled}
        onToggleMetronome={toggleMetronome}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <DonateModal
        isOpen={isDonateOpen}
        onClose={() => setIsDonateOpen(false)}
      />

      <ShareModal
        score={score}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />

      {/* Real-time Chromatic Tuner Modal */}
      <TunerModal
        isOpen={isTunerOpen}
        onClose={() => setIsTunerOpen(false)}
        namingConvention={namingConvention}
      />

      {/* Play-Along Audio Backing Track Modal */}
      <PlayAlongModal
        isOpen={isPlayAlongOpen}
        onClose={() => setIsPlayAlongOpen(false)}
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

      {/* Practice Mode Completion Scorecard */}
      <PracticeResultModal
        isOpen={isPracticeCompleted}
        accuracy={practiceAccuracy}
        streak={practiceStreak}
        onRestart={() => {
          resetPractice();
          startPractice();
        }}
        onClose={stopPractice}
      />

      {/* Interactive First-Launch Onboarding Walkthrough */}
      <OnboardingTour
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onComplete={() => setIsTutorialOpen(false)}
      />
    </div>
  );
}
