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

// One assignment: a broker on every timeframe (timeframe null) or on one.
export interface MaAssignment {
  broker: string;
  timeframe: string | null;
  templateId: number;
}

// Where a chart's template comes from: its broker and timeframe, its broker, or the default.
export type MaSource = 'timeframe' | 'broker' | 'default';

interface MaTemplatesResponse {
  templates: MaTemplate[];
  assignments: MaAssignment[];
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

// Moving average templates (spec 052): a chart draws the template assigned to its broker on
// its timeframe, else to its broker, else the default. Reloaded when the backend says they
// changed (from this or another tab). Hidden averages are a per-device choice.
export function useMaTemplates() {
  const [data, setData] = useState<MaTemplatesResponse>({ templates: [], assignments: [] });
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

  const assignmentOf = useCallback((broker: string, timeframe: string | null): MaAssignment | undefined =>
    data.assignments.find(a => a.broker === broker && a.timeframe === timeframe), [data.assignments]);

  const sourceOf = useCallback((broker: string, timeframe: string): MaSource => {
    const byTf = assignmentOf(broker, timeframe);
    if (byTf && data.templates.some(t => t.id === byTf.templateId)) return 'timeframe';
    const byBroker = assignmentOf(broker, null);
    if (byBroker && data.templates.some(t => t.id === byBroker.templateId)) return 'broker';
    return 'default';
  }, [assignmentOf, data.templates]);

  const templateFor = useCallback((broker: string, timeframe: string): MaTemplate | null => {
    const source = sourceOf(broker, timeframe);
    if (source === 'default') return defaultTemplate;
    const id = assignmentOf(broker, source === 'timeframe' ? timeframe : null)?.templateId;
    return data.templates.find(t => t.id === id) ?? defaultTemplate;
  }, [sourceOf, assignmentOf, data.templates, defaultTemplate]);

  const averagesFor = useCallback((broker: string, timeframe: string): MovingAverage[] =>
    (templateFor(broker, timeframe)?.averages ?? []).filter(a => !hidden.includes(a.id)), [templateFor, hidden]);

  const toggleHidden = useCallback((id: string) => {
    setHidden(prev => {
      const next = prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id];
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // templateId null clears that assignment (the timeframe row, or the broker row).
  const assign = useCallback(async (broker: string, timeframe: string | null, templateId: number | null) => {
    await apiSend('/ma-templates/assignments', 'PUT', { broker, timeframe, templateId });
    await reload();
  }, [reload]);

  return {
    templates: data.templates,
    assignments: data.assignments,
    defaultTemplate,
    assignmentOf,
    sourceOf,
    templateFor,
    averagesFor,
    hidden,
    toggleHidden,
    assign,
    reload,
  };
}
