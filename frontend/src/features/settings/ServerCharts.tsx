import { useEffect, useRef, useState } from 'react';
import {
  createChart, LineSeries, LineStyle, CrosshairMode,
  type IChartApi, type Time, type LineData, type WhitespaceData,
} from 'lightweight-charts';
import type { HistoryGap, HistoryPoint, HistoryRange, ServerEvent } from '../../lib/useServerStatus';
import styles from './ServerCharts.module.css';

interface ServerChartsProps {
  history: HistoryPoint[] | null;
  gaps: HistoryGap[] | null;
  range: HistoryRange;
  onRange: (range: HistoryRange) => void;
  events: ServerEvent[] | null;
}

interface Marker {
  key: string;
  x: number;
  gapEnd: number | null;
  label: string;
  short: string;
  tone: 'error' | 'warn' | 'restart';
  showTag: boolean;
}

const TAG_SPACING_PX = 120;

const STEP_S: Record<HistoryRange, number> = { '24h': 60, '7d': 600 };
// Samples come every step ±1 s; one missing sample (a backend restart) already breaks the line.
const GAP_FACTOR = 1.5;
const HEIGHT_KEY = 'amfx.server.chartHeight';
const MIN_HEIGHT = 140;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 220;
const clampHeight = (h: number): number => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(h)));
const readHeight = (): number => {
  const saved = Number(localStorage.getItem(HEIGHT_KEY));
  return saved ? clampHeight(saved) : DEFAULT_HEIGHT;
};
const COLORS = { cpu: '#3a7bd5', mem: '#f5a623', page: '#666666' };

// lightweight-charts draws in UTC; shifting by the browser's offset shows local hours.
const LOCAL_SHIFT_S = -new Date().getTimezoneOffset() * 60;
const toChartTime = (ms: number): Time => (Math.floor(ms / 1000) + LOCAL_SHIFT_S) as Time;

type Point = LineData<Time> | WhitespaceData<Time>;

