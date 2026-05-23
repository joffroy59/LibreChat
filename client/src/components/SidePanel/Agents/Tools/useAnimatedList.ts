import { useEffect, useRef, useState } from 'react';

export type ListItemPhase = 'enter' | 'idle' | 'exit';

export interface AnimatedEntry<T> {
  item: T;
  key: string;
  phase: ListItemPhase;
}

/**
 * Tracks list mutations as enter/idle/exit phases so callers can animate
 * mount and unmount of items. Items leaving the source array stay in the
 * returned entries with phase='exit' until exitMs elapses, then they are
 * removed. New items enter as phase='enter' for one paint, then become
 * 'idle' so the consumer's CSS transition runs from the enter state.
 */
export function useAnimatedList<T>(
  items: T[],
  keyFn: (item: T) => string,
  exitMs: number,
): Array<AnimatedEntry<T>> {
  const keyFnRef = useRef(keyFn);
  keyFnRef.current = keyFn;

  const [entries, setEntries] = useState<Array<AnimatedEntry<T>>>(() =>
    items.map((item) => ({ item, key: keyFn(item), phase: 'idle' as const })),
  );

  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const getKey = keyFnRef.current;
    const currentKeys = new Set(items.map(getKey));

    setEntries((prev) => {
      const prevByKey = new Map(prev.map((p) => [p.key, p]));
      const next: Array<AnimatedEntry<T>> = [];
      let changed = false;

      for (const item of items) {
        const key = getKey(item);
        const existing = prevByKey.get(key);
        if (existing && existing.phase !== 'exit') {
          next.push({ ...existing, item });
          if (existing.item !== item) changed = true;
          continue;
        }
        const timer = exitTimers.current.get(key);
        if (timer) {
          clearTimeout(timer);
          exitTimers.current.delete(key);
        }
        next.push({ item, key, phase: 'enter' });
        changed = true;
      }

      for (const p of prev) {
        if (currentKeys.has(p.key)) continue;
        if (p.phase === 'exit') {
          next.push(p);
        } else {
          next.push({ ...p, phase: 'exit' });
          changed = true;
        }
      }

      return changed ? next : prev;
    });

    const rafId = requestAnimationFrame(() => {
      setEntries((prev) => {
        if (!prev.some((e) => e.phase === 'enter')) return prev;
        return prev.map((e) => (e.phase === 'enter' ? { ...e, phase: 'idle' } : e));
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [items]);

  useEffect(() => {
    for (const entry of entries) {
      if (entry.phase !== 'exit') continue;
      if (exitTimers.current.has(entry.key)) continue;
      const { key } = entry;
      const timer = setTimeout(() => {
        setEntries((curr) => curr.filter((e) => e.key !== key));
        exitTimers.current.delete(key);
      }, exitMs);
      exitTimers.current.set(key, timer);
    }
  }, [entries, exitMs]);

  useEffect(() => {
    const timers = exitTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return entries;
}
