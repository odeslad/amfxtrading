import { useState, useEffect, useCallback, useRef, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, errorMessage } from '../../lib/api';
import { modifyCommand, sendCommands } from '../../lib/commands';
import { trackBatch } from '../../lib/commandBatch';
import { expandWithGroups } from '../journal/groupExpansion';
import { addToast } from '../../lib/toast';
import { useWs } from '../../lib/useWs';
import { useTickSubscription } from '../../lib/useTickSubscription';
import { useAuth } from '../auth/useAuth';
import { ChartFiltersPanel } from './ChartFiltersPanel';
import { AlertsPanel } from './AlertsPanel';
import { useAlerts, type PriceAlert } from '../../lib/useAlerts';
import { useEmaAlerts } from '../../lib/useEmaAlerts';
import { useDisplaySettings } from '../../lib/useDisplaySettings';
import { useEmaTradesSettings } from '../../lib/useEmaTradesSettings';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { isBrokerVisible, isSymbolVisible, useVisibility } from '../../lib/visibility';
import type { TrendlineAppearance } from './DrawingTools';
import { IndicatorsPanel } from './IndicatorsPanel';
import { useMaTemplates } from '../../lib/useMaTemplates';
import { ChartSlot, type ChartSide } from './ChartSlot';
import { useChartSymbols } from './useChartSymbols';
import { BulkEditPanel } from '../journal/BulkEditPanel';
import { ClosePositionPanel } from '../journal/ClosePositionPanel';
import { SplitLayoutsPanel } from './SplitLayoutsPanel';
import { isLinkedLayout, useSplitLayouts, type SplitLayout } from '../../lib/useSplitLayouts';
import { NewTradePanel, type NewTradeOrder } from '../journal/NewTradePanel';
import { QuickOrderConfirm } from './QuickOrderConfirm';
import { useQuickOrders } from '../../lib/useQuickOrders';
import type { QuickOrderPlan } from '../../lib/quickOrders';
import type { CommandAction } from '../../lib/commands';
import type { Position } from '../journal/utils/position';
import styles from './ChartPage.module.css';

// One string per positions list: setPositions only when something visible changed (spec 019).
const positionsSignature = (list: Position[]): string =>
  list.map(p => `${p.ticket}|${p.type}|${p.lots}|${p.openPrice}|${p.sl}|${p.tp}|${p.profit}`).join(';');

// Split view (spec 036): the right chart opens one timeframe above the left one.
const NEXT_TIMEFRAME_UP: Record<string, string> = { M5: 'M15', M15: 'H1', H1: 'H4', H4: 'D1', D1: 'H1' };
const nextTimeframeUp = (tf: string): string => NEXT_TIMEFRAME_UP[tf] ?? 'H4';

interface SplitState {
  on: boolean;
  rightTimeframe: string;
  ratio: number;
  // Left timeframe at the moment the split was closed: reopening restores the same pair.
  leftTimeframe?: string;
  // Spec 060: while linked (the default) the right chart shows the left broker and pair.
  linked?: boolean;
  rightBroker?: string;
  rightSymbol?: string;
  // Left broker and pair replaced by the unlinked right chart's on a close from the right; reopening restores them.
  leftBroker?: string;
  leftSymbol?: string;
}

const EMPTY_POSITIONS: Position[] = [];

const DEFAULT_SPLIT: SplitState = { on: false, rightTimeframe: 'H4', ratio: 0.5 };
const SPLIT_RATIO_MIN = 0.25;
const SPLIT_RATIO_MAX = 0.75;
const DIVIDER_WIDTH = 6;

// Narrowest width a slot can take without clipping its toolbar: the toolbar's two
// groups never shrink, so their widths plus gap and padding are its min-content.
const toolbarMinWidth = (area: HTMLElement): number => {
  const toolbar = area.querySelector<HTMLElement>('[data-chart-toolbar]');
  if (!toolbar) return 0;
  const style = getComputedStyle(toolbar);
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const gap = parseFloat(style.columnGap) || 0;
  const groups = Array.from(toolbar.children) as HTMLElement[];
  return groups.reduce((sum, g) => sum + g.offsetWidth, 0) + gap * Math.max(0, groups.length - 1) + padding;
};

// Ratio bounds for the current area width: 25–75 %, tightened so neither toolbar clips.
const clampSplitRatio = (area: HTMLElement, ratio: number): number => {
  const width = area.getBoundingClientRect().width - DIVIDER_WIDTH;
  if (width <= 0) return ratio;
  const minFraction = toolbarMinWidth(area) / width;
  const min = Math.max(SPLIT_RATIO_MIN, minFraction);
  const max = Math.min(SPLIT_RATIO_MAX, 1 - minFraction);
  if (min > max) return 0.5;
  return Math.min(max, Math.max(min, ratio));
};

