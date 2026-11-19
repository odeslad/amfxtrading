import { useCallback, useState, type ReactNode } from 'react';
import type { ServerEvent, ServerReport, ServerTerminal } from '../../lib/useServerStatus';
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

function Section({ title, summary, tone, open, onToggle, children }: {
  title: string; summary?: string; tone?: Tone; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.label}>{title}</span>
        <span className={styles.sectionRight}>
          {summary && <span className={`${styles.summary} ${tone ? styles[tone] : ''}`}>{summary}</span>}
          <button type="button" className={styles.collapseBtn} aria-expanded={open} aria-label={open ? `Collapse ${title}` : `Expand ${title}`} onClick={onToggle}>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d={open ? 'M2 6.5 L5 3.5 L8 6.5' : 'M2 3.5 L5 6.5 L8 3.5'} fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </span>
      </div>
      {open && children}
    </section>
  );
}

function Gauge({ label, value, unit, pct }: { label: string; value: string; unit?: string; pct: number | null }) {
  const tone = pct === null ? 'muted' : usageTone(pct);
  return (
    <div className={styles.gauge}>
      <span className={styles.label}>{label}</span>
      <span className={styles.gaugeValue}>{value}{unit && <span className={styles.gaugeUnit}> {unit}</span>}</span>
      <span className={styles.bar} role="meter" aria-label={label} aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
        <span className={`${styles.barFill} ${styles[`fill_${tone}`]}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
      </span>
    </div>
  );
}

function eventLabel(e: ServerEvent): { text: string; tone: Tone } {
  return e.kind === 'bugcheck' ? { text: 'Crash (bugcheck)', tone: 'error' } : { text: 'Unexpected shutdown', tone: 'warn' };
}

export function ServerTab({ report, lastOkAt, checkedAt, failing, charts }: ServerTabProps) {
  const { collapsed, toggle } = useCollapsed();

  if (!report) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>{failing ? 'The server monitor is not answering' : 'Reading the server…'}</div>
      </div>
    );
  }

  const memPct = (report.memUsedMb / report.memTotalMb) * 100;
  const pagePct = report.pageFileMb === null ? null : (report.pageFileMb / report.memTotalMb) * 100;
  const diskUsedPct = report.diskFreeGb === null || !report.diskTotalGb ? null : (1 - report.diskFreeGb / report.diskTotalGb) * 100;
  const terminals = sortTerminals(report.terminals);
  const running = report.terminals.filter(t => t.running).length;
  const terminalsTone: Tone = terminals.some(t => t.state.tone === 'error') ? 'error' : terminals.some(t => t.state.tone === 'warn') ? 'warn' : 'ok';
  const servicesUp = report.services.filter(s => s.state === 'running').length;
  const events = report.events ?? [];
  const lastCrash = report.lastBootAfterCrash ? events.find(e => e.kind === 'bugcheck') ?? events[0] : null;
  const outOfDateS = failing && lastOkAt && checkedAt ? Math.round((checkedAt - lastOkAt) / 1000) : null;
  const sampleAgeS = report.sampledAt && checkedAt ? Math.max(0, Math.round((checkedAt - Date.parse(report.sampledAt)) / 1000)) : null;
  const probeStale = report.staleS !== null && report.staleS > STALE_REPORT_S;
  const headerTone: Tone = report.lastBootAfterCrash || terminalsTone === 'error' ? 'error' : terminalsTone === 'warn' || probeStale ? 'warn' : 'ok';

  return (
    <div className={styles.page}>
      {(outOfDateS !== null || probeStale) && (
        <div className={styles.stale} role="status">
          <span className={styles.warn}>
            {outOfDateS !== null ? `The server has not answered for ${formatAge(outOfDateS)}` : `Windows figures are ${formatAge(report.staleS)} old`}
          </span>
          <span className={styles.muted}>Showing the last figures received. They update by themselves when it answers again.</span>
        </div>
      )}

      <header className={styles.machine}>
        <div className={styles.machineName}>
          <span className={styles.hostLine}>
            <span className={`${styles.dot} ${styles[`dot_${headerTone}`]}`} aria-hidden="true" />
            <span className={styles.host}>{report.host ?? '—'}</span>
          </span>
          <span className={styles.muted}>{report.os ?? ''} · {report.cores} cores · {gb(report.memTotalMb)} GB</span>
        </div>
        <div className={styles.machineFacts}>
          <div className={styles.fact}><span className={styles.label}>Last boot</span><span className={styles.mono}>{formatDate(report.bootAt)}</span></div>
          <div className={styles.fact}><span className={styles.label}>Uptime</span><span className={styles.mono}>{formatDuration(report.uptimeS)}</span></div>
          {lastCrash && (
            <span className={styles.crashBadge}>AFTER A {lastCrash.kind === 'bugcheck' ? `CRASH · ${lastCrash.code}` : 'SHUTDOWN'}</span>
          )}
        </div>
      </header>

      <div className={styles.gauges}>
        <Gauge label="CPU" value={report.cpu === null ? '—' : `${report.cpu.toFixed(1)} %`} pct={report.cpu} />
        <Gauge label="Memory" value={gb(report.memUsedMb)} unit={`/ ${gb(report.memTotalMb)} GB`} pct={memPct} />
        <Gauge label="Page file" value={report.pageFileMb === null ? '—' : gb(report.pageFileMb)} unit="GB" pct={pagePct} />
        <Gauge label="Disk C: free" value={report.diskFreeGb === null ? '—' : report.diskFreeGb.toFixed(0)} unit={report.diskTotalGb ? `/ ${report.diskTotalGb.toFixed(0)} GB` : undefined} pct={diskUsedPct} />
      </div>

      {charts && (
        <Section title="CPU and memory" open={!collapsed.charts} onToggle={() => toggle('charts')}>
          {charts}
        </Section>
      )}

      <div className={styles.columns}>
        <Section title="Services" summary={`${servicesUp} / ${report.services.length} running`} tone={servicesUp === report.services.length ? 'ok' : 'error'} open={!collapsed.services} onToggle={() => toggle('services')}>
          <ul className={styles.list}>
            {report.services.map(s => (
              <li key={s.name} className={styles.row}>
                <span>{SERVICE_LABELS[s.name] ?? s.name}</span>
                <span className={`${styles.state} ${s.state === 'running' ? styles.ok : styles.error}`}>● {s.state}</span>
              </li>
            ))}
          </ul>
          <span className={`${styles.label} ${styles.subLabel}`}>Backend</span>
          <ul className={styles.list}>
            <li className={styles.row}><span className={styles.muted}>Uptime</span><span className={styles.mono}>{formatDuration(report.backend.uptimeS)}</span></li>
            <li className={styles.row}><span className={styles.muted}>Memory</span><span className={styles.mono}>{report.backend.rssMb} MB</span></li>
            <li className={styles.row}><span className={styles.muted}>Restarts</span><span className={styles.mono}>{report.backend.restarts ?? '—'}</span></li>
          </ul>
        </Section>

        <Section title="Terminals" summary={`${running} / ${report.terminals.length} running`} tone={terminalsTone} open={!collapsed.terminals} onToggle={() => toggle('terminals')}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr><th>Broker</th><th>Terminal</th><th>Pipe</th><th className={styles.num}>Last tick</th><th className={styles.num}>Memory</th></tr>
              </thead>
              <tbody>
                {terminals.map(t => (
                  <tr key={t.broker} className={t.state.tone === 'error' ? styles.rowError : undefined}>
                    <td className={t.state.tone === 'muted' ? styles.muted : undefined}>{t.broker}</td>
                    <td className={`${styles.mono} ${styles[t.state.tone]}`}>● {t.state.text}</td>
                    <td className={`${styles.mono} ${t.state.tone === 'ok' ? '' : styles[t.state.tone]}`}>{t.pipe ?? '—'}</td>
                    <td className={`${styles.mono} ${styles.num} ${t.state.tone === 'ok' ? '' : styles[t.state.tone]}`}>{formatAge(t.tickAgeS)}</td>
                    <td className={`${styles.mono} ${styles.num}`}>{t.memMb === null ? '—' : `${t.memMb} MB`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.cards}>
            {terminals.map(t => (
              <div key={t.broker} className={`${styles.card} ${t.state.tone === 'error' ? styles.cardError : ''}`}>
                <div className={styles.row}><span className={styles.cardTitle}>{t.broker}</span><span className={`${styles.mono} ${styles[t.state.tone]}`}>● {t.state.text}</span></div>
                <div className={`${styles.row} ${styles.muted}`}>
                  <span>Pipe {t.pipe ?? '—'}{t.memMb === null ? '' : ` · ${t.memMb} MB`}</span>
                  <span className={styles.mono}>last tick {formatAge(t.tickAgeS)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Crashes and unexpected shutdowns · last 30 days" summary={report.events === null ? 'not read yet' : `${events.length} ${events.length === 1 ? 'event' : 'events'}`} tone={events.length > 0 ? 'error' : 'ok'} open={!collapsed.events} onToggle={() => toggle('events')}>
        {events.length === 0
          ? <p className={styles.muted}>{report.events === null ? 'The event log is read every 10 minutes.' : 'None in the last 30 days.'}</p>
          : (
            <ul className={styles.list}>
              {events.map(e => {
                const label = eventLabel(e);
                return (
                  <li key={e.at} className={styles.row}>
                    <span className={styles.mono}>{formatDate(e.at)}</span>
                    <span className={styles[label.tone]}>{label.text}</span>
                    <span className={`${styles.mono} ${styles.muted}`}>{e.code ? `${e.code} · ${e.param1}` : '—'}</span>
                  </li>
                );
              })}
            </ul>
          )}
      </Section>

      <p className={styles.footer}>Updated {formatAge(sampleAgeS)} ago · refreshes every 15 s</p>
    </div>
  );
}
