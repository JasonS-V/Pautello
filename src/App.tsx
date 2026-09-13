import { useState, useEffect, useMemo } from 'react';
import { useScore } from './hooks/useScore';
import { useAudio } from './hooks/useAudio';
import { useKeyboard } from './hooks/useKeyboard';
import { Navbar } from './components/Navbar/Navbar';
import { Toolbar } from './components/Toolbar/Toolbar';
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
import { NamingConvention, Pitch, Step, Accidental } from './types/music';
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

  // Sync theme with HTML class
  useEffect(() => {
    saveThemePreference(theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleNamingConvention = () => {
    setNamingConvention(prev => {
      const next = prev === 'latin' ? 'english' : 'latin';
      saveNamingPreference(next);
      return next;
    });
  };

  // Calculate active MIDI pitch for visual feedback on the Virtual Piano during score playback
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

  // Check if selected item is a note
  const hasSelectedNote = useMemo(() => {
    if (!selectedItemId) return false;
    const staff = score.staves[0];
    if (!staff) return false;
    const measure = staff.measures[selectedMeasureIdx];
    if (!measure) return false;
    return measure.items.some(it => it.id === selectedItemId && it.type === 'note');
  }, [selectedItemId, selectedMeasureIdx, score]);

  // Check if any item (note or rest) is selected
  const hasSelectedItem = useMemo(() => {
    if (!selectedItemId) return false;
    const staff = score.staves[0];
    if (!staff) return false;
    const measure = staff.measures[selectedMeasureIdx];
    if (!measure) return false;
    return measure.items.some(it => it.id === selectedItemId);
  }, [selectedItemId, selectedMeasureIdx, score]);

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
      // In Bass Clef, default octave is 3 (on the staff); in Treble Clef, default is 4
      const defaultOctave = score.staves[0]?.clef === 'bass' ? 3 : 4;
      const pitch: Pitch = {
        step,
        octave: defaultOctave,
        accidental: activeAccidental,
      };
      insertNoteAt(selectedMeasureIdx, pitch);
    },
    onToggleRestMode: () => setIsRestMode(prev => !prev),
    onToggleDot: () => {
      setIsDotted(prev => !prev);
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-[#0d0f14] text-slate-900 dark:text-slate-100">
      {/* Top Navbar */}
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
        theme={theme}
        onToggleTheme={toggleTheme}
        namingConvention={namingConvention}
        onToggleNamingConvention={toggleNamingConvention}
        showNoteNames={showNoteNames}
        onToggleShowNoteNames={() => setShowNoteNames(prev => !prev)}
        onLoadTemplate={loadTemplate}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenDonate={() => setIsDonateOpen(true)}
      />

      {/* Note & Tooling Bar */}
      <Toolbar
        activeDuration={activeDuration}
        onSelectDuration={setActiveDuration}
        isRestMode={isRestMode}
        onToggleRestMode={() => setIsRestMode(prev => !prev)}
        activeAccidental={activeAccidental}
        onSelectAccidental={setActiveAccidental}
        isDotted={isDotted}
        onToggleDot={() => setIsDotted(prev => !prev)}
        selectedArticulation={null}
        onSelectArticulation={() => {}}
        clef={score.staves[0]?.clef || 'treble'}
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
        hasSelectedNote={hasSelectedNote}
        hasSelectedItem={hasSelectedItem}
      />

      {/* Main Interactive Score View */}
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

      {/* Virtual Interactive Piano at the bottom */}
      <div id="piano-container">
        <VirtualPiano
          onNoteClick={(pitch) => insertNoteAt(selectedMeasureIdx, pitch)}
          namingConvention={namingConvention}
          activePlaybackMidi={activePlaybackMidi}
          collapsed={isPianoCollapsed}
          onToggleCollapse={() => setIsPianoCollapsed(prev => !prev)}
        />
      </div>

      {/* Modals */}
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