// lightweight-charts joins a line across whitespace points, but draws each segment in the
// colour of the point it starts from: the last point before a missing stretch (backend or
// server down) gets a transparent colour, so the segment over the hole is not drawn.
function seriesOf(history: HistoryPoint[], step: number, pick: (p: HistoryPoint) => number | null): Point[] {
  const out: Point[] = [];
  let prev: number | null = null;
  for (const p of history) {
    const ms = Date.parse(p.t);
    if (prev !== null && ms - prev > GAP_FACTOR * step * 1000) {
      const last = out[out.length - 1];
      if (last && 'value' in last) out[out.length - 1] = { ...last, color: 'transparent' };
    }
    const value = pick(p);
    out.push(value === null ? { time: toChartTime(ms) } : { time: toChartTime(ms), value });
    prev = ms;
  }
  return out;
}

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function ServerCharts({ history, gaps, range, onRange, events }: ServerChartsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [height, setHeight] = useState(readHeight);

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    let latest = startH;
    const move = (ev: PointerEvent) => { latest = clampHeight(startH + ev.clientY - startY); setHeight(latest); };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      localStorage.setItem(HEIGHT_KEY, String(latest));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const resizeByKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const next = clampHeight(height + (e.key === 'ArrowDown' ? 20 : -20));
    setHeight(next);
    localStorage.setItem(HEIGHT_KEY, String(next));
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !history) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: '#161616' },
        textColor: '#8a8a8a',
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.06)' } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#1e1e1e', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#1e1e1e', width: 1, style: LineStyle.Dashed },
      },
      leftPriceScale: { visible: true, borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.04, bottom: 0.02 } },
      rightPriceScale: { visible: true, borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false, rightOffset: 0, minBarSpacing: 0.01 },
      handleScroll: false,
      handleScale: false,
    });

    const step = STEP_S[range];
    const cpu = chart.addSeries(LineSeries, {
      color: COLORS.cpu, lineWidth: 2, priceScaleId: 'left', lastValueVisible: false, priceLineVisible: false,
      autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
      priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(0)} %` },
    });
    const mem = chart.addSeries(LineSeries, {
      color: COLORS.mem, lineWidth: 2, priceScaleId: 'right', lastValueVisible: false, priceLineVisible: false,
      priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(1)} GB` },
    });
    const page = chart.addSeries(LineSeries, {
      color: COLORS.page, lineWidth: 1, priceScaleId: 'right', lastValueVisible: false, priceLineVisible: false,
      priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(1)} GB` },
    });
    cpu.setData(seriesOf(history, step, p => p.cpu));
    mem.setData(seriesOf(history, step, p => p.memUsedMb / 1024));
    page.setData(seriesOf(history, step, p => (p.pageFileMb === null ? null : p.pageFileMb / 1024)));
    chart.timeScale().fitContent();
    chartRef.current = chart;

    // Every hole in the minute samples (from /server/gaps, so the 10-minute buckets of 7D do
    // not hide short ones) is marked from the last sample before it to the first after it: a
    // crash or unclean stop of Windows when the event log has one inside the hole, otherwise
    // a restart of the backend (deploy, pm2 restart).
    const holes = (gaps ?? []).map(g => ({ from: Date.parse(g.from), to: Date.parse(g.to) }));
    const times = history.map(p => Date.parse(p.t));
    // timeToCoordinate only knows the times of the data points and counts from the plot area,
    // which starts after the left (CPU) price scale: other times are placed between their
    // neighbouring points.
    const placeMarkers = () => {
      const scale = chart.timeScale();
      const left = chart.priceScale('left').width();
      const xOf = (ms: number): number | null => scale.timeToCoordinate(toChartTime(ms));
      const toX = (ms: number): number | null => {
        if (times.length === 0 || ms < times[0] || ms > times[times.length - 1]) return null;
        const i = times.findIndex(t => t >= ms);
        if (times[i] === ms) { const x = xOf(ms); return x === null ? null : x + left; }
        const x0 = xOf(times[i - 1]);
        const x1 = xOf(times[i]);
        if (x0 === null || x1 === null) return null;
        return x0 + (x1 - x0) * ((ms - times[i - 1]) / (times[i] - times[i - 1])) + left;
      };
      const next: Marker[] = [];
      let lastTagX = -Infinity;
      for (const g of holes) {
        const x = toX(g.from);
        if (x === null) continue;
        const event = (events ?? []).find(e => { const at = Date.parse(e.at); return at > g.from && at <= g.to + 15 * 60_000; });
        const downMin = Math.max(1, Math.round((g.to - g.from) / 60_000));
        const what = !event ? 'Backend restart' : event.kind === 'bugcheck' ? `Crash ${event.code ?? ''} (${event.param1 ?? ''})` : 'Unexpected shutdown';
        const at = formatTime(new Date(g.from).toISOString());
        // Holes close together (7D) keep their lines but share one label.
        const showTag = x - lastTagX > TAG_SPACING_PX;
        if (showTag) lastTagX = x;
        next.push({
          key: String(g.from),
          x,
          gapEnd: toX(g.to),
          tone: !event ? 'restart' : event.kind === 'bugcheck' ? 'error' : 'warn',
          label: what,
          short: `${at} · ${downMin} min`,
          showTag,
        });
      }
      setMarkers(next);
    };
    const frame = requestAnimationFrame(placeMarkers);
    chart.timeScale().subscribeSizeChange(placeMarkers);

    return () => {
      cancelAnimationFrame(frame);
      chart.timeScale().unsubscribeSizeChange(placeMarkers);
      chart.remove();
      chartRef.current = null;
    };
  }, [history, gaps, range, events]);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.legend}>
          <span><i style={{ background: COLORS.cpu }} />CPU %</span>
          <span><i style={{ background: COLORS.mem }} />Memory GB</span>
          <span><i style={{ background: COLORS.page }} />Page file GB</span>
        </div>
        <div className={styles.ranges} role="group" aria-label="Range">
          {(['24h', '7d'] as const).map(r => (
            <button key={r} type="button" className={`${styles.range} ${r === range ? styles.rangeActive : ''}`} aria-pressed={r === range} onClick={() => onRange(r)}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.chartBox} style={{ height }}>
        <div ref={containerRef} className={styles.chart} />
        {!history && <div className={styles.overlayText}>Loading…</div>}
        {history && history.length === 0 && <div className={styles.overlayText}>No samples yet</div>}
        {markers.map(m => (
          <div key={m.key} className={styles.marker} style={{ left: m.x }} aria-label={`${m.label}: ${m.short}`} role="img">
            {m.gapEnd !== null && m.gapEnd > m.x && <span className={`${styles.gap} ${styles[`gap_${m.tone}`]}`} style={{ width: m.gapEnd - m.x }} />}
            <span className={`${styles.line} ${styles[`line_${m.tone}`]}`} />
            {m.gapEnd !== null && m.gapEnd > m.x && <span className={styles.restart} style={{ left: m.gapEnd - m.x }} />}
            {m.showTag && <span className={`${styles.tag} ${styles[`tag_${m.tone}`]}`} title={m.label}>{m.short}</span>}
          </div>
        ))}
      </div>
      <div
        className={styles.resizer}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize the chart"
        aria-valuenow={height}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={MAX_HEIGHT}
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={resizeByKey}
      >
        <span className={styles.grip} />
      </div>
    </div>
  );
}