export function ChartPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // URL query params take precedence (deep links from the journal/legend);
  // otherwise fall back to the last selection persisted in localStorage.
  const [stored, setStored] = useLocalStorage('chart.selection', { broker: '', symbol: '', timeframe: 'H1' });
  const initBroker = searchParams.get('broker') ?? stored.broker;
  const initSymbol = searchParams.get('symbol') ?? stored.symbol;
  const initTimeframe = searchParams.get('timeframe') ?? stored.timeframe;

  const [allBrokers, setBrokers] = useState<string[]>([]);
  const [allSymbols, setSymbols] = useState<string[]>([]);
  const [broker, setBroker] = useState(initBroker);
  const [symbol, setSymbol] = useState(initSymbol);
  const [timeframe, setTimeframe] = useState(initTimeframe);

  // Hidden brokers / symbols (spec 024) leave the selectors; the current selection stays listed,
  // marked as hidden, until the operator picks another one (AC 5).
  const visibility = useVisibility();
  // The fetch effects read the visibility through a ref so a save does not refetch the lists.
  const visibilityRef = useRef(visibility);
  useEffect(() => { visibilityRef.current = visibility; }, [visibility]);
  const brokerHidden = !!broker && !isBrokerVisible(visibility, broker);
  const symbolHidden = !!broker && !!symbol && !isSymbolVisible(visibility, broker, symbol);
  const brokers = useMemo(() => {
    const list = allBrokers.filter(b => isBrokerVisible(visibility, b));
    return brokerHidden && allBrokers.includes(broker) ? [...list, broker] : list;
  }, [allBrokers, visibility, broker, brokerHidden]);
  const symbols = useMemo(() => {
    const list = allSymbols.filter(s => isSymbolVisible(visibility, broker, s));
    return symbolHidden && allSymbols.includes(symbol) ? [...list, symbol] : list;
  }, [allSymbols, visibility, broker, symbol, symbolHidden]);

  // Persist the current selection whenever it changes.
  useEffect(() => {
    setStored({ broker, symbol, timeframe });
  }, [broker, symbol, timeframe, setStored]);

  useEffect(() => {
    if (searchParams.toString()) setSearchParams({}, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Last bid of the selected symbol: seeds the alerts panel price when it opens.
  const lastBidsRef = useRef<Record<string, number>>({});
  const pairKey = (pairBroker: string, pairSymbol: string): string => `${pairBroker}|${pairSymbol}`;
  // The pair of the panels (alerts, indicators, New Trade): the side that opened them.
  const panelBrokerRef = useRef('');
  const panelSymbolRef = useRef('');
  const rightPairRef = useRef({ broker: '', symbol: '' });
  // Price shown by the alerts panel; fed only while the panel is open.
  const [panelPrice, setPanelPrice] = useState<number | null>(null);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [indicatorsTimeframe, setIndicatorsTimeframe] = useState('H1');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [newTradeOpen, setNewTradeOpen] = useState(false);
  const [alertFlash, setAlertFlash] = useState(false);
  const { user } = useAuth();
  const { alerts, refresh: refreshAlerts, create: createAlert, toggle: toggleAlert, updatePrice: updateAlertPrice, remove: removeAlert } = useAlerts();
  const { alerts: emaAlerts, create: createEmaAlert, toggle: toggleEmaAlert, remove: removeEmaAlert } = useEmaAlerts();
  const chartAlerts = useMemo(
    () => alerts.filter(a => a.broker === broker && a.symbol === symbol),
    [alerts, broker, symbol],
  );
  // Dragged on the chart (spec 028): the chart drops its optimistic price when this rejects.
  const moveAlert = useCallback(async (id: number, price: number) => {
    try {
      await updateAlertPrice(id, price);
    } catch (err) {
      addToast(errorMessage(err, 'Failed to move alert'), 'error');
      throw err;
    }
  }, [updateAlertPrice]);
  const [alertEditRequest, setAlertEditRequest] = useState<{ id: number; nonce: number } | null>(null);
  const editAlertFromChart = useCallback((a: PriceAlert) => {
    setAlertEditRequest({ id: a.id, nonce: Date.now() });
    setAlertsOpen(true);
  }, []);
  const toggleAlertFromChart = useCallback((a: PriceAlert) => {
    toggleAlert(a).catch(err => addToast(errorMessage(err, 'Failed to update alert'), 'error'));
  }, [toggleAlert]);
  const deleteAlertFromChart = useCallback((a: PriceAlert) => {
    removeAlert(a.id).catch(err => addToast(errorMessage(err, 'Failed to delete alert'), 'error'));
  }, [removeAlert]);
  // Spec 060: positions of every broker, since each side of the split chart has its own.
  const [positionsByBroker, setPositionsByBroker] = useState<Record<string, Position[]>>({});
  const positionsSigRef = useRef<Record<string, string>>({});
  // Only the brokers on screen: every broker sends its positions each second.
  const shownBrokersRef = useRef<string[]>([]);
  // Spec 062: every broker's rows, kept out of state so the brokers off screen cause no render;
  // read when an action on a grouped entry must reach its siblings on other brokers.
  const everyBrokerRowsRef = useRef<Record<string, Position[]>>({});
  const everyRow = useCallback((): Position[] => Object.values(everyBrokerRowsRef.current).flat(), []);
  const acceptPositions = useCallback((positionsBroker: string, list: Position[]) => {
    everyBrokerRowsRef.current[positionsBroker] = list;
    if (!shownBrokersRef.current.includes(positionsBroker)) return;
    const sig = positionsSignature(list);
    if (sig === positionsSigRef.current[positionsBroker]) return;
    positionsSigRef.current[positionsBroker] = sig;
    setPositionsByBroker(prev => ({ ...prev, [positionsBroker]: list }));
  }, []);
  const positions = positionsByBroker[broker] ?? EMPTY_POSITIONS;
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const [closePosition, setClosePosition] = useState<Position | null>(null);
  // The entry and the open members of its group, taken when the panel opens.
  const [editGroup, setEditGroup] = useState<Position[]>([]);
  const [closeGroup, setCloseGroup] = useState<Position[]>([]);
  const [showSpread, setShowSpread] = useState(false);
  const [trendlineAppearance, setTrendlineAppearance] = useState<TrendlineAppearance>({ color: '#8c8c8c', style: 'dashed', width: 1 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Which chart fills the page while fullscreen in split view; both show otherwise.
  const [fullscreenSide, setFullscreenSide] = useState<ChartSide>('left');

  // Split view (spec 036): desktop only; the right timeframe and the ratio survive a close.
  const [split, setSplit] = useLocalStorage<SplitState>('chart.split', DEFAULT_SPLIT);
  const isDesktop = useMediaQuery('(min-width: 769px)');
  const showSplit = split.on && isDesktop;
  const selectionRef = useRef({ timeframe, broker, symbol });
  useEffect(() => { selectionRef.current = { timeframe, broker, symbol }; }, [timeframe, broker, symbol]);
  // Closing from a chart keeps that chart: from the right one, its timeframe (AC 5) and, while
  // unlinked, its broker and pair become the single chart's. Reopening restores the pair of
  // charts that was closed; the very first split opens the next timeframe up on the right.
  const toggleSplit = useCallback((side: ChartSide) => {
    setSplit(prev => {
      if (!prev.on) {
        if (prev.leftBroker) setBroker(prev.leftBroker);
        if (prev.leftSymbol) setSymbol(prev.leftSymbol);
        const restored = { ...prev, on: true, leftBroker: undefined, leftSymbol: undefined };
        if (prev.leftTimeframe) {
          setTimeframe(prev.leftTimeframe);
          return restored;
        }
        return { ...restored, rightTimeframe: nextTimeframeUp(selectionRef.current.timeframe) };
      }
      const current = selectionRef.current;
      const closed = { ...prev, on: false, leftTimeframe: current.timeframe, leftBroker: undefined, leftSymbol: undefined };
      if (side === 'left') return closed;
      setTimeframe(prev.rightTimeframe);
      if ((prev.linked ?? true) || !prev.rightBroker || !prev.rightSymbol) return closed;
      setBroker(prev.rightBroker);
      setSymbol(prev.rightSymbol);
      return { ...closed, leftBroker: current.broker, leftSymbol: current.symbol };
    });
  }, [setSplit]);
  const toggleSplitLeft = useCallback(() => toggleSplit('left'), [toggleSplit]);
  const toggleSplitRight = useCallback(() => toggleSplit('right'), [toggleSplit]);
  const setRightTimeframe = useCallback((tf: string) => {
    setSplit(prev => ({ ...prev, rightTimeframe: tf }));
  }, [setSplit]);
  const pageRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // Divider drag (AC 8): the ratio follows the pointer inside the chart area, 25–75 %,
  // and is persisted with the rest of the split state on release.
  const startDividerDrag = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const area = chartAreaRef.current;
    if (!area || e.button !== 0) return;
    e.preventDefault();
    const rect = area.getBoundingClientRect();
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      const ratio = clampSplitRatio(area, (ev.clientX - rect.left) / rect.width);
      setSplit(prev => (prev.ratio === ratio ? prev : { ...prev, ratio }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setDragging(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [setSplit]);

  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add('chartDividerDragging');
    return () => document.body.classList.remove('chartDividerDragging');
  }, [dragging]);

  // A persisted ratio may not fit a narrower window: re-clamp whenever the area resizes.
  const splitLayoutActive = showSplit && !isFullscreen;
  useEffect(() => {
    const area = chartAreaRef.current;
    if (!splitLayoutActive || !area) return;
    const observer = new ResizeObserver(() => {
      setSplit(prev => {
        const ratio = clampSplitRatio(area, prev.ratio);
        return ratio === prev.ratio ? prev : { ...prev, ratio };
      });
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, [splitLayoutActive, setSplit]);
  const maTemplates = useMaTemplates();

  // iOS Safari (iPhone) has no Fullscreen API for arbitrary elements, so keep our
  // own state and fall back to a CSS fullscreen when the native API is missing.
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenEnabled) setIsFullscreen(document.fullscreenElement === pageRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const nativeFullscreen = typeof document !== 'undefined'
    && document.fullscreenEnabled
    && typeof document.documentElement.requestFullscreen === 'function';

  // The page element goes fullscreen (its side panels are fixed children, so they stay
  // visible); in split view only the chart that asked for it is rendered meanwhile.
  const toggleFullscreen = useCallback((side: ChartSide) => {
    const el = pageRef.current;
    if (!el) return;
    setFullscreenSide(side);
    const canNative = document.fullscreenEnabled && typeof el.requestFullscreen === 'function';
    if (canNative) {
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen();
    } else {
      // CSS fullscreen fallback for iPhone
      setIsFullscreen(prev => !prev);
    }
  }, []);
  const toggleFullscreenLeft = useCallback(() => toggleFullscreen('left'), [toggleFullscreen]);
  const toggleFullscreenRight = useCallback(() => toggleFullscreen('right'), [toggleFullscreen]);

  // CSS fallback (iPhone): hide the app chrome (topbar + bottom nav) while
  // fullscreen, since `position: fixed` alone is unreliable inside Safari iOS.
  useEffect(() => {
    if (nativeFullscreen) return;
    document.body.classList.toggle('chartFullscreenActive', isFullscreen);
    return () => document.body.classList.remove('chartFullscreenActive');
  }, [isFullscreen, nativeFullscreen]);

  useEffect(() => {
    apiFetch<{ display: { trendlineColor?: string; trendlineStyle?: string; trendlineWidth?: number; rectLabels?: boolean; showSpread?: boolean; fibLevels?: number[] } }>('/settings')
      .then(data => {
        setShowSpread(data.display?.showSpread ?? false);
        const color = data.display?.trendlineColor;
        const style = data.display?.trendlineStyle;
        const width = data.display?.trendlineWidth;
        const rectLabels = data.display?.rectLabels;
        const fibLevels = data.display?.fibLevels;
        if (color || style || width || rectLabels !== undefined || fibLevels) {
          setTrendlineAppearance(prev => ({
            color: color ?? prev.color,
            style: (style as TrendlineAppearance['style']) ?? prev.style,
            width: width ?? prev.width,
            rectLabels: rectLabels ?? prev.rectLabels,
            fibLevels: fibLevels ?? prev.fibLevels,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const [balances, setBalances] = useState<Record<string, number>>({});
  const { pnlMode } = useDisplaySettings();
  const emaTradesSettings = useEmaTradesSettings();
  const quickOrders = useQuickOrders();
  const [quickOrder, setQuickOrder] = useState<{ symbol: string; plan: QuickOrderPlan } | null>(null);
  const openQuickOrder = useCallback((symbol: string, plan: QuickOrderPlan) => setQuickOrder({ symbol, plan }), []);
  const closeQuickOrder = useCallback(() => setQuickOrder(null), []);

  useEffect(() => {
    apiFetch<{ broker: string; balance: number }[]>('/balances')
      .then(data => {
        const list = data.map(b => b.broker);
        setBrokers(list);
        setBalances(Object.fromEntries(data.map(b => [b.broker, b.balance])));
        // pick the first visible broker if none is selected or the stored one is gone
        const pick = list.find(b => isBrokerVisible(visibilityRef.current, b)) ?? list[0];
        if (pick && !list.includes(broker)) setBroker(pick);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Broker changed to none: clear the symbol list during render.
  const [prevBroker, setPrevBroker] = useState(broker);
  if (broker !== prevBroker) {
    setPrevBroker(broker);
    if (!broker) { setSymbols([]); setSymbol(''); }
  }

  useEffect(() => {
    if (!broker) return;
    const ac = new AbortController();
    apiFetch<string[]>(`/symbols?broker=${encodeURIComponent(broker)}`, { signal: ac.signal })
      .then(list => {
        setSymbols(list);
        const visible = list.filter(s => isSymbolVisible(visibilityRef.current, broker, s));
        setSymbol(prev => list.includes(prev) ? prev : visible.includes('EURUSD') ? 'EURUSD' : visible[0] ?? list[0] ?? '');
      })
      .catch(() => {});
    return () => ac.abort();
  }, [broker]);

  // Ctrl + Arrows cycle the chart context in default list order:
  // Up/Down → symbol, Left/Right → broker.
  const symbolsRef = useRef<string[]>([]);
  const symbolRef = useRef('');
  const brokersRef = useRef<string[]>([]);
  const brokerRef = useRef('');
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);
  useEffect(() => { symbolRef.current = symbol; }, [symbol]);
  useEffect(() => { brokersRef.current = brokers; }, [brokers]);
  useEffect(() => { brokerRef.current = broker; }, [broker]);

  useEffect(() => {
    const cycle = (list: string[], current: string, step: number): string | null => {
      if (list.length === 0) return null;
      const idx = list.indexOf(current);
      const next = idx === -1 ? 0 : (idx + step + list.length) % list.length;
      return list[next];
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const next = cycle(symbolsRef.current, symbolRef.current, e.key === 'ArrowUp' ? -1 : 1);
        if (next === null) return;
        e.preventDefault();
        setSymbol(next);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const next = cycle(brokersRef.current, brokerRef.current, e.key === 'ArrowLeft' ? -1 : 1);
        if (next === null) return;
        e.preventDefault();
        setBroker(next);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Page-level stream: fired alerts, live positions and the alerts panel price.
  // Each ChartSlot has its own subscriber for the candles of its timeframe (spec 036).
  // The alerts panel price follows the chart pair (spec 041).
  useTickSubscription(broker, symbol);

  useWs(useCallback((msg: unknown) => {
    const m = msg as {
      type: string;
      broker: string;
      brokerOffset?: number;
      currency?: string;
      userId?: number;
      ticks?: ({ symbol: string } & Record<string, number>)[];
      positions?: Position[];
    };

    // A price alert fired (any broker/symbol, for this user): flash; AppLayout plays the sound.
    if (m.type === 'alert') {
      if (user && m.userId === user.id) {
        setAlertFlash(true);
        refreshAlerts();
      }
      return;
    }

    if (m.type === 'positions') {
      acceptPositions(m.broker, (m.positions ?? []).map(p => ({
        ...p,
        broker: p.broker ?? m.broker,
        brokerOffset: p.brokerOffset ?? m.brokerOffset,
        currency: p.currency ?? m.currency,
      })));
      return;
    }

    if (m.type !== 'ticks' || !m.ticks) return;
    for (const t of m.ticks) {
      const key = pairKey(m.broker, t.symbol);
      lastBidsRef.current[key] = t.bid;
      if (alertsOpen && key === pairKey(panelBrokerRef.current, panelSymbolRef.current)) setPanelPrice(t.bid);
    }
  }, [user, refreshAlerts, alertsOpen, acceptPositions]));

  const shownRightBroker = showSplit ? ((split.linked ?? true) ? broker : split.rightBroker ?? broker) : broker;
  useEffect(() => {
    shownBrokersRef.current = [broker, shownRightBroker];
    const ac = new AbortController();
    apiFetch<{ broker: string; brokerOffset?: number; currency?: string; positions: Position[] }[]>('/positions/live', { signal: ac.signal })
      .then(entries => {
        for (const entry of entries) {
          acceptPositions(entry.broker, (entry.positions ?? []).map(p => ({
            ...p,
            broker: p.broker ?? entry.broker,
            brokerOffset: p.brokerOffset ?? entry.brokerOffset,
            currency: p.currency ?? entry.currency,
          })));
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, [acceptPositions, broker, shownRightBroker]);

  // Stable handlers so the memoised panels and toolbar skip renders (spec 019).
  // Spec 060: indicators, alerts and New Trade open for the side that asked.
  const [panelSide, setPanelSide] = useState<ChartSide>('left');
  const openIndicatorsFor = useCallback((side: ChartSide, tf: string) => { setPanelSide(side); setIndicatorsTimeframe(tf); setIndicatorsOpen(true); }, []);
  const openIndicatorsLeft = useCallback((tf: string) => openIndicatorsFor('left', tf), [openIndicatorsFor]);
  const openIndicatorsRight = useCallback((tf: string) => openIndicatorsFor('right', tf), [openIndicatorsFor]);
  const closeIndicators = useCallback(() => setIndicatorsOpen(false), []);
  // Spec 060: the filters panel (broker and pair on desktop) edits the side that opened it.
  const [filtersSide, setFiltersSide] = useState<ChartSide>('left');
  const openFiltersLeft = useCallback(() => { setFiltersSide('left'); setFiltersOpen(true); }, []);
  const openFiltersRight = useCallback(() => { setFiltersSide('right'); setFiltersOpen(true); }, []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  // Spec 063: named split layouts, applied from either chart's toolbar.
  const splitLayouts = useSplitLayouts();
  const [layoutsOpen, setLayoutsOpen] = useState(false);
  const toggleLayouts = useCallback(() => setLayoutsOpen(open => !open), []);
  const closeLayouts = useCallback(() => setLayoutsOpen(false), []);
  const applySplitLayout = useCallback((layout: SplitLayout) => {
    setBroker(layout.left.broker);
    setSymbol(layout.left.symbol);
    setTimeframe(layout.left.timeframe);
    // The width (ratio) stays; the close/reopen memory of the left chart no longer applies.
    setSplit(prev => ({
      ...prev,
      on: true,
      rightTimeframe: layout.right.timeframe,
      linked: isLinkedLayout(layout),
      rightBroker: layout.right.broker,
      rightSymbol: layout.right.symbol,
      leftTimeframe: undefined,
      leftBroker: undefined,
      leftSymbol: undefined,
    }));
    setLayoutsOpen(false);
  }, [setSplit]);
  const closeAlerts = useCallback(() => setAlertsOpen(false), []);
  // New Trade carries the timeframe of the chart it was opened from (AC 7).
  const [newTradeTimeframe, setNewTradeTimeframe] = useState(timeframe);
  // Spec 054: the order type and price chosen in the chart menu; the key makes each request apply once.
  const [newTradeOrder, setNewTradeOrder] = useState<NewTradeOrder | undefined>(undefined);
  const openNewTradeFor = useCallback((side: ChartSide, tf: string, order?: { action: CommandAction; price: number }) => {
    setPanelSide(side);
    setNewTradeTimeframe(tf);
    setNewTradeOrder(order ? { ...order, key: Date.now() } : undefined);
    setNewTradeOpen(true);
    setEditPosition(null);
  }, []);
  const openNewTradeLeft = useCallback((tf: string, order?: { action: CommandAction; price: number }) => openNewTradeFor('left', tf, order), [openNewTradeFor]);
  const openNewTradeRight = useCallback((tf: string, order?: { action: CommandAction; price: number }) => openNewTradeFor('right', tf, order), [openNewTradeFor]);
  const closeNewTrade = useCallback(() => setNewTradeOpen(false), []);
  const clearEdit = useCallback(() => setEditPosition(null), []);
  const clearClose = useCallback(() => setClosePosition(null), []);
  const editPositions = editPosition ? editGroup : EMPTY_POSITIONS;
  const closePositions = closePosition ? closeGroup : EMPTY_POSITIONS;

  const toggleAlertsFor = useCallback((side: ChartSide) => {
    setPanelSide(side);
    const pair = side === 'right' ? rightPairRef.current : { broker: brokerRef.current, symbol: symbolRef.current };
    setPanelPrice(lastBidsRef.current[pairKey(pair.broker, pair.symbol)] ?? null);
    setAlertsOpen(prev => !prev);
    setAlertFlash(false);
  }, []);
  const toggleAlertsLeft = useCallback(() => toggleAlertsFor('left'), [toggleAlertsFor]);
  const toggleAlertsRight = useCallback(() => toggleAlertsFor('right'), [toggleAlertsFor]);

  const positionActions = useCallback((list: Position[]) => ({
    onEditPosition: (ticket: number) => {
      const pos = list.find(p => p.ticket === ticket);
      if (pos) { setEditGroup(expandWithGroups([pos], everyRow())); setEditPosition(pos); setNewTradeOpen(false); }
    },
    onClosePosition: (ticket: number) => {
      const pos = list.find(p => p.ticket === ticket);
      if (pos) { setCloseGroup(expandWithGroups([pos], everyRow())); setClosePosition(pos); }
    },
    onModifyPosition: (ticket: number, sl: number, tp: number) => {
      const pos = list.find(p => p.ticket === ticket);
      if (!pos) return;
      const commands = expandWithGroups([pos], everyRow()).map(p => modifyCommand(p, sl, tp));
      trackBatch('SL/TP updated', commands);
      sendCommands(commands)
        .catch(err => addToast(errorMessage(err, 'Network error sending modify'), 'error'));
    },
  }), [everyRow]);
  const leftPositionActions = useMemo(() => positionActions(positions), [positionActions, positions]);

  // Spec 060: the right chart's broker and pair — the left ones while linked, its own otherwise.
  const linked = split.linked ?? true;
  const rightBroker = linked ? broker : split.rightBroker ?? broker;
  const rightSymbol = linked ? symbol : split.rightSymbol ?? symbol;
  const ownRightSymbols = useChartSymbols(showSplit && rightBroker !== broker ? rightBroker : '');
  const rightSymbols = rightBroker === broker ? allSymbols : ownRightSymbols;
  const rightBrokerHidden = !!rightBroker && !isBrokerVisible(visibility, rightBroker);
  const rightSymbolHidden = !!rightBroker && !!rightSymbol && !isSymbolVisible(visibility, rightBroker, rightSymbol);
  const rightBrokers = useMemo(() => {
    const list = allBrokers.filter(b => isBrokerVisible(visibility, b));
    return rightBrokerHidden && allBrokers.includes(rightBroker) ? [...list, rightBroker] : list;
  }, [allBrokers, visibility, rightBroker, rightBrokerHidden]);
  const rightSymbolOptions = useMemo(() => {
    const list = rightSymbols.filter(s => isSymbolVisible(visibility, rightBroker, s));
    return rightSymbolHidden && rightSymbols.includes(rightSymbol) ? [...list, rightSymbol] : list;
  }, [rightSymbols, visibility, rightBroker, rightSymbol, rightSymbolHidden]);
  const rightSymbolUnavailable = rightSymbols.length > 0 && !!rightSymbol && !rightSymbols.includes(rightSymbol);
  const rightPositions = positionsByBroker[rightBroker] ?? EMPTY_POSITIONS;
  const rightPositionActions = useMemo(() => positionActions(rightPositions), [positionActions, rightPositions]);
  const rightAlerts = useMemo(
    () => alerts.filter(a => a.broker === rightBroker && a.symbol === rightSymbol),
    [alerts, rightBroker, rightSymbol],
  );

  const panelOnRight = panelSide === 'right' && showSplit;
  const panelBroker = panelOnRight ? rightBroker : broker;
  const panelSymbol = panelOnRight ? rightSymbol : symbol;
  useEffect(() => {
    panelBrokerRef.current = panelBroker;
    panelSymbolRef.current = panelSymbol;
    rightPairRef.current = { broker: rightBroker, symbol: rightSymbol };
  }, [panelBroker, panelSymbol, rightBroker, rightSymbol]);
  useTickSubscription(showSplit ? rightBroker : '', showSplit ? rightSymbol : '');

  // Linked, the right selectors change the left chart (and so both); unlinked, only the right one.
  const setRightBroker = useCallback((next: string) => {
    if (linked) setBroker(next);
    else setSplit(prev => ({ ...prev, rightBroker: next }));
  }, [linked, setSplit]);
  const setRightSymbol = useCallback((next: string) => {
    if (linked) setSymbol(next);
    else setSplit(prev => ({ ...prev, rightSymbol: next }));
  }, [linked, setSplit]);
  // Unlinking keeps what the right chart shows; linking makes it take the left broker and pair.
  const toggleLink = useCallback(() => {
    setSplit(prev => ((prev.linked ?? true)
      ? { ...prev, linked: false, rightBroker: broker, rightSymbol: symbol }
      : { ...prev, linked: true }));
  }, [broker, symbol, setSplit]);

  const sharedSlotProps = {
    brokers,
    symbols,
    broker,
    symbol,
    brokerHidden,
    symbolHidden,
    onBrokerChange: setBroker,
    onSymbolChange: setSymbol,
    positions,
    balance: balances[broker],
    averagesFor: maTemplates.averagesFor,
    trendlineAppearance,
    showSpread,
    pnlMode,
    emaTradesSettings,
    alerts: chartAlerts,
    onMoveAlert: moveAlert,
    onEditAlertPrice: editAlertFromChart,
    onToggleAlert: toggleAlertFromChart,
    onDeleteAlert: deleteAlertFromChart,
    alertsActive: alertsOpen,
    alertsFlashing: alertFlash,
    onCreateAlert: createAlert,
    quickOrders,
    onQuickOrder: openQuickOrder,
    isFullscreen,
    splitAvailable: isDesktop,
    splitActive: showSplit,
  };
  const showLeft = !showSplit || !isFullscreen || fullscreenSide === 'left';
  const showRight = showSplit && (!isFullscreen || fullscreenSide === 'right');
  const splitLayout = showLeft && showRight;

  return (
    <div className={`${styles.page} ${isFullscreen ? styles.pageFullscreen : ''}`} ref={pageRef}>
      <div className={styles.workspace}>
      <div
        ref={chartAreaRef}
        className={`${styles.chartArea} ${splitLayout ? styles.split : ''}`}
        style={splitLayout ? { gridTemplateColumns: `minmax(0, ${split.ratio}fr) ${DIVIDER_WIDTH}px minmax(0, ${1 - split.ratio}fr)` } : undefined}
      >
        {showLeft && (
          <ChartSlot
            {...sharedSlotProps}
            side="left"
            onIndicators={openIndicatorsLeft}
            onAlerts={toggleAlertsLeft}
            onNewTrade={openNewTradeLeft}
            onFilters={openFiltersLeft}
            {...leftPositionActions}
            linked={showSplit ? linked : undefined}
            onToggleLink={showSplit ? toggleLink : undefined}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            onFullscreen={toggleFullscreenLeft}
            onSplit={toggleSplitLeft}
            onSplitLayouts={toggleLayouts}
            splitLayoutsOpen={layoutsOpen}
          />
        )}
        {splitLayout && (
          <div
            className={`${styles.divider} ${dragging ? styles.dividerActive : ''}`}
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={Math.round(split.ratio * 100)}
            aria-valuemin={SPLIT_RATIO_MIN * 100}
            aria-valuemax={SPLIT_RATIO_MAX * 100}
            title="Drag to resize"
            onMouseDown={startDividerDrag}
          />
        )}
        {showRight && (
          <ChartSlot
            {...sharedSlotProps}
            side="right"
            onIndicators={openIndicatorsRight}
            onAlerts={toggleAlertsRight}
            onNewTrade={openNewTradeRight}
            onFilters={openFiltersRight}
            {...rightPositionActions}
            brokers={rightBrokers}
            symbols={rightSymbolOptions}
            broker={rightBroker}
            symbol={rightSymbol}
            brokerHidden={rightBrokerHidden}
            symbolHidden={rightSymbolHidden}
            onBrokerChange={setRightBroker}
            onSymbolChange={setRightSymbol}
            positions={rightPositions}
            balance={balances[rightBroker]}
            alerts={rightAlerts}
            symbolUnavailable={rightSymbolUnavailable}
            linked={linked}
            onToggleLink={toggleLink}
            timeframe={split.rightTimeframe}
            onTimeframeChange={setRightTimeframe}
            onFullscreen={toggleFullscreenRight}
            onSplit={toggleSplitRight}
            onSplitLayouts={toggleLayouts}
            splitLayoutsOpen={layoutsOpen}
          />
        )}
      </div>
      <NewTradePanel docked open={newTradeOpen} onClose={closeNewTrade} initialBroker={panelBroker} initialSymbol={panelSymbol} initialTimeframe={newTradeTimeframe} initialOrder={newTradeOrder} />
      <BulkEditPanel
        docked
        open={!!editPosition}
        positions={editPositions}
        onClose={clearEdit}
      />
      </div>
      <ChartFiltersPanel
        open={filtersOpen}
        onClose={closeFilters}
        {...(filtersSide === 'right' && showSplit
          ? { brokers: rightBrokers, symbols: rightSymbolOptions, broker: rightBroker, symbol: rightSymbol, brokerHidden: rightBrokerHidden, symbolHidden: rightSymbolHidden, onBrokerChange: setRightBroker, onSymbolChange: setRightSymbol }
          : { brokers, symbols, broker, symbol, brokerHidden, symbolHidden, onBrokerChange: setBroker, onSymbolChange: setSymbol })}
      />
      <AlertsPanel
        open={alertsOpen}
        onClose={closeAlerts}
        broker={panelBroker}
        symbol={panelSymbol}
        brokers={panelOnRight ? rightBrokers : brokers}
        symbols={panelOnRight ? rightSymbolOptions : symbols}
        currentPrice={panelPrice}
        alerts={alerts}
        onCreate={createAlert}
        onToggle={toggleAlert}
        onUpdatePrice={updateAlertPrice}
        onDelete={removeAlert}
        emaAlerts={emaAlerts}
        onCreateEma={createEmaAlert}
        onToggleEma={toggleEmaAlert}
        onDeleteEma={removeEmaAlert}
        editRequest={alertEditRequest}
      />
      <IndicatorsPanel
        open={indicatorsOpen}
        onClose={closeIndicators}
        broker={panelBroker}
        timeframe={indicatorsTimeframe}
        templates={maTemplates.templates}
        template={maTemplates.templateFor(panelBroker, indicatorsTimeframe)}
        source={maTemplates.sourceOf(panelBroker, indicatorsTimeframe)}
        assignmentOf={maTemplates.assignmentOf}
        hidden={maTemplates.hidden}
        onToggleHidden={maTemplates.toggleHidden}
        onAssign={maTemplates.assign}
      />


      <QuickOrderConfirm symbol={quickOrder?.symbol ?? ''} plan={quickOrder?.plan ?? null} onClose={closeQuickOrder} />

      <SplitLayoutsPanel
        open={layoutsOpen && isDesktop}
        onClose={closeLayouts}
        layouts={splitLayouts}
        shown={{
          splitOn: showSplit,
          left: { broker, symbol, timeframe },
          right: { broker: rightBroker, symbol: rightSymbol, timeframe: split.rightTimeframe },
        }}
        visibility={visibility}
        onApply={applySplitLayout}
      />

      <ClosePositionPanel
        open={!!closePosition}
        positions={closePositions}
        onClose={clearClose}
      />
    </div>
  );
}
