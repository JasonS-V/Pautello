import { useSyncExternalStore } from 'react';
import { scorePlayer, PlaybackState } from '../audio/player';

export interface MeasurePlaybackStatus {
  isMeasureActive: boolean;
  activeItemIndex: number;
}

const INACTIVE_MEASURE_STATE: MeasurePlaybackStatus = Object.freeze({
  isMeasureActive: false,
  activeItemIndex: -1,
});

/**
 * Suscribe un componente al estado global del reproductor.
 * Solo debe usarse en componentes que realmente necesiten leer el cursor completo.
 */
export function usePlaybackCursor(): PlaybackState {
  return useSyncExternalStore(
    (onStoreChange) => scorePlayer.subscribe(onStoreChange),
    () => scorePlayer.getSnapshot()
  );
}

/**
 * Suscribe un compás al reproductor de forma granular.
 * Si el compás no está reproduciéndose, retorna siempre la tupla inmutable
 * `INACTIVE_MEASURE_STATE`, garantizando 0 re-renders en los compases inactivos
 * mientras el cursor recorre notas en otro compás.
 */
export function useIsMeasurePlaying(measureIdx: number): MeasurePlaybackStatus {
  return useSyncExternalStore(
    (onStoreChange) => scorePlayer.subscribe(onStoreChange),
    () => {
      const snapshot = scorePlayer.getSnapshot();
      if (!snapshot.isPlaying || snapshot.currentMeasureIndex !== measureIdx) {
        return INACTIVE_MEASURE_STATE;
      }
      return {
        isMeasureActive: true,
        activeItemIndex: snapshot.currentItemIndex,
      };
    }
  );
}
