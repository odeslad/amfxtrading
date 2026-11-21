import { useCallback, useMemo, useState } from 'react';
import { apiSend, errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { useMaTemplates, type MaTemplate } from '../../lib/useMaTemplates';
import type { MaType, MovingAverage } from '../chart/chart.types';
import { ColorPicker } from '../chart/ColorPicker';
import { PALETTE, maLabel } from '../chart/movingAverages';
import { ConfirmPanel } from '../journal/ConfirmPanel';
import { useAutosave } from '../../lib/useAutosave';
import {
  Button,
  EmptyState,
  Field,
  Hint,
  IconButton,
  NumberInput,
  SaveStatus,
  Section,
  Segmented,
  Select,
  SelectList,
  TextInput,
  type SegmentOption,
} from '../../shared/ui';
import styles from './MaTemplatesSection.module.css';

interface Draft {
  id: number;
  name: string;
  averages: MovingAverage[];
}

const STYLES: MovingAverage['style'][] = ['solid', 'dashed', 'dotted'];
const WIDTHS: MovingAverage['width'][] = [1, 2, 3];
const MA_TYPE_OPTIONS: SegmentOption<MaType>[] = [{ value: 'ema', label: 'EMA' }, { value: 'sma', label: 'SMA' }];

const newAverage = (existing: MovingAverage[]): MovingAverage => ({
  id: crypto.randomUUID(),
  type: 'ema',
  period: 20,
  color: PALETTE[existing.length % PALETTE.length],
  style: 'solid',
  width: 1,
});

const toDraft = (t: MaTemplate): Draft => ({ id: t.id, name: t.name, averages: t.averages.map(a => ({ ...a })) });

const validPeriod = (period: number): boolean => Number.isInteger(period) && period >= 1;

// Settings › Display › Moving average templates (spec 052). Brokers choose their template
// from the chart's indicators button; here templates are created, edited and deleted.
export function MaTemplatesSection() {
  const { templates, assignments, reload } = useMaTemplates();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selected = templates.find(t => t.id === selectedId) ?? templates.find(t => t.isDefault) ?? templates[0];
  // The edit in progress if it belongs to the selected template, else a fresh copy of it.
  const draft = useMemo(() => (selected ? (edit?.id === selected.id ? edit : toDraft(selected)) : null), [edit, selected]);
  const setDraft = (next: Draft | ((d: Draft | null) => Draft | null)) =>
    setEdit(typeof next === 'function' ? next(draft) : next);

  const brokersOf = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const a of assignments) map.set(a.templateId, [...(map.get(a.templateId) ?? []), a.timeframe ? `${a.broker} · ${a.timeframe}` : a.broker]);
    return map;
  }, [assignments]);


  const run = async (action: () => Promise<unknown>, done: string, failed: string) => {
    setBusy(true);
    try {
      await action();
      await reload();
      addToast(done, 'success');
      return true;
    } catch (err) {
      addToast(errorMessage(err, failed), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = () => run(async () => {
    const created = await apiSend<MaTemplate>('/ma-templates', 'POST', { name: 'New template', averages: [] });
    setSelectedId(created.id);
  }, 'Template created', 'Failed to create the template');

  // Only an edit of the selected template is saved; switching templates saves nothing.
  const edited = selected && edit?.id === selected.id ? edit : null;
  const saveDraft = useCallback(async (next: Draft | null) => {
    if (!next) return;
    await apiSend(`/ma-templates/${next.id}`, 'PUT', { name: next.name.trim(), averages: next.averages });
    await reload();
  }, [reload]);
  const validateDraft = useCallback((next: Draft | null): string | null => {
    if (!next) return null;
    if (!next.name.trim()) return 'The template needs a name';
    return next.averages.every(a => validPeriod(a.period)) ? null : 'Periods must be whole numbers of 1 or more';
  }, []);
  const templateSave = useAutosave(edited, { save: saveDraft, validate: validateDraft, enabled: templates.length > 0 });

  const makeDefault = () => draft && run(
    () => apiSend(`/ma-templates/${draft.id}/default`, 'PUT'),
    `${draft.name} is now the default`, 'Failed to change the default',
  );

  const remove = async () => {
    if (!draft) return;
    const ok = await run(() => apiSend(`/ma-templates/${draft.id}`, 'DELETE'), 'Template deleted', 'Failed to delete the template');
    if (ok) { setDeleting(false); setSelectedId(null); }
  };

  const updateAverage = (id: string, patch: Partial<MovingAverage>) =>
    setDraft(d => d && { ...d, averages: d.averages.map(a => (a.id === id ? { ...a, ...patch } : a)) });

  if (!draft || !selected) return null;
  const usedBy = brokersOf.get(selected.id) ?? [];
  const defaultTemplate = templates.find(t => t.isDefault);

  return (
    <Section
      title="Moving average templates"
      actions={
        <>
          <SaveStatus state={templateSave.state} error={templateSave.error} onRetry={templateSave.retry} />
          <Button variant="buyOutline" size="sm" onClick={create} disabled={busy}>+ New template</Button>
        </>
      }
    >
      <div className={styles.layout}>
        <div className={styles.list}>
          <SelectList
            label="Templates"
            selected={selected.id}
            onSelect={setSelectedId}
            items={templates.map(t => ({
              id: t.id,
              title: `${t.isDefault ? '★ ' : ''}${t.name}`,
              aside: `${t.averages.length} MA`,
              meta: t.isDefault ? 'Brokers without a template' : (brokersOf.get(t.id) ?? []).join(' · ') || 'Not used',
            }))}
          />
        </div>

        <div className={styles.mobilePick}>
          <Field label="Template" htmlFor="ma-template-pick">
            <Select id="ma-template-pick" value={selected.id} onChange={e => setSelectedId(Number(e.target.value))}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.isDefault ? '★ ' : ''}{t.name} · {t.averages.length} MA</option>)}
            </Select>
          </Field>
        </div>

        <div className={styles.editor}>
          <div className={styles.editorHead}>
            <div className={styles.name}>
              <Field label="Name" htmlFor="ma-template-name">
                <TextInput id="ma-template-name" value={draft.name} maxLength={40} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              </Field>
            </div>
            <div className={styles.actions}>
              {!selected.isDefault && <Button size="sm" onClick={makeDefault} disabled={busy}>★ Make default</Button>}
              {!selected.isDefault && <Button variant="danger" size="sm" onClick={() => setDeleting(true)} disabled={busy}>Delete</Button>}
            </div>
          </div>
          <Hint>
            {selected.isDefault ? 'Default template: used by every broker without one of its own.' : usedBy.length ? `Used by ${usedBy.join(' · ')}` : 'Not used by any broker yet. Choose it from a chart\'s indicators button.'}
          </Hint>

          {draft.averages.length === 0 && <EmptyState>No moving averages yet.</EmptyState>}
          <div className={styles.rows}>
            {draft.averages.map(a => (
              <div key={a.id} className={styles.row}>
                <Segmented
                  label={`Type of ${maLabel(a)}`}
                  options={MA_TYPE_OPTIONS}
                  value={a.type}
                  onChange={type => updateAverage(a.id, { type })}
                />
                <Field label="Period" htmlFor={`ma-period-${a.id}`}>
                  <NumberInput
                    id={`ma-period-${a.id}`}
                    inputMode="numeric"
                    min={1}
                    step={1}
                    invalid={!validPeriod(a.period)}
                    value={Number.isNaN(a.period) ? '' : a.period}
                    onChange={e => updateAverage(a.id, { period: e.target.value === '' ? NaN : Number(e.target.value) })}
                  />
                </Field>
                <Field label="Colour">
                  <ColorPicker value={a.color} onChange={color => updateAverage(a.id, { color })} label={`Colour of ${maLabel(a)}`} />
                </Field>
                <Field label="Style" htmlFor={`ma-style-${a.id}`}>
                  <Select id={`ma-style-${a.id}`} value={a.style} onChange={e => updateAverage(a.id, { style: e.target.value as MovingAverage['style'] })}>
                    {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
                <Field label="Width" htmlFor={`ma-width-${a.id}`}>
                  <Select id={`ma-width-${a.id}`} value={a.width} onChange={e => updateAverage(a.id, { width: Number(e.target.value) as MovingAverage['width'] })}>
                    {WIDTHS.map(w => <option key={w} value={w}>{w}</option>)}
                  </Select>
                </Field>
                <IconButton
                  icon="×"
                  label={`Remove ${maLabel(a)}`}
                  tone="danger"
                  size="md"
                  onClick={() => setDraft({ ...draft, averages: draft.averages.filter(x => x.id !== a.id) })}
                />
              </div>
            ))}
          </div>
          <Button variant="dashed" onClick={() => setDraft({ ...draft, averages: [...draft.averages, newAverage(draft.averages)] })}>+ Add moving average</Button>
        </div>
      </div>

      <ConfirmPanel
        open={deleting}
        title="Delete template?"
        description={`${selected.name} · ${selected.averages.length} MA`}
        detail={usedBy.length ? `${usedBy.join(' · ')} will use the default template (★ ${defaultTemplate?.name ?? 'Default'}).` : 'No broker uses it.'}
        confirmLabel="Delete"
        confirmingLabel="Deleting…"
        confirming={busy}
        onConfirm={remove}
        onClose={() => setDeleting(false)}
      />
    </Section>
  );
}
