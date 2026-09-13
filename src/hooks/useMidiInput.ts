import { useState, useEffect, useCallback, useRef } from 'react';

// Web MIDI safe types
type AnyMIDIAccess = any;
type AnyMIDIMessageEvent = any;


interface UseMidiInputOptions {
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
}

export function useMidiInput({ onNoteOn, onNoteOff }: UseMidiInputOptions) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [lastNote, setLastNote] = useState<{ midi: number; velocity: number } | null>(null);

  const midiAccessRef = useRef<AnyMIDIAccess | null>(null);
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);

  useEffect(() => {
    onNoteOnRef.current = onNoteOn;
    onNoteOffRef.current = onNoteOff;
  }, [onNoteOn, onNoteOff]);

  const handleMidiMessage = useCallback((event: AnyMIDIMessageEvent) => {
    const data = event.data;
    if (!data || data.length < 2) return;

    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data.length > 2 ? data[2] : 64;

    if (status === 0x90 && velocity > 0) {
      // Note On
      setLastNote({ midi: note, velocity });
      onNoteOnRef.current?.(note, velocity);
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      // Note Off
      onNoteOffRef.current?.(note);
    }
  }, []);

  const updateDevices = useCallback((access: AnyMIDIAccess) => {
    const names: string[] = [];
    if (access && access.inputs) {
      access.inputs.forEach((input: any) => {
        if (input.state === 'connected') {
          names.push(input.name || 'Dispositivo MIDI');
          input.onmidimessage = handleMidiMessage;
        }
      });
    }

    setConnectedDevices(names);
    setIsConnected(names.length > 0);
  }, [handleMidiMessage]);

  useEffect(() => {
    const nav = navigator as any;
    if (!nav || typeof nav.requestMIDIAccess !== 'function') {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    nav.requestMIDIAccess({ sysex: false })
      .then((access: any) => {
        midiAccessRef.current = access;
        updateDevices(access);

        access.onstatechange = () => {
          updateDevices(access);
        };
      })
      .catch((err: any) => {
        console.warn('Acceso a Web MIDI denegado o no disponible:', err);
        setIsSupported(false);
      });

    return () => {
      if (midiAccessRef.current && midiAccessRef.current.inputs) {
        midiAccessRef.current.inputs.forEach((input: any) => {
          input.onmidimessage = null;
        });
      }
    };
  }, [updateDevices]);

  return {
    isSupported,
    isConnected,
    connectedDevices,
    lastNote,
  };
}
