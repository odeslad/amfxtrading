import type { QuickOrders } from '../../lib/quickOrders';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Section,
  Select,
  Table,
  TextInput,
  Toggle,
  type TableColumn,
} from '../../shared/ui';
import { QuickOrdersSection } from './QuickOrdersSection';
import styles from './MirrorTab.module.css';

export interface MirrorBroker {
  id?: number;
  broker: string;
  enabled: boolean;
  lotsMode: 'fixed' | 'risk_pct';
  lots: number;
}

export interface MirrorPreset {
  id?: number;
  key: string;
  name: string;
  brokers: MirrorBroker[];
}

export interface AccountInfo {
  name: string;
  balance: number;
  currency: string;
}

interface MirrorTabProps {
  presets: MirrorPreset[];
  selectedKey: string;
  accounts: Record<string, AccountInfo>;
  quickOrders: QuickOrders | null;
  onQuickOrdersChange: (value: QuickOrders | null) => void;
  onSelect: (key: string) => void;
  onAdd: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onChange: (broker: string, patch: Partial<MirrorBroker>) => void;
}

type BrokerChange = (patch: Partial<MirrorBroker>) => void;

const fmtBalance = (a: AccountInfo | undefined): string =>
  a ? `${a.balance.toFixed(2)} ${a.currency === 'EUR' ? '€' : a.currency}` : '—';

// Lots typed as text so the phone keyboard offers the decimal separator; the
// value is parsed on every change and an incomplete number keeps the field.
function LotsInput({ m, onChange }: { m: MirrorBroker; onChange: BrokerChange }) {
  return (
    <span className={styles.lots}>
      <TextInput
        size="sm"
        className={styles.lotsInput}
        inputMode="decimal"
        defaultValue={String(m.lots)}
        disabled={!m.enabled}
        aria-label={m.lotsMode === 'fixed' ? 'Lots' : 'Risk %'}
        onChange={e => {
          const v = parseFloat(e.target.value.replace(',', '.'));
          if (Number.isFinite(v) && v >= 0) onChange({ lots: v });
        }}
      />
      <span className={styles.unit}>{m.lotsMode === 'fixed' ? 'lots' : '%'}</span>
    </span>
  );
}

function SizingSelect({ m, onChange }: { m: MirrorBroker; onChange: BrokerChange }) {
  return (
    <Select
      size="sm"
      value={m.lotsMode}
      disabled={!m.enabled}
      aria-label="Sizing"
      onChange={e => onChange({ lotsMode: e.target.value as 'fixed' | 'risk_pct' })}
    >
      <option value="fixed">Fixed lots</option>
      <option value="risk_pct">% Risk</option>
    </Select>
  );
}

function MirrorToggle({ m, onChange }: { m: MirrorBroker; onChange: BrokerChange }) {
  return <Toggle checked={m.enabled} onChange={enabled => onChange({ enabled })} label={`Mirror ${m.broker}`} />;
}

function PresetBar({ presets, selected, onSelect, onAdd, onRename, onDelete }: {
  presets: MirrorPreset[];
  selected: MirrorPreset;
  onSelect: (key: string) => void;
  onAdd: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className={styles.presetBar}>
      <Field label="Preset" htmlFor="mirror-preset-pick">
        <Select id="mirror-preset-pick" value={selected.key} onChange={e => onSelect(e.target.value)}>
          {presets.map(p => <option key={p.key} value={p.key}>{p.name.trim() || 'Untitled'}</option>)}
        </Select>
      </Field>
      <Field label="Name" htmlFor="mirror-preset-name">
        <TextInput id="mirror-preset-name" value={selected.name} maxLength={40} onChange={e => onRename(e.target.value)} />
      </Field>
      <div className={styles.presetActions}>
        <Button variant="buyOutline" onClick={onAdd}>+ New</Button>
        <Button variant="danger" onClick={onDelete} disabled={presets.length <= 1}>Delete</Button>
      </div>
    </div>
  );
}

export function MirrorTab({ presets, selectedKey, accounts, quickOrders, onQuickOrdersChange, onSelect, onAdd, onRename, onDelete, onChange }: MirrorTabProps) {
  const selected = presets.find(p => p.key === selectedKey) ?? presets[0];
  if (!selected) return null;
  const mirror = selected.brokers;
  if (mirror.length === 0) return <EmptyState>No brokers connected</EmptyState>;

  const change = (m: MirrorBroker): BrokerChange => patch => onChange(m.broker, patch);

  const columns: TableColumn<MirrorBroker>[] = [
    { key: 'broker', label: 'Broker', render: m => <span className={styles.broker}>{m.broker}</span> },
    { key: 'mirror', label: 'Mirror', render: m => <MirrorToggle m={m} onChange={change(m)} /> },
    { key: 'sizing', label: 'Sizing', render: m => <SizingSelect m={m} onChange={change(m)} /> },
    { key: 'lots', label: 'Lots / %', render: m => <LotsInput m={m} onChange={change(m)} /> },
    { key: 'account', label: 'Account', render: m => accounts[m.broker]?.name ?? '—' },
    { key: 'balance', label: 'Balance', mono: true, render: m => fmtBalance(accounts[m.broker]) },
  ];

  return (
    <div className={styles.tab}>
      <Section title="Mirror presets" description="Replicate trades across brokers. Each preset sets lots per broker: fixed, or % risk over the SL distance.">
      <div className={styles.presets}>
      <PresetBar presets={presets} selected={selected} onSelect={onSelect} onAdd={onAdd} onRename={onRename} onDelete={onDelete} />

      <Table
        caption="Mirror brokers"
        columns={columns}
        rows={mirror}
        rowKey={m => `${selected.key}-${m.broker}`}
        rowTone={m => (m.enabled ? undefined : 'muted')}
        renderCard={m => (
          <Card
            title={m.broker}
            accent={m.enabled ? 'orange' : 'neutral'}
            actions={<MirrorToggle m={m} onChange={change(m)} />}
          >
            <div className={styles.cardControls}>
              <SizingSelect m={m} onChange={change(m)} />
              <LotsInput m={m} onChange={change(m)} />
            </div>
          </Card>
        )}
      />
      </div>
      </Section>

      <QuickOrdersSection value={quickOrders} presets={presets} onChange={onQuickOrdersChange} />
    </div>
  );
}
