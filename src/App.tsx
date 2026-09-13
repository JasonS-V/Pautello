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
import {
  loadThemePreference,
  saveThemePreference,
  loadNamingPreference,
  saveNamingPreference,
} from './utils/storage';
import { NamingConvention, Pitch, Step, Accidental, Clef } from './types/music';
import { pitchToMidi } from './constants/pitches';

export default function App() {
  const {
    score,
    selectedItemId,
    selectedMeasureIdx,
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
    addMeasure,
    deleteMeasure,
    updateTitle,
    updateComposer,
    updateTempo,
    updateTimeSignature,
    updateKeySignature,
    updateClef,
    loadTemplate,
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

  // Theme & Naming Preferences
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadThemePreference());
  const [namingConvention, setNamingConvention] = useState<NamingConvention>(() =>
    loadNamingPreference()
  );
  const [showNoteNames, setShowNoteNames] = useState<boolean>(true);
  const [isPianoCollapsed, setIsPianoCollapsed] = useState<boolean>(false);

  // Modals state
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isDonateOpen, setIsDonateOpen] = useState<boolean>(false);

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0c0d12] dark:bg-[#0c0d12] text-slate-100 font-sans">
      {/* 1. Left Sidebar Navigation (Matching reference design) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'templates') {
            // Focus or scroll to examples
          }
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
        namingConvention={namingConvention}
        onToggleNamingConvention={toggleNamingConvention}
        showNoteNames={showNoteNames}
        onToggleShowNoteNames={() => setShowNoteNames((prev) => !prev)}
        isPianoCollapsed={isPianoCollapsed}
        onTogglePiano={() => setIsPianoCollapsed((prev) => !prev)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenDonate={() => setIsDonateOpen(true)}
      />

      {/* 2. Main Central Studio Deck */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#0f1117] dark:bg-[#0f1117]">
        {/* Top Navbar / Greeting Header */}
        <Navbar
          score={score}
          onUpdateTitle={updateTitle}
          onUpdateComposer={updateComposer}
          onUpdateTempo={updateTempo}
          isPlaying={playbackState.isPlaying}
          onTogglePlay={togglePlay}
          onStop={stop}
          isLooping={isLooping}
          onToggleLoop={toggleLoop}
          metronomeEnabled={metronomeEnabled}
          onToggleMetronome={toggleMetronome}
          instrument={instrument}
          onSetInstrument={setInstrument}
          volume={volume}
          onSetVolume={setVolume}
          onLoadTemplate={loadTemplate}
        />

        {/* 3 Pastel Feature Cards (Matching the 3 top macaron cards in the reference image) */}
        <div className="px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Amber Pastel Card - Métrica & Tonalidad */}
          <StatCard
            variant="amber"
            title="Estructura Musical"
            countLabel={`${score.timeSignature.beats}/${score.timeSignature.beatType}`}
            subtitle="Métrica & Armadura"
            value={`${score.timeSignature.beats}/${score.timeSignature.beatType} • ${score.keySignature} Mayor`}
            detail={`Clave de ${primaryClef === 'treble' ? 'Sol' : primaryClef === 'bass' ? 'Fa' : 'Do'}`}
            actionTitle="Cambiar compás / tonalidad en el inspector"
            onAction={() => {}}
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
            actionTitle="Reproducir / Pausar"
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
        <div className="flex-1 px-6 pb-4 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col bg-[#161922] rounded-2xl border border-[#232836] shadow-xl overflow-hidden min-h-[450px]">
            {/* Embedded Toolbar for Note Durations & Accidentals */}
            <Toolbar
              activeDuration={activeDuration}
              onSelectDuration={setActiveDuration}
              isRestMode={isRestMode}
              onToggleRestMode={() => setIsRestMode((prev) => !prev)}
              activeAccidental={activeAccidental}
              onSelectAccidental={setActiveAccidental}
              isDotted={isDotted}
              onToggleDot={() => setIsDotted((prev) => !prev)}
            />

            {/* Interactive Vector Score Canvas */}
            <div className="flex-1 flex overflow-auto relative">
              <ScoreView
                score={score}
                selectedItemId={selectedItemId}
                selectedMeasureIdx={selectedMeasureIdx}
                onSelectItem={selectItem}
                onInsertNoteAt={(mIdx, pitch) => insertNoteAt(mIdx, pitch)}
                onInsertRestAt={(mIdx) => insertRestAt(mIdx)}
                onDeleteMeasure={deleteMeasure}
                activeDuration={activeDuration}
                activeAccidental={activeAccidental}
                isRestMode={isRestMode}
                namingConvention={namingConvention}
                showNoteNames={showNoteNames}
                playbackState={playbackState}
              />
            </div>
          </div>
        </div>

        {/* Bottom Integrated Piano Roll (Collapsible) */}
        <div id="piano-container">
          <VirtualPiano
            onNoteClick={(pitch) => insertNoteAt(selectedMeasureIdx, pitch)}
            namingConvention={namingConvention}
            activePlaybackMidi={activePlaybackMidi}
            collapsed={isPianoCollapsed}
            onToggleCollapse={() => setIsPianoCollapsed((prev) => !prev)}
          />
        </div>
      </main>

      {/* 3. Right Inspector Column (Matching stacked dark cards with pill CTAs) */}
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
        onAddMeasure={addMeasure}
        onDeleteMeasure={() => deleteMeasure(selectedMeasureIdx)}
        onDeleteSelected={deleteSelected}
        onTransposeSelected={transposeSelected}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Dialog Modals */}
      <ExportModal
        score={score}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onImportScore={(importedScore) => {
          loadTemplate({
            id: 'imported',
            name: importedScore.title,
            description: 'Partitura importada',
            score: importedScore,
          });
        }}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <DonateModal
        isOpen={isDonateOpen}
        onClose={() => setIsDonateOpen(false)}
      />
    </div>
  );
}
