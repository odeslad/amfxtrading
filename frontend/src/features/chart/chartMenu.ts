import type { CommandAction } from '../../lib/commands';
import { orderTypeAt, type Side } from '../../lib/orderType';
import { isBuySide, isPending, pricePrecision, type Position } from '../journal/utils/position';
import type { MenuItem, MenuSection } from './ChartContextMenu';
import type { ChartContextRequest } from './LightweightChart';
import type { QuickOrders } from '../../lib/quickOrders';

// Spec 054: the items of the chart's context menu for the point that was clicked.
export interface ChartMenuContext {
  symbol: string;
  request: ChartContextRequest;
  position: Position | null;   // the position or order whose line was clicked
  locked: boolean;
  quickOrders: QuickOrders | null;
  quickPresetName: string | null;
}

export interface ChartMenuHandlers {
  onOrderAt: (action: CommandAction, price: number) => void;
  onNewTrade: () => void;
  onAlertAt: (price: number, direction: 'above' | 'below') => void;
  onEditPosition: (ticket: number) => void;
  onClosePosition: (ticket: number) => void;
  onModifyPosition: (ticket: number, sl: number, tp: number) => void;
  onClearDrawings: () => void;
  onQuickOrder: (side: Side, price: number | null) => void;
}

const ORDER_LABEL: Partial<Record<CommandAction, string>> = {
  buylimit: 'buy limit', buystop: 'buy stop', selllimit: 'sell limit', sellstop: 'sell stop',
};

function positionSection(p: Position, priceText: (v: number) => string, handlers: ChartMenuHandlers): MenuSection {
  const pending = isPending(p.type);
  const side = isBuySide(p.type) ? 'BUY' : 'SELL';
  const items: MenuItem[] = [
    { key: 'edit', label: pending ? 'Edit order…' : 'Edit position…', onSelect: () => handlers.onEditPosition(p.ticket) },
  ];
  if (p.sl) items.push({ key: 'remove-sl', label: 'Remove SL', hint: priceText(p.sl), onSelect: () => handlers.onModifyPosition(p.ticket, 0, p.tp) });
  if (p.tp) items.push({ key: 'remove-tp', label: 'Remove TP', hint: priceText(p.tp), onSelect: () => handlers.onModifyPosition(p.ticket, p.sl, 0) });
  items.push({ key: 'close', label: pending ? 'Cancel order…' : 'Close position…', tone: 'danger', onSelect: () => handlers.onClosePosition(p.ticket) });
  return { key: 'position', title: `#${p.ticket} ${side} ${p.lots} @ ${priceText(p.openPrice)}`, items };
}

export function buildChartMenu(ctx: ChartMenuContext, handlers: ChartMenuHandlers): MenuSection[] {
  const { symbol, request, position, locked, quickOrders, quickPresetName } = ctx;
  const { price, bid, ask, target, drawingCount } = request;
  const priceText = (v: number) => v.toFixed(pricePrecision(symbol));
  const hasQuote = bid !== null && ask !== null;

  const orderAt = (side: Side): MenuItem[] => {
    if (!hasQuote) return [];
    const action = orderTypeAt(side, price, bid, ask);
    return [{
      key: `${side}-at`,
      label: `${side === 'buy' ? 'Buy' : 'Sell'} at ${price}…`,
      hint: ORDER_LABEL[action],
      tone: side,
      onSelect: () => handlers.onOrderAt(action, price),
    }];
  };

  const alertDirection = bid !== null && price > bid ? 'above' : 'below';
  // The drawing under the pointer, else the selected one (a thin line is hard to hit exactly).
  const drawingTarget = target?.kind === 'drawing' ? target.id : request.selectedDrawingId;
  const drawingLabel = target?.kind === 'drawing' ? 'Delete drawing' : 'Delete selected drawing';

  const quickSize = !quickOrders ? '' : quickPresetName ?? (quickOrders.lotsMode === 'fixed' ? `${quickOrders.size} lots` : `${quickOrders.size}%`);
  const quickItems: MenuItem[] = !quickOrders || locked || !hasQuote ? [] : [
    { key: 'quick-buy', label: 'Quick buy', hint: `market · ${quickSize}`, tone: 'buy', onSelect: () => handlers.onQuickOrder('buy', null) },
    { key: 'quick-sell', label: 'Quick sell', hint: `market · ${quickSize}`, tone: 'sell', onSelect: () => handlers.onQuickOrder('sell', null) },
    { key: 'quick-buy-at', label: `Quick buy at ${price}`, hint: ORDER_LABEL[orderTypeAt('buy', price, bid, ask)], tone: 'buy', onSelect: () => handlers.onQuickOrder('buy', price) },
    { key: 'quick-sell-at', label: `Quick sell at ${price}`, hint: ORDER_LABEL[orderTypeAt('sell', price, bid, ask)], tone: 'sell', onSelect: () => handlers.onQuickOrder('sell', price) },
  ];

  return [
    ...(position && !locked ? [positionSection(position, priceText, handlers)] : []),
    { key: 'quick', title: position && !locked ? undefined : `${symbol} · ${price}`, items: quickItems },
    {
      key: 'trade',
      title: quickItems.length > 0 || (position && !locked) ? undefined : `${symbol} · ${price}`,
      items: [
        ...orderAt('buy'),
        ...orderAt('sell'),
        { key: 'new-trade', label: 'New trade…', hint: 'market', onSelect: handlers.onNewTrade },
      ],
    },
    {
      key: 'alert',
      items: bid === null ? [] : [{
        key: 'alert-at', label: `Price alert at ${price}`, hint: alertDirection,
        onSelect: () => handlers.onAlertAt(price, alertDirection),
      }],
    },
    {
      key: 'drawings',
      items: locked ? [] : [
        ...(drawingTarget ? [{ key: 'delete-drawing', label: drawingLabel, hint: 'Del', tone: 'danger' as const, onSelect: () => request.deleteDrawing(drawingTarget) }] : []),
        ...(drawingCount > 0 ? [{ key: 'clear-drawings', label: 'Clear all drawings…', hint: String(drawingCount), tone: 'danger' as const, onSelect: handlers.onClearDrawings }] : []),
      ],
    },
  ];
}
