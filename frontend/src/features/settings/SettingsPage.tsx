import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, apiSend, errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { averagesLabel, useEmaNotifications, type EmaNotification, type NotificationInput } from '../../lib/useEmaNotifications';
import { ConfirmPanel } from '../journal/ConfirmPanel';
import { SETUP_LEVEL_KEYS } from '../journal/utils/position';
import { DEFAULT_FIB_LEVELS } from '../chart/DrawingTools';
import { DEFAULT_EMA_TRADES } from '../chart/emaTrades';
import { quickOrdersError } from '../../lib/quickOrders';
import { MirrorTab, type AccountInfo, type MirrorBroker, type MirrorPreset } from './MirrorTab';
import type { DisplaySettingsForm } from './displaySettings';
import { ChartSettings } from './ChartSettings';
import { CrossTradesSettings } from './CrossTradesSettings';
import { SetupLevelsSettings } from './SetupLevelsSettings';
import { MaTemplatesSection } from './MaTemplatesSection';
import { NotificationsTab } from './NotificationsTab';
import { NotificationPanel } from './NotificationPanel';
import { DevicesSection } from './DevicesSection';
import { VisibilityTab } from './VisibilityTab';
import { SymbolsPanel } from './SymbolsPanel';
import { useBrokerSymbols } from '../../lib/useBrokerSymbols';
import { DataSyncTab } from './DataSyncTab';
import { useCandleSync } from '../../lib/useCandleSync';
import { ServerTab } from './ServerTab';
import { ServerCharts } from './ServerCharts';
import { useServerStatus } from '../../lib/useServerStatus';
import { usePushDevices } from '../../lib/usePushDevices';
import { EMPTY_VISIBILITY, isBrokerVisible, publishVisibility, useVisibility, type Visibility } from '../../lib/visibility';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { Button, Hint, IconButton, NavList, type NavItem } from '../../shared/ui';
import styles from './SettingsPage.module.css';

const SECTIONS = ['trading', 'chart', 'indicators', 'alerts', 'brokers', 'system'] as const;
type SettingsSection = (typeof SECTIONS)[number];

const SECTION_ITEMS: NavItem<SettingsSection>[] = [
  { id: 'trading', label: 'Trading', summary: 'Mirror presets · Quick orders · New trade' },
  { id: 'chart', label: 'Chart', summary: 'P&L · Drawings · Price' },
  { id: 'indicators', label: 'Indicators', summary: 'MA templates · Cross trades · SL / TP labels' },
  { id: 'alerts', label: 'Alerts & notifications', summary: 'Rules · Devices' },
  { id: 'brokers', label: 'Brokers & data', summary: 'Brokers · Pairs · Candle history' },
  { id: 'system', label: 'System', summary: 'Server' },
];

// Links from before spec 058 used ?tab=.
const TAB_TO_SECTION: Record<string, SettingsSection> = {
  mirror: 'trading', display: 'chart', notifications: 'alerts', visibility: 'brokers', data: 'brokers', server: 'system',
};

const PHONE = '(max-width: 768px)';

const sectionHref = (id: SettingsSection): string => `/settings?section=${id}`;

const sectionFrom = (params: URLSearchParams): SettingsSection | null => {
  const requested = params.get('section');
  if (SECTIONS.includes(requested as SettingsSection)) return requested as SettingsSection;
  return TAB_TO_SECTION[params.get('tab') ?? ''] ?? null;
};

interface SavedPreset {
  id: number;
  name: string;
  brokers: MirrorBroker[];
}

interface SettingsResponse {
  presets: SavedPreset[];
  display: Partial<DisplaySettingsForm>;
  visibility?: Partial<Visibility>;
}

interface Balance {
  broker: string;
  name: string;
  balance: number;
  currency: string;
}

let presetKeySeq = 0;
const newPresetKey = (): string => `preset-${++presetKeySeq}`;

