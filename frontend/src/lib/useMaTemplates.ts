import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, apiSend } from './api';
import { useWs } from './useWs';
import type { MovingAverage } from '../features/chart/chart.types';

export interface MaTemplate {
  id: number;
  name: string;
  isDefault: boolean;
  averages: MovingAverage[];
}

interface MaTemplatesResponse {
  templates: MaTemplate[];
  assignments: Record<string, number>;
}

const HIDDEN_KEY = 'chart.maHidden';

const readHidden = (): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

// Moving average templates (spec 052): each broker draws its assigned template, or the
// default one. Reloaded when the backend says they changed (from this or another tab).
// Hidden averages are a per-device choice, kept in localStorage.
export function useMaTemplates() {
  const [data, setData] = useState<MaTemplatesResponse>({ templates: [], assignments: {} });
  const [hidden, setHidden] = useState<string[]>(readHidden);

  const reload = useCallback((signal?: AbortSignal) =>
    apiFetch<MaTemplatesResponse>('/ma-templates', { signal }).then(setData), []);

  useEffect(() => {
    const ac = new AbortController();
    reload(ac.signal).catch(() => {});
    return () => ac.abort();
  }, [reload]);

  useWs(useCallback((message: unknown) => {
    if ((message as { type?: string }).type === 'ma_templates') reload().catch(() => {});
  }, [reload]));

  const defaultTemplate = useMemo(() => data.templates.find(t => t.isDefault) ?? null, [data.templates]);

  const templateFor = useCallback((broker: string): MaTemplate | null => {
    const id = data.assignments[broker];
    return data.templates.find(t => t.id === id) ?? defaultTemplate;
  }, [data, defaultTemplate]);

  const averagesFor = useCallback((broker: string): MovingAverage[] =>
    (templateFor(broker)?.averages ?? []).filter(a => !hidden.includes(a.id)), [templateFor, hidden]);

  const toggleHidden = useCallback((id: string) => {
    setHidden(prev => {
      const next = prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id];
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const assign = useCallback(async (broker: string, templateId: number | null) => {
    await apiSend('/ma-templates/assignments', 'PUT', { broker, templateId });
    await reload();
  }, [reload]);

  return {
    templates: data.templates,
    assignments: data.assignments,
    defaultTemplate,
    templateFor,
    averagesFor,
    hidden,
    toggleHidden,
    assign,
    reload,
  };
}
