import { useEffect, useRef, useState } from 'react';

/** Brief highlight when compile generation bumps (e.g. realtime restarts). */
export function useCompileFlash(generation: number, enabled: boolean): boolean {
  const [flash, setFlash] = useState(false);
  const prev = useRef(0);

  useEffect(() => {
    if (generation === 0) {
      prev.current = 0;
      setFlash(false);
      return;
    }
    if (!enabled || generation === prev.current) return;
    prev.current = generation;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 550);
    return () => clearTimeout(t);
  }, [generation, enabled]);

  return flash;
}