// Every preset lists every connected broker; one the preset has never seen starts disabled.
const toFormPreset = (preset: SavedPreset, brokerNames: string[]): MirrorPreset => {
  const existing = new Map(preset.brokers.map(m => [m.broker, m]));
  return {
    id: preset.id,
    key: `saved-${preset.id}`,
    name: preset.name,
    brokers: brokerNames.map(b => existing.get(b) ?? { broker: b, enabled: false, lotsMode: 'fixed' as const, lots: 0.01 }),
  };
};

const DEFAULT_DISPLAY: DisplaySettingsForm = { pnlMode: 'net', trendlineColor: '#8c8c8c', trendlineStyle: 'dashed', trendlineWidth: 1, rectLabels: true, showSpread: false, setupLevels: [...SETUP_LEVEL_KEYS], fibLevels: DEFAULT_FIB_LEVELS, emaTrades: DEFAULT_EMA_TRADES, quickOrders: null };

export function SettingsPage() {
  // The section lives in the URL (?section=…), so links and the browser's back button work.
  const [searchParams, setSearchParams] = useSearchParams();
  const phone = useMediaQuery(PHONE);
  const section: SettingsSection | null = sectionFrom(searchParams) ?? (phone ? null : 'trading');
  const openSection = (id: SettingsSection) => setSearchParams({ section: id });
  const [brokerNames, setBrokerNames] = useState<string[]>([]);
  const [presets, setPresets] = useState<MirrorPreset[]>([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState('');
  const [accounts, setAccounts] = useState<Record<string, AccountInfo>>({});
  const [display, setDisplay] = useState<DisplaySettingsForm>(DEFAULT_DISPLAY);
  const [visibility, setVisibility] = useState<Visibility>(EMPTY_VISIBILITY);
  const [symbolsBroker, setSymbolsBroker] = useState<string | null>(null);
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const brokerSymbols = useBrokerSymbols(section === 'brokers');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const { notifications, create, update, toggle, remove } = useEmaNotifications();
  const [panel, setPanel] = useState<{ notification: EmaNotification | null; nonce: number } | null>(null);
  const [deleting, setDeleting] = useState<EmaNotification | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pushDevices = usePushDevices();
  // Visibility also shows the history sync of pairs just turned on (spec 056).
  const candleSync = useCandleSync(section === 'brokers');
  const server = useServerStatus(section === 'system');

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      apiFetch<SettingsResponse>('/settings', { signal: ac.signal }),
      apiFetch<Balance[]>('/balances', { signal: ac.signal }),
    ]).then(([settings, balances]) => {
      const names = balances.map(b => b.broker);
      const formPresets = settings.presets.map(p => toFormPreset(p, names));
      setBrokerNames(names);
      setPresets(formPresets);
      setSelectedPresetKey(formPresets[0]?.key ?? '');
      setAccounts(Object.fromEntries(balances.map(b => [b.broker, { name: b.name, balance: b.balance, currency: b.currency }])));
      setDisplay({ ...DEFAULT_DISPLAY, ...settings.display, emaTrades: { ...DEFAULT_EMA_TRADES, ...settings.display?.emaTrades } });
      setVisibility({ ...EMPTY_VISIBILITY, ...settings.visibility });
    }).catch(() => {});
    return () => ac.abort();
  }, []);

  const updatePreset = useCallback((patch: (p: MirrorPreset) => MirrorPreset) => {
    setPresets(prev => prev.map(p => p.key === selectedPresetKey ? patch(p) : p));
    setDirty(true);
  }, [selectedPresetKey]);

  const updateBroker = useCallback((broker: string, patch: Partial<MirrorBroker>) => {
    updatePreset(p => ({ ...p, brokers: p.brokers.map(m => m.broker === broker ? { ...m, ...patch } : m) }));
  }, [updatePreset]);

  const renamePreset = useCallback((name: string) => updatePreset(p => ({ ...p, name })), [updatePreset]);

  const addPreset = useCallback(() => {
    const source = presets.find(p => p.key === selectedPresetKey) ?? presets[0];
    const key = newPresetKey();
    setPresets(prev => [...prev, { key, name: 'New preset', brokers: source ? source.brokers.map(m => ({ ...m })) : [] }]);
    setSelectedPresetKey(key);
    setDirty(true);
  }, [presets, selectedPresetKey]);

  const deletePreset = useCallback(() => {
    if (presets.length <= 1) return;
    const index = presets.findIndex(p => p.key === selectedPresetKey);
    const rest = presets.filter(p => p.key !== selectedPresetKey);
    setPresets(rest);
    setSelectedPresetKey(rest[Math.max(0, index - 1)]?.key ?? '');
    setDirty(true);
  }, [presets, selectedPresetKey]);

  const updateDisplay = useCallback((patch: Partial<DisplaySettingsForm>) => {
    setDisplay(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const toggleBrokerVisible = useCallback((broker: string, visible: boolean) => {
    setVisibility(prev => ({
      ...prev,
      hiddenBrokers: visible ? prev.hiddenBrokers.filter(b => b !== broker) : [...prev.hiddenBrokers, broker],
    }));
    setDirty(true);
  }, []);

  const openSymbols = useCallback((broker: string) => {
    setSymbolsBroker(broker);
    setSymbolsOpen(true);
  }, []);

  const handleSave = async () => {
    const quickError = quickOrdersError(display.quickOrders);
    if (quickError) { addToast(quickError, 'error'); return; }
    setSaving(true);
    try {
      const body = { presets: presets.map(p => ({ id: p.id, name: p.name.trim(), brokers: p.brokers })), display, visibility };
      const saved = await apiSend<SettingsResponse>('/settings', 'PUT', body);
      const selectedIndex = Math.max(0, presets.findIndex(p => p.key === selectedPresetKey));
      const savedPresets = saved.presets.map(p => toFormPreset(p, brokerNames));
      setPresets(savedPresets);
      setSelectedPresetKey(savedPresets[selectedIndex]?.key ?? savedPresets[0]?.key ?? '');
      publishVisibility({ hiddenBrokers: saved.visibility?.hiddenBrokers ?? [], hiddenSymbols: saved.visibility?.hiddenSymbols ?? {} });
      setDirty(false);
      addToast('Settings saved', 'success');
    } catch (err) {
      addToast(errorMessage(err, 'Network error saving settings'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveNotification = useCallback((input: NotificationInput, id: number | null) =>
    id === null ? create(input) : update(id, input), [create, update]);

  const handleToggle = (n: EmaNotification) =>
    toggle(n).catch(err => addToast(errorMessage(err, 'Failed to update the notification'), 'error'));

  const confirmDelete = async () => {
    if (!deleting) return;
    setConfirming(true);
    try {
      await remove(deleting.id);
      addToast('Notification deleted', 'success');
      setDeleting(null);
    } catch (err) {
      addToast(errorMessage(err, 'Failed to delete the notification'), 'error');
    } finally {
      setConfirming(false);
    }
  };

  const brokers = brokerNames;
  // The notification panel lists the saved visibility, not the unsaved form.
  const savedVisibility = useVisibility();
  const notificationBrokers = brokers.filter(b => isBrokerVisible(savedVisibility, b));
  const savable = section === 'trading' || section === 'chart' || section === 'indicators' || section === 'brokers';
  const current = SECTION_ITEMS.find(item => item.id === section);

  const actions = (
    <>
      {savable && dirty && <Hint tone="warning">Unsaved changes</Hint>}
      {savable && (
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      )}
      {section === 'brokers' && candleSync.dirty && <Hint tone="warning">Unsaved targets</Hint>}
      {section === 'brokers' && (
        <Button variant="primary" size="sm" onClick={candleSync.saveTargets} disabled={candleSync.saving || !candleSync.dirty}>
          {candleSync.saving ? 'Saving…' : 'Save targets'}
        </Button>
      )}
    </>
  );

  const devices = (
    <DevicesSection
      devices={pushDevices.devices}
      currentHash={pushDevices.currentHash}
      thisDeviceSubscribed={pushDevices.thisDeviceSubscribed}
      onRemove={pushDevices.remove}
      onChanged={pushDevices.reload}
    />
  );

  const content = (() => {
    switch (section) {
      case 'trading':
        return (
          <>
            <MirrorTab
              presets={presets}
              selectedKey={selectedPresetKey}
              accounts={accounts}
              quickOrders={display.quickOrders}
              onQuickOrdersChange={quickOrders => updateDisplay({ quickOrders })}
              onSelect={setSelectedPresetKey}
              onAdd={addPreset}
              onRename={renamePreset}
              onDelete={deletePreset}
              onChange={updateBroker}
            />
            <SetupLevelsSettings display={display} onChange={updateDisplay} />
          </>
        );
      case 'chart':
        return <ChartSettings display={display} onChange={updateDisplay} />;
      case 'indicators':
        return (
          <>
            <MaTemplatesSection />
            <CrossTradesSettings display={display} onChange={updateDisplay} />
          </>
        );
      case 'alerts':
        return (
          <>
            <NotificationsTab
              notifications={notifications}
              onToggle={handleToggle}
              onEdit={n => setPanel({ notification: n, nonce: Date.now() })}
              onDelete={setDeleting}
              onNew={() => setPanel({ notification: null, nonce: Date.now() })}
            />
            {devices}
          </>
        );
      case 'brokers':
        return (
          <>
            <VisibilityTab
              brokers={brokers}
              accounts={accounts}
              brokerSymbols={brokerSymbols.brokers}
              syncs={candleSync.brokers ?? []}
              onOpenData={() => document.getElementById('candle-history')?.scrollIntoView({ behavior: 'smooth' })}
              visibility={visibility}
              onToggleBroker={toggleBrokerVisible}
              onOpenSymbols={openSymbols}
            />
            <div id="candle-history">
              <DataSyncTab
                brokers={candleSync.brokers}
                edits={candleSync.edits}
                onTarget={candleSync.setTarget}
                onSync={candleSync.startSync}
              />
            </div>
          </>
        );
      case 'system':
        return (
          <ServerTab
            report={server.report}
            lastOkAt={server.lastOkAt}
            checkedAt={server.checkedAt}
            failing={server.failing}
            charts={<ServerCharts history={server.history} gaps={server.gaps} range={server.range} onRange={server.setRange} events={server.report?.events ?? null} />}
          />
        );
      default:
        return null;
    }
  })();

  const showList = phone && section === null;

  return (
    <div className={styles.page}>
      {!phone && (
        <NavList
          label="Settings sections"
          heading="Settings"
          items={SECTION_ITEMS}
          current={section}
          hrefOf={sectionHref}
          onSelect={openSection}
        />
      )}

      {showList ? (
        <NavList label="Settings sections" mode="list" items={SECTION_ITEMS} current={null} hrefOf={sectionHref} onSelect={openSection} />
      ) : (
        <main className={styles.content}>
          <header className={styles.header}>
            <span className={styles.titleLine}>
              {phone && <IconButton icon="‹" label="Back to Settings" variant="bare" onClick={() => setSearchParams({})} />}
              <h1 className={styles.title}>{current?.label}</h1>
            </span>
            <span className={styles.actions}>{actions}</span>
          </header>
          {content}
        </main>
      )}

      <NotificationPanel
        open={panel !== null}
        brokers={notificationBrokers}
        notification={panel?.notification ?? null}
        nonce={panel?.nonce ?? 0}
        onSave={saveNotification}
        onClose={() => setPanel(null)}
      />

      <SymbolsPanel
        open={symbolsOpen}
        state={symbolsBroker ? brokerSymbols.brokers[symbolsBroker] ?? null : null}
        onSave={brokerSymbols.save}
        onClose={() => setSymbolsOpen(false)}
      />

      <ConfirmPanel
        open={deleting !== null}
        title="Delete notification?"
        description={deleting ? `${deleting.symbols.length === 0 ? 'All symbols' : deleting.symbols.join(' · ')} · ${deleting.timeframe} · ${averagesLabel(deleting)}` : ''}
        detail={deleting?.broker}
        confirmLabel="Delete"
        confirmingLabel="Deleting…"
        confirming={confirming}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
