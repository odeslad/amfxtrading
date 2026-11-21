import { useCallback, useState } from 'react';
import { useAutosave } from '../lib/useAutosave';
import { Field, NavList, SaveStatus, Segmented, TextInput, type NavItem } from '../shared/ui';
import styles from './UiCatalogPage.module.css';

type Outcome = 'ok' | 'slow' | 'fail';
type DemoSection = 'trading' | 'chart' | 'indicators';

const NAV_ITEMS: NavItem<DemoSection>[] = [
  { id: 'trading', label: 'Trading', summary: 'Mirror presets · Quick orders · New trade' },
  { id: 'chart', label: 'Chart', summary: 'P&L · Drawings · Price' },
  { id: 'indicators', label: 'Indicators', summary: 'MA templates · Cross trades' },
];

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function AutosaveDemo() {
  const [text, setText] = useState('20');
  const [outcome, setOutcome] = useState<Outcome>('ok');
  const [log, setLog] = useState<string[]>([]);
  const [section, setSection] = useState<DemoSection>('trading');

  const save = useCallback(async (value: string) => {
    await wait(outcome === 'slow' ? 2500 : 400);
    if (outcome === 'fail') throw new Error('network error');
    setLog(current => [`saved "${value}"`, ...current].slice(0, 6));
  }, [outcome]);

  const validate = useCallback((value: string) => (Number(value) >= 1 ? null : 'Period must be 1 or more'), []);
  const autosave = useAutosave(text, { save, validate });

  return (
    <div className={styles.columns}>
      <div className={styles.stack}>
        <div className={styles.swatches}>
          <Segmented
            label="Save outcome"
            size="sm"
            value={outcome}
            onChange={setOutcome}
            options={[{ value: 'ok', label: 'OK' }, { value: 'slow', label: 'SLOW' }, { value: 'fail', label: 'FAIL' }]}
          />
          <SaveStatus state={autosave.state} error={autosave.error} onRetry={autosave.retry} />
        </div>
        <Field label="Period (type fast; below 1 is invalid)" htmlFor="cat-autosave">
          <TextInput id="cat-autosave" value={text} invalid={autosave.state === 'invalid'} onChange={e => setText(e.target.value)} />
        </Field>
        <span className={styles.name}>{log.length === 0 ? 'No saves yet' : log.join(' · ')}</span>
        <div className={styles.swatches}>
          <SaveStatus state="pending" />
          <SaveStatus state="saving" />
          <SaveStatus state="saved" />
          <SaveStatus state="invalid" />
          <SaveStatus state="error" error="network error" onRetry={() => undefined} />
        </div>
      </div>
      <div className={styles.columns}>
        <NavList label="Menu demo" heading="Settings" items={NAV_ITEMS} current={section} hrefOf={id => `?section=${id}`} onSelect={setSection} />
        <NavList label="List demo" mode="list" items={NAV_ITEMS} current={null} hrefOf={id => `?section=${id}`} onSelect={setSection} />
      </div>
    </div>
  );
}
