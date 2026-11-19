import { useMemo, useState } from 'react';
import { apiSend, errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { useMaTemplates, type MaTemplate } from '../../lib/useMaTemplates';
import type { MaType, MovingAverage } from '../chart/chart.types';
import { ColorPicker } from '../chart/ColorPicker';
import { PALETTE, maLabel } from '../chart/movingAverages';
import { ConfirmPanel } from '../journal/ConfirmPanel';
import styles from './MaTemplatesSection.module.css';

interface Draft {
  id: number;
  name: string;
  averages: MovingAverage[];
}

const STYLES: MovingAverage['style'][] = ['solid', 'dashed', 'dotted'];
const WIDTHS: MovingAverage['width'][] = [1, 2, 3];

const newAverage = (existing: MovingAverage[]): MovingAverage => ({
  id: crypto.randomUUID(),
  type: 'ema',
  period: 20,
  color: PALETTE[existing.length % PALETTE.length],
  style: 'solid',
  width: 1,
});

const toDraft = (t: MaTemplate): Draft => ({ id: t.id, name: t.name, averages: t.averages.map(a => ({ ...a })) });

const sameDraft = (a: Draft, t: MaTemplate | undefined): boolean =>
  !!t && a.name === t.name && JSON.stringify(a.averages) === JSON.stringify(t.averages);

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
    for (const [broker, id] of Object.entries(assignments)) map.set(id, [...(map.get(id) ?? []), broker]);
    return map;
  }, [assignments]);

  const dirty = !!draft && !sameDraft(draft, selected);
  const periodsValid = !!draft && draft.averages.every(a => Number.isInteger(a.period) && a.period >= 1);

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

  const save = () => draft && run(
    () => apiSend(`/ma-templates/${draft.id}`, 'PUT', { name: draft.name.trim(), averages: draft.averages }),
    'Template saved', 'Failed to save the template',
  );

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
    <section className={styles.section}>
      <div className={styles.head}>
        <span className={styles.title}>Moving average templates</span>
        <button type="button" className={styles.newBtn} onClick={create} disabled={busy}>+ New template</button>
      </div>

      <div className={styles.layout}>
        <div className={styles.list} role="listbox" aria-label="Templates">
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={t.id === selected.id}
              className={`${styles.item} ${t.id === selected.id ? styles.itemActive : ''}`}
              onClick={() => setSelectedId(t.id)}
            >
              <span className={styles.itemTop}>
                <span>{t.isDefault && <span className={styles.star} aria-label="Default">★ </span>}{t.name}</span>
                <span className={styles.mono}>{t.averages.length} MA</span>
              </span>
              <span className={styles.muted}>
                {t.isDefault ? 'Brokers without a template' : (brokersOf.get(t.id) ?? []).join(' · ') || 'Not used'}
              </span>
            </button>
          ))}
        </div>

        <label className={styles.mobilePick}>
          <span className={styles.label}>Template</span>
          <select className={styles.select} value={selected.id} onChange={e => setSelectedId(Number(e.target.value))}>
            {templates.map(t => <option key={t.id} value={t.id}>{t.isDefault ? '★ ' : ''}{t.name} · {t.averages.length} MA</option>)}
          </select>
        </label>

        <div className={styles.editor}>
          <div className={styles.editorHead}>
            <label className={styles.nameField}>
              <span className={styles.label}>Name</span>
              <input className={styles.input} value={draft.name} maxLength={40} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <div className={styles.actions}>
              {!selected.isDefault && <button type="button" className={styles.outlinedBtn} onClick={makeDefault} disabled={busy}>★ Make default</button>}
              {!selected.isDefault && <button type="button" className={styles.dangerBtn} onClick={() => setDeleting(true)} disabled={busy}>Delete</button>}
              <button type="button" className={styles.saveBtn} onClick={save} disabled={busy || !dirty || !periodsValid || !draft.name.trim()}>Save template</button>
            </div>
          </div>
          <span className={styles.muted}>
            {selected.isDefault ? 'Default template: used by every broker without one of its own.' : usedBy.length ? `Used by ${usedBy.join(' · ')}` : 'Not used by any broker yet. Choose it from a chart\'s indicators button.'}
          </span>

          {draft.averages.length === 0 && <p className={styles.muted}>No moving averages yet.</p>}
          <div className={styles.rows}>
            {draft.averages.map(a => (
              <div key={a.id} className={styles.row}>
                <div className={styles.typeToggle} role="group" aria-label="Type">
                  {(['ema', 'sma'] as MaType[]).map(t => (
                    <button key={t} type="button" aria-pressed={a.type === t} className={a.type === t ? styles.typeOn : styles.typeOff} onClick={() => updateAverage(a.id, { type: t })}>
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
                <label className={styles.cell}>
                  <span className={styles.cellLabel}>Period</span>
                  <input
                    className={`${styles.input} ${styles.period} ${Number.isInteger(a.period) && a.period >= 1 ? '' : styles.invalid}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={Number.isNaN(a.period) ? '' : a.period}
                    onChange={e => updateAverage(a.id, { period: e.target.value === '' ? NaN : Number(e.target.value) })}
                    aria-label={`Period of ${maLabel(a)}`}
                  />
                </label>
                <span className={styles.cell}>
                  <span className={styles.cellLabel}>Colour</span>
                  <ColorPicker value={a.color} onChange={color => updateAverage(a.id, { color })} label={`Colour of ${maLabel(a)}`} />
                </span>
                <label className={styles.cell}>
                  <span className={styles.cellLabel}>Style</span>
                  <select className={styles.select} value={a.style} onChange={e => updateAverage(a.id, { style: e.target.value as MovingAverage['style'] })}>
                    {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className={styles.cell}>
                  <span className={styles.cellLabel}>Width</span>
                  <select className={styles.select} value={a.width} onChange={e => updateAverage(a.id, { width: Number(e.target.value) as MovingAverage['width'] })}>
                    {WIDTHS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </label>
                <button type="button" className={styles.removeBtn} aria-label={`Remove ${maLabel(a)}`} onClick={() => setDraft({ ...draft, averages: draft.averages.filter(x => x.id !== a.id) })}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" className={styles.addBtn} onClick={() => setDraft({ ...draft, averages: [...draft.averages, newAverage(draft.averages)] })}>+ Add moving average</button>
          {dirty && <span className={styles.unsaved}>Unsaved changes</span>}
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
    </section>
  );
}
