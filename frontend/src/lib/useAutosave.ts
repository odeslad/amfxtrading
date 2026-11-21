import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error';

export interface AutosaveOptions<T> {
  save: (value: T) => Promise<unknown>;
  validate?: (value: T) => string | null;
  delayMs?: number;
  enabled?: boolean;
}

export interface Autosave {
  state: SaveState;
  error: string | null;
  retry: () => void;
  flush: () => void;
}

type Phase = 'idle' | 'saving' | 'saved' | 'error';

interface Snapshot<T> {
  value: T;
}

const SAVED_VISIBLE_MS = 3000;

// Saves `value` a short time after its last change. The value seen when the hook becomes
// enabled is the baseline and is never saved; compare by reference, so pass a memoised value.
// One save runs at a time; a change made meanwhile is saved right after with the latest value.
export function useAutosave<T>(value: T, { save, validate, delayMs = 800, enabled = true }: AutosaveOptions<T>): Autosave {
  const [baseline, setBaseline] = useState<Snapshot<T> | null>(null);
  const [saved, setSaved] = useState<Snapshot<T> | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [failure, setFailure] = useState<string | null>(null);

  if (!enabled && baseline) {
    setBaseline(null);
    setSaved(null);
  }
  if (enabled && !baseline) setBaseline({ value });

  const reference = saved ?? baseline;
  const dirty = enabled && reference !== null && value !== reference.value;
  const problem = dirty ? validate?.(value) ?? null : null;

  const latest = useRef(value);
  const saveRef = useRef(save);
  const ready = useRef(false);
  const saving = useRef(false);
  const again = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveRef.current = save;
    latest.current = value;
    ready.current = dirty && !problem;
  });

  const run = useCallback(async () => {
    if (saving.current) {
      again.current = true;
      return;
    }
    if (fade.current) clearTimeout(fade.current);
    saving.current = true;
    setPhase('saving');
    setFailure(null);
    try {
      let current: T;
      do {
        again.current = false;
        current = latest.current;
        await saveRef.current(current);
      } while (again.current);
      setSaved({ value: current });
      setPhase('saved');
      fade.current = setTimeout(() => setPhase(p => (p === 'saved' ? 'idle' : p)), SAVED_VISIBLE_MS);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Could not save');
      setPhase('error');
    } finally {
      saving.current = false;
    }
  }, []);

  useEffect(() => {
    if (!dirty || problem) return;
    debounce.current = setTimeout(() => {
      debounce.current = null;
      void run();
    }, delayMs);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = null;
    };
  }, [value, dirty, problem, delayMs, run]);

  useEffect(() => () => {
    if (fade.current) clearTimeout(fade.current);
    if (ready.current && !saving.current) void saveRef.current(latest.current);
  }, []);

  const flush = useCallback(() => {
    if (!ready.current) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = null;
    void run();
  }, [run]);

  const retry = useCallback(() => void run(), [run]);

  const state: SaveState = phase === 'saving' ? 'saving'
    : phase === 'error' ? 'error'
      : problem ? 'invalid'
        : dirty ? 'pending'
          : phase;

  return { state, error: phase === 'error' ? failure : problem, retry, flush };
}

const SEVERITY: Record<SaveState, number> = { error: 5, invalid: 4, saving: 3, pending: 2, saved: 1, idle: 0 };

// The worst of several autosaves, for one indicator over a whole page.
export function combineSaves(...saves: Autosave[]): Autosave {
  const worst = saves.reduce((a, b) => (SEVERITY[b.state] > SEVERITY[a.state] ? b : a));
  return { ...worst, flush: () => saves.forEach(s => s.flush()) };
}
