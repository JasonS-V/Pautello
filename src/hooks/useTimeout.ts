import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * Programa un temporizador de un solo uso.
 *
 * Reprogramar cancela el anterior y desmontar lo limpia, dos cosas que se suelen
 * olvidar: sin lo primero, dos pulsaciones seguidas dejan que el temporizador
 * viejo corte el estado del nuevo antes de tiempo; sin lo segundo, el callback
 * toca estado de un componente que ya no existe.
 */
export function useTimeout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const schedule = useCallback(
    (callback: () => void, ms: number) => {
      clear();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        callback();
      }, ms);
    },
    [clear]
  );

  return useMemo(() => ({ schedule, clear }), [schedule, clear]);
}
