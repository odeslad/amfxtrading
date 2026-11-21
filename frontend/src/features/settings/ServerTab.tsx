import { useCallback, useState, type ReactNode } from 'react';
import type { ServerEvent, ServerReport, ServerTerminal } from '../../lib/useServerStatus';
import { Badge, Card, Gauge, Hint, IconButton, Loading, Section, StatusDot, Table, type DotState, type TableColumn, type Tone as UiTone } from '../../shared/ui';
import styles from './ServerTab.module.css';

interface ServerTabProps {
  report: ServerReport | null;
  lastOkAt: number | null;
  checkedAt: number | null;
  failing: boolean;
  charts?: ReactNode;
}

type Tone = 'ok' | 'warn' | 'error' | 'muted';
type SectionKey = 'charts' | 'services' | 'terminals' | 'events';

const COLLAPSED_KEY = 'amfx.server.collapsed';
const FRESH_TICK_S = 60;
const STALE_REPORT_S = 180;
const SERVICE_LABELS: Record<string, string> = {
  'postgresql-x64-17': 'PostgreSQL',
  nginx: 'nginx',
  Cloudflared: 'Cloudflare tunnel',
  sshd: 'SSH',
};
const TONE_ORDER: Record<Tone, number> = { error: 0, warn: 1, ok: 2, muted: 3 };

const gb = (mb: number): string => (mb / 1024).toFixed(1);

