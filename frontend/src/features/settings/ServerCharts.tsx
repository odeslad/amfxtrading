import { useEffect, useRef, useState } from 'react';
import {
  createChart, LineSeries, LineStyle, CrosshairMode,
  type IChartApi, type Time, type LineData, type WhitespaceData,
} from 'lightweight-charts';
import type { HistoryPoint, HistoryRange, ServerEvent } from '../../lib/useServerStatus';
import styles from './ServerCharts.module.css';

interface ServerChartsProps {
  history: HistoryPoint[] | null;
  range: HistoryRange;
  onRange: (range: HistoryRange) => void;
  events: ServerEvent[] | null;
}

interface Marker {
  key: string;
  x: number;
  gapEnd: number | null;
  label: string;
  tone: 'error' | 'warn';
}

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

// A missing stretch (backend or server down) becomes a whitespace point, so the line breaks
// instead of joining across it.
function seriesOf(history: HistoryPoint[], step: number, pick: (p: HistoryPoint) => number | null): Point[] {
  const out: Point[] = [];
  let prev: number | null = null;
  for (const p of history) {
    const ms = Date.parse(p.t);
    if (prev !== null && ms - prev > GAP_FACTOR * step * 1000) out.push({ time: toChartTime(prev + step * 1000) });
    const value = pick(p);
    out.push(value === null ? { time: toChartTime(ms) } : { time: toChartTime(ms), value });
    prev = ms;
  }
  return out;
}

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function ServerCharts({ history, range, onRange, events }: ServerChartsProps) {
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

    // A crash or unclean stop is drawn where the samples stop, up to the first sample after it.
    const first = history.length > 0 ? Date.parse(history[0].t) : Infinity;
    const placeMarkers = () => {
      const scale = chart.timeScale();
      const next: Marker[] = [];
      for (const e of events ?? []) {
        const at = Date.parse(e.at);
        if (at < first) continue;
        const before = [...history].reverse().find(p => Date.parse(p.t) < at);
        const after = history.find(p => Date.parse(p.t) >= at);
        const x = scale.timeToCoordinate(toChartTime(before ? Date.parse(before.t) : at));
        if (x === null) continue;
        const end = after ? scale.timeToCoordinate(toChartTime(Date.parse(after.t))) : null;
        const downMin = before && after ? Math.round((Date.parse(after.t) - Date.parse(before.t)) / 60_000) : null;
        next.push({
          key: e.at,
          x,
          gapEnd: end,
          tone: e.kind === 'bugcheck' ? 'error' : 'warn',
          label: `${e.kind === 'bugcheck' ? `CRASH ${e.code ?? ''}` : 'UNEXPECTED SHUTDOWN'} · ${formatTime(before?.t ?? e.at)}${downMin ? ` · DOWN ${downMin} MIN` : ''}`,
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
  }, [history, range, events]);

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
          <div key={m.key} className={styles.marker} style={{ left: m.x }} aria-label={m.label} role="img">
            {m.gapEnd !== null && m.gapEnd > m.x && <span className={`${styles.gap} ${styles[`gap_${m.tone}`]}`} style={{ width: m.gapEnd - m.x }} />}
            <span className={`${styles.line} ${styles[`line_${m.tone}`]}`} />
            {m.gapEnd !== null && m.gapEnd > m.x && <span className={styles.restart} style={{ left: m.gapEnd - m.x }} />}
            <span className={`${styles.tag} ${styles[`tag_${m.tone}`]}`}>{m.label}</span>
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
