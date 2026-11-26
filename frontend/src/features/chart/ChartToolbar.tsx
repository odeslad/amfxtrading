import { memo, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { IconIndicators, IconFilters, IconTrendline, IconPositions, IconFullscreen, IconFullscreenExit, IconRect, IconFib, IconEmaTrades, IconRuler, IconMarkerUp, IconMarkerDown, IconBell, IconLock, IconUnlock, IconCross, IconCheck, IconText, IconSplit, IconSplitLayouts, IconLink, IconUnlink } from '../../shared/ui/icons';
import type { DrawMode } from './LightweightChart';
import styles from './ChartToolbar.module.css';

// The native list ignores option padding: non-breaking spaces leave room after the longest name.
const OPTION_ROOM = '    ';

const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'];

export type PositionsMode = 'none' | 'all' | 'buys' | 'sells';

interface ChartToolbarProps {
  brokers: string[];
  symbols: string[];
  broker: string;
  symbol: string;
  brokerHidden?: boolean;
  symbolHidden?: boolean;
  timeframe: string;
  onBrokerChange: (v: string) => void;
  onSymbolChange: (v: string) => void;
  onTimeframeChange: (v: string) => void;
  onIndicators: () => void;
  onFilters: () => void;
  drawMode?: DrawMode | null;
  onDrawMode?: (mode: DrawMode) => void;
  onPositions?: () => void;
  positionsMode?: PositionsMode;
  onAlerts?: () => void;
  alertsActive?: boolean;
  alertsFlashing?: boolean;
  locked?: boolean;
  onToggleLock?: () => void;
  // EMA cross trades overlay (spec 039): a toggle, highlighted while the overlay is on.
  emaTradesActive?: boolean;
  onToggleEmaTrades?: () => void;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
  // Split view (spec 036): desktop only, hidden when the page cannot split.
  splitAvailable?: boolean;
  splitActive?: boolean;
  onSplit?: () => void;
  // Spec 063: opens the split layouts panel; the left chart only, desktop only.
  onSplitLayouts?: () => void;
  splitLayoutsOpen?: boolean;
  // Spec 060: split view only — the two sides share broker and pair while linked.
  linked?: boolean;
  onToggleLink?: () => void;
}

interface DrawTool {
  mode: DrawMode;
  title: string;
  label: string;
  icon: ReactNode;
}

const DRAW_TOOLS: DrawTool[] = [
  { mode: 'line', title: 'Trendline (Shift = horizontal, Ctrl+drag = duplicate, Del = delete)', label: 'Trendline', icon: <IconTrendline size={16} /> },
  { mode: 'rect', title: 'Rectangle', label: 'Rectangle', icon: <IconRect size={16} /> },
  { mode: 'fib', title: 'Fibonacci retracement (two clicks, Ctrl+drag = duplicate, Del = delete)', label: 'Fibonacci', icon: <IconFib size={16} /> },
  { mode: 'ruler', title: 'Pip ruler (two clicks to measure, Esc/click to clear)', label: 'Pip ruler', icon: <IconRuler size={16} /> },
  { mode: 'markerBuy', title: 'Buy marker', label: 'Buy marker', icon: <IconMarkerUp size={16} /> },
  { mode: 'markerSell', title: 'Sell marker', label: 'Sell marker', icon: <IconMarkerDown size={16} /> },
  { mode: 'symbolCross', title: 'Cross mark', label: 'Cross mark', icon: <IconCross size={16} /> },
  { mode: 'symbolCheck', title: 'Check mark', label: 'Check mark', icon: <IconCheck size={16} /> },
  { mode: 'text', title: 'Text label (double-click to edit)', label: 'Text label', icon: <IconText size={16} /> },
];

export const ChartToolbar = memo(function ChartToolbar({
  brokers, symbols, broker, symbol, brokerHidden, symbolHidden, timeframe,
  onBrokerChange, onSymbolChange, onTimeframeChange, onIndicators, onFilters, drawMode, onDrawMode,
  onPositions, positionsMode = 'none', onAlerts, alertsActive, alertsFlashing, locked = false, onToggleLock, emaTradesActive = false, onToggleEmaTrades, onFullscreen, isFullscreen,
  splitAvailable = false, splitActive = false, onSplit, onSplitLayouts, splitLayoutsOpen = false, linked = true, onToggleLink,
}: ChartToolbarProps) {
  // Mobile only: the drawing tools live in a second row opened by Draw (spec 025).
  // Not reset when a drawing ends, so the next one is one tap away.
  const [drawOpen, setDrawOpen] = useState(false);
  // Desktop: the drawing tools fold behind Draw only when the whole row does not fit the chart.
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const fullWidthRef = useRef(0);
  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const check = () => {
      if (!compact) {
        if (el.scrollWidth > el.clientWidth + 1) {
          fullWidthRef.current = el.scrollWidth;
          setCompact(true);
        }
      } else if (el.clientWidth >= fullWidthRef.current) {
        setCompact(false);
      }
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact]);

  return (
    <div ref={toolbarRef} className={`${styles.toolbar} ${compact ? styles.compact : ''}`} data-chart-toolbar>
      <div className={styles.selects}>
        <div className={styles.symbolSelects}>
          <select className={styles.select} value={broker} onChange={e => onBrokerChange(e.target.value)}>
            <option value="">Broker</option>
            {brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}{brokerHidden && b === broker ? ' · hidden' : ''}{OPTION_ROOM}</option>)}
          </select>

          <select className={styles.select} value={symbol} onChange={e => onSymbolChange(e.target.value)} disabled={!broker}>
            <option value="">Symbol</option>
            {symbols.map(s => <option key={s} value={s}>{s}{symbolHidden && s === symbol ? ' · hidden' : ''}{OPTION_ROOM}</option>)}
          </select>

        </div>

        <div className={styles.tfGroup}>
          <select className={styles.select} value={timeframe} onChange={e => onTimeframeChange(e.target.value)} aria-label="Timeframe">
            {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
          </select>
        </div>

      </div>

      <div className={styles.tools}>
        <select
          className={`${styles.select} ${styles.tfSelect}`}
          value={timeframe}
          onChange={e => onTimeframeChange(e.target.value)}
        >
          {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
        </select>
        <button
          type="button"
          className={[
            styles.iconBtn,
            positionsMode !== 'none' ? styles.iconBtnActive : '',
            positionsMode === 'buys' ? styles.iconBtnBuys : '',
            positionsMode === 'sells' ? styles.iconBtnSells : '',
          ].join(' ')}
          onClick={onPositions}
          title={`Positions: ${positionsMode} (click to cycle none / all / buys / sells)`}
          aria-label={`Positions: ${positionsMode}`}
        >
          <IconPositions size={16} />
        </button>
        <button
          type="button"
          className={`${styles.iconBtn} ${alertsActive ? styles.iconBtnActive : ''} ${alertsFlashing ? styles.iconBtnFlashing : ''}`}
          onClick={onAlerts}
          title="Price alerts"
          aria-label="Price alerts"
        >
          <IconBell size={16} />
        </button>
        <button
          type="button"
          className={`${styles.iconBtn} ${locked ? styles.iconBtnActive : ''}`}
          onClick={onToggleLock}
          title={locked ? 'Unlock drawings, positions and alerts' : 'Lock drawings, positions and alerts'}
          aria-label={locked ? 'Unlock chart' : 'Lock chart'}
          aria-pressed={locked}
        >
          {locked ? <IconLock size={16} /> : <IconUnlock size={16} />}
        </button>

        <div className={`${styles.drawTools} ${drawOpen ? styles.drawToolsOpen : ''}`}>
          {DRAW_TOOLS.map(t => (
            <button
              key={t.mode}
              type="button"
              className={`${styles.iconBtn} ${drawMode === t.mode ? styles.iconBtnActive : ''}`}
              onClick={() => onDrawMode?.(t.mode)}
              title={t.title}
              aria-label={t.label}
            >
              {t.icon}
            </button>
          ))}
          {onToggleEmaTrades && (
            <button
              type="button"
              className={`${styles.iconBtn} ${emaTradesActive ? styles.iconBtnActive : ''}`}
              onClick={onToggleEmaTrades}
              title={emaTradesActive ? 'Hide the EMA cross trades' : 'Show the last EMA cross trades (entry + SL)'}
              aria-label="EMA cross trades"
              aria-pressed={emaTradesActive}
            >
              <IconEmaTrades size={16} />
            </button>
          )}
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.mobileOnly}`}
            onClick={onIndicators}
            title="Indicators"
            aria-label="Indicators"
          >
            <IconIndicators size={16} />
          </button>
        </div>

        <button
          type="button"
          className={styles.iconBtn}
          onClick={onFilters}
          title="Filters"
          aria-label="Filters"
        >
          <IconFilters size={16} />
        </button>
        {onToggleLink && (
          <button
            type="button"
            className={`${styles.iconBtn} ${linked ? styles.iconBtnActive : ''}`}
            onClick={onToggleLink}
            title={linked ? 'Linked: both charts share broker and pair' : 'Unlinked: each chart has its own broker and pair'}
            aria-label={linked ? 'Unlink the charts' : 'Link the charts'}
            aria-pressed={linked}
          >
            {linked ? <IconLink size={16} /> : <IconUnlink size={16} />}
          </button>
        )}
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.desktopOnly}`}
          onClick={onIndicators}
          title="Indicators"
          aria-label="Indicators"
        >
          <IconIndicators size={16} />
        </button>
        {splitAvailable && onSplitLayouts && (
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.desktopOnly} ${splitLayoutsOpen ? styles.iconBtnActive : ''}`}
            onClick={onSplitLayouts}
            title="Split layouts"
            aria-label="Split layouts"
            aria-expanded={splitLayoutsOpen}
          >
            <IconSplitLayouts size={16} />
          </button>
        )}
        {splitAvailable && onSplit && (
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.desktopOnly} ${splitActive ? styles.iconBtnActive : ''}`}
            onClick={onSplit}
            title={splitActive ? 'Close split view' : 'Split view (two timeframes)'}
            aria-label={splitActive ? 'Close split view' : 'Split view'}
            aria-pressed={splitActive}
          >
            <IconSplit size={16} />
          </button>
        )}
        {onFullscreen && (
          <button
            type="button"
            className={`${styles.iconBtn} ${isFullscreen ? styles.iconBtnActive : ''}`}
            onClick={onFullscreen}
            title="Fullscreen"
            aria-label="Fullscreen"
          >
            {isFullscreen ? <IconFullscreenExit size={16} /> : <IconFullscreen size={16} />}
          </button>
        )}
        <button
          type="button"
          className={`${styles.drawToggle} ${drawOpen ? styles.drawToggleOpen : ''}`}
          onClick={() => setDrawOpen(open => !open)}
          aria-expanded={drawOpen}
        >
          Draw
        </button>
      </div>
    </div>
  );
});
