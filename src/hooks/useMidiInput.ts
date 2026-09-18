import { useState, useEffect, useCallback, useRef } from 'react';

export interface MidiNoteEvent {
  midi: number;
  velocity: number;
}

interface UseMidiInputOptions {
  onNoteOn: (midi: number, velocity: number) => void;
  onChordOn?: (notes: MidiNoteEvent[]) => void;
  onNoteOff?: (midi: number) => void;
  chordWindowMs?: number;
}

export function useMidiInput({
  onNoteOn,
  onChordOn,
  onNoteOff,
  chordWindowMs = 35,
}: UseMidiInputOptions) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [lastNote, setLastNote] = useState<{ midi: number; velocity: number } | null>(null);

  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const onNoteOnRef = useRef(onNoteOn);
  const onChordOnRef = useRef(onChordOn);
  const onNoteOffRef = useRef(onNoteOff);

  const chordBufferRef = useRef<MidiNoteEvent[]>([]);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onNoteOnRef.current = onNoteOn;
    onChordOnRef.current = onChordOn;
    onNoteOffRef.current = onNoteOff;
  }, [onNoteOn, onChordOn, onNoteOff]);

  const handleMidiMessage = useCallback(
    (event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data || data.length < 2) return;

      const status = data[0] & 0xf0;
      const note = data[1];
      const velocity = data.length > 2 ? data[2] : 64;

      if (status === 0x90 && velocity > 0) {
        // Note On
        setLastNote({ midi: note, velocity });

        if (onChordOnRef.current && chordWindowMs > 0) {
          chordBufferRef.current.push({ midi: note, velocity });
          if (chordTimerRef.current) {
            clearTimeout(chordTimerRef.current);
          }
          chordTimerRef.current = setTimeout(() => {
            const notes = [...chordBufferRef.current];
            chordBufferRef.current = [];
            chordTimerRef.current = null;
            if (notes.length > 1) {
              onChordOnRef.current?.(notes);
            } else if (notes.length === 1) {
              onNoteOnRef.current?.(notes[0].midi, notes[0].velocity);
            }
          }, chordWindowMs);
        } else {
          onNoteOnRef.current?.(note, velocity);
        }
      } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
        // Note Off
        onNoteOffRef.current?.(note);
      }
    },
    [chordWindowMs]
  );

  const updateDevices = useCallback(
    (access: MIDIAccess) => {
      const names: string[] = [];
      access.inputs.forEach((input) => {
        if (input.state === 'connected') {
          names.push(input.name || 'Dispositivo MIDI');
          input.onmidimessage = handleMidiMessage;
        }
      });

      setConnectedDevices(names);
      setIsConnected(names.length > 0);
    },
    [handleMidiMessage]
  );

  useEffect(() => {
    if (typeof navigator.requestMIDIAccess !== 'function') {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        midiAccessRef.current = access;
        updateDevices(access);

        access.onstatechange = () => {
          updateDevices(access);
        };
      })
      .catch((err: unknown) => {
        console.warn('Acceso a Web MIDI denegado o no disponible:', err);
        setIsSupported(false);
      });

    return () => {
      if (chordTimerRef.current) {
        clearTimeout(chordTimerRef.current);
      }
      midiAccessRef.current?.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
    };
  }, [updateDevices]);

  return {
    isSupported,
    isConnected,
    connectedDevices,
    lastNote,
  };
}