const formatDuration = (s: number | null): string => {
  if (s === null) return '—';
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${String(h).padStart(2, '0')} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} m`;
  return `${m} m`;
};

const formatAge = (s: number | null): string => {
  if (s === null) return '—';
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  return `${Math.floor(s / 3600)} h`;
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

const usageTone = (pct: number): Tone => (pct >= 90 ? 'error' : pct >= 70 ? 'warn' : 'ok');

function terminalState(t: ServerTerminal): { text: string; tone: Tone } {
  if (t.running === null) return { text: 'unknown', tone: 'muted' };
  if (!t.running) return { text: 'stopped', tone: 'error' };
  if (t.tickAgeS === null) return { text: 'no ticks', tone: 'muted' };
  if (t.pipe !== 'connected' || t.tickAgeS > FRESH_TICK_S) return { text: 'running', tone: 'warn' };
  return { text: 'running', tone: 'ok' };
}

// Problems first: stopped, then running without fresh ticks, then healthy, then silent.
const sortTerminals = (terminals: ServerTerminal[]) =>
  terminals
    .map(t => ({ ...t, state: terminalState(t) }))
    .sort((a, b) => TONE_ORDER[a.state.tone] - TONE_ORDER[b.state.tone]);

const readCollapsed = (): Partial<Record<SectionKey, boolean>> => {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '{}') as Partial<Record<SectionKey, boolean>>; } catch { return {}; }
};

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = useCallback((key: SectionKey) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

const GAUGE_TONE: Record<Tone, UiTone> = { ok: 'green', warn: 'gold', error: 'red', muted: 'neutral' };
const DOT_STATE: Record<Tone, DotState> = { ok: 'ok', warn: 'busy', error: 'off', muted: 'muted' };

interface ListRow {
  key: string;
  label: ReactNode;
  value: ReactNode;
}

const LIST_COLUMNS: TableColumn<ListRow>[] = [
  { key: 'label', label: 'Name', render: r => r.label },
  { key: 'value', label: 'State', align: 'right', mono: true, render: r => r.value },
];

function CollapsibleSection({ title, shortTitle, summary, tone, open, onToggle, children }: {
  title: string; shortTitle?: string; summary?: string; tone?: Tone; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <Section
      title={shortTitle
        ? <><span className={styles.titleLong}>{title}</span><span className={styles.titleShort}>{shortTitle}</span></>
        : title}
      actions={
        <>
          {summary && <span className={`${styles.summary} ${tone ? styles[tone] : ''}`}>{summary}</span>}
          <IconButton
            icon={open ? '▴' : '▾'}
            label={open ? `Collapse ${title}` : `Expand ${title}`}
            aria-expanded={open}
            onClick={onToggle}
          />
        </>
      }
    >
      {open && <div className={styles.sectionBody}>{children}</div>}
    </Section>
  );
}

function UsageGauge({ label, value, unit, pct }: { label: string; value: string; unit?: string; pct: number | null }) {
  const tone = pct === null ? 'muted' : usageTone(pct);
  return <Gauge label={label} value={pct ?? 0} display={value} unit={unit ?? ''} tone={GAUGE_TONE[tone]} />;
}

function eventLabel(e: ServerEvent): { text: string; tone: Tone } {
  return e.kind === 'bugcheck' ? { text: 'Crash (bugcheck)', tone: 'error' } : { text: 'Unexpected shutdown', tone: 'warn' };
}

type TerminalRow = ServerTerminal & { state: { text: string; tone: Tone } };

export function ServerTab({ report, lastOkAt, checkedAt, failing, charts }: ServerTabProps) {
  const { collapsed, toggle } = useCollapsed();

  if (!report) return <Loading label={failing ? 'The server monitor is not answering' : 'Reading the server…'} />;

  const memPct = (report.memUsedMb / report.memTotalMb) * 100;
  const pagePct = report.pageFileMb === null ? null : (report.pageFileMb / report.memTotalMb) * 100;
  const diskUsedPct = report.diskFreeGb === null || !report.diskTotalGb ? null : (1 - report.diskFreeGb / report.diskTotalGb) * 100;
  const terminals: TerminalRow[] = sortTerminals(report.terminals);
  const running = report.terminals.filter(t => t.running).length;
  const terminalsTone: Tone = terminals.some(t => t.state.tone === 'error') ? 'error' : terminals.some(t => t.state.tone === 'warn') ? 'warn' : 'ok';
  const servicesUp = report.services.filter(s => s.state === 'running').length;
  const events = report.events ?? [];
  const lastCrash = report.lastBootAfterCrash ? events.find(e => e.kind === 'bugcheck') ?? events[0] : null;
  const outOfDateS = failing && lastOkAt && checkedAt ? Math.round((checkedAt - lastOkAt) / 1000) : null;
  const sampleAgeS = report.sampledAt && checkedAt ? Math.max(0, Math.round((checkedAt - Date.parse(report.sampledAt)) / 1000)) : null;
  const probeStale = report.staleS !== null && report.staleS > STALE_REPORT_S;
  const headerTone: Tone = report.lastBootAfterCrash || terminalsTone === 'error' ? 'error' : terminalsTone === 'warn' || probeStale ? 'warn' : 'ok';

  const serviceRows: ListRow[] = report.services.map(s => ({
    key: s.name,
    label: SERVICE_LABELS[s.name] ?? s.name,
    value: <span className={s.state === 'running' ? styles.ok : styles.error}>● {s.state}</span>,
  }));
  const backendRows: ListRow[] = [
    { key: 'uptime', label: 'Uptime', value: formatDuration(report.backend.uptimeS) },
    { key: 'memory', label: 'Memory', value: `${report.backend.rssMb} MB` },
    { key: 'restarts', label: 'Restarts', value: report.backend.restarts ?? '—' },
  ];

  const terminalColumns: TableColumn<TerminalRow>[] = [
    { key: 'broker', label: 'Broker', render: t => <span className={t.state.tone === 'muted' ? styles.muted : undefined}>{t.broker}</span> },
    { key: 'terminal', label: 'Terminal', mono: true, render: t => <span className={styles[t.state.tone]}>● {t.state.text}</span> },
    { key: 'pipe', label: 'Pipe', mono: true, render: t => <span className={t.state.tone === 'ok' ? undefined : styles[t.state.tone]}>{t.pipe ?? '—'}</span> },
    { key: 'tick', label: 'Last tick', align: 'right', mono: true, render: t => <span className={t.state.tone === 'ok' ? undefined : styles[t.state.tone]}>{formatAge(t.tickAgeS)}</span> },
    { key: 'memory', label: 'Memory', align: 'right', mono: true, render: t => (t.memMb === null ? '—' : `${t.memMb} MB`) },
  ];

  const eventColumns: TableColumn<ServerEvent>[] = [
    { key: 'at', label: 'When', mono: true, render: e => formatDate(e.at) },
    { key: 'kind', label: 'Event', render: e => <span className={styles[eventLabel(e).tone]}>{eventLabel(e).text}</span> },
    { key: 'code', label: 'Code', align: 'right', mono: true, render: e => <span className={styles.muted}>{e.code ? `${e.code} · ${e.param1}` : '—'}</span> },
  ];

  const staleTitle = outOfDateS !== null ? `The server has not answered for ${formatAge(outOfDateS)}` : `Windows figures are ${formatAge(report.staleS)} old`;

  return (
    <div className={styles.page}>
      {(outOfDateS !== null || probeStale) && (
        <Hint tone="warning" boxed title={staleTitle}>
          Showing the last figures received. They update by themselves when it answers again.
        </Hint>
      )}

      <Section
        accent="orange"
        title={
          <span className={styles.hostLine}>
            <StatusDot state={DOT_STATE[headerTone]} />
            <span className={styles.host}>{report.host ?? '—'}</span>
          </span>
        }
        description={`${report.os ?? ''} · ${report.cores} cores · ${gb(report.memTotalMb)} GB`}
        actions={
          <span className={styles.facts}>
            <span className={styles.fact}><span className={styles.factLabel}>Last boot</span><span className={styles.mono}>{formatDate(report.bootAt)}</span></span>
            <span className={styles.fact}><span className={styles.factLabel}>Uptime</span><span className={styles.mono}>{formatDuration(report.uptimeS)}</span></span>
            {lastCrash && <Badge tone="red">After a {lastCrash.kind === 'bugcheck' ? `crash · ${lastCrash.code}` : 'shutdown'}</Badge>}
          </span>
        }
      />

      <div className={styles.gauges}>
        <UsageGauge label="CPU" value={report.cpu === null ? '—' : `${report.cpu.toFixed(1)} %`} pct={report.cpu} />
        <UsageGauge label="Memory" value={gb(report.memUsedMb)} unit={`/ ${gb(report.memTotalMb)} GB`} pct={memPct} />
        <UsageGauge label="Page file" value={report.pageFileMb === null ? '—' : gb(report.pageFileMb)} unit="GB" pct={pagePct} />
        <UsageGauge label="Disk C: free" value={report.diskFreeGb === null ? '—' : report.diskFreeGb.toFixed(0)} unit={report.diskTotalGb ? `/ ${report.diskTotalGb.toFixed(0)} GB` : undefined} pct={diskUsedPct} />
      </div>

      {charts && (
        <CollapsibleSection title="CPU and memory" open={!collapsed.charts} onToggle={() => toggle('charts')}>
          {charts}
        </CollapsibleSection>
      )}

      <div className={styles.columns}>
        <CollapsibleSection title="Services" summary={`${servicesUp} / ${report.services.length} running`} tone={servicesUp === report.services.length ? 'ok' : 'error'} open={!collapsed.services} onToggle={() => toggle('services')}>
          <Table caption="Services" columns={LIST_COLUMNS} rows={serviceRows} rowKey={r => r.key} />
          <span className={styles.subLabel}>Backend</span>
          <Table caption="Backend" columns={LIST_COLUMNS} rows={backendRows} rowKey={r => r.key} />
        </CollapsibleSection>

        <CollapsibleSection title="Terminals" summary={`${running} / ${report.terminals.length} running`} tone={terminalsTone} open={!collapsed.terminals} onToggle={() => toggle('terminals')}>
          <Table
            caption="Terminals"
            columns={terminalColumns}
            rows={terminals}
            rowKey={t => t.broker}
            rowTone={t => (t.state.tone === 'error' ? 'error' : undefined)}
            renderCard={t => (
              <Card
                title={t.broker}
                accent={t.state.tone === 'error' ? 'red' : 'none'}
                meta={`Pipe ${t.pipe ?? '—'}${t.memMb === null ? '' : ` · ${t.memMb} MB`} · last tick ${formatAge(t.tickAgeS)}`}
                actions={<span className={`${styles.mono} ${styles[t.state.tone]}`}>● {t.state.text}</span>}
              />
            )}
          />
        </CollapsibleSection>
      </div>

      <CollapsibleSection title="Crashes and unexpected shutdowns · last 30 days" shortTitle="Crashes · 30 days" summary={report.events === null ? 'not read yet' : `${events.length} ${events.length === 1 ? 'event' : 'events'}`} tone={events.length > 0 ? 'error' : 'ok'} open={!collapsed.events} onToggle={() => toggle('events')}>
        {events.length === 0
          ? <Hint>{report.events === null ? 'The event log is read every 10 minutes.' : 'None in the last 30 days.'}</Hint>
          : <Table caption="Events" columns={eventColumns} rows={events} rowKey={e => e.at} />}
      </CollapsibleSection>

      <Hint>Updated {formatAge(sampleAgeS)} ago · refreshes every 15 s</Hint>
    </div>
  );
}
