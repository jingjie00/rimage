import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function useDebouncedCrop(
  crop: { x: number; y: number; width: number; height: number },
  delayMs: number,
) {
  const key = `${crop.x},${crop.y},${crop.width},${crop.height}`;
  const [debounced, setDebounced] = useState(crop);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(crop), delayMs);
    return () => clearTimeout(timer);
  }, [key, crop, delayMs]);

  return debounced;
}
