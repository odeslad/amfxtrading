import type { CommandAction } from '../../lib/commands';
import { orderTypeAt, type Side } from '../../lib/orderType';
import type { MenuSection } from './ChartContextMenu';
import type { ChartContextRequest } from './LightweightChart';

// Spec 054: the items of the chart's context menu for the point that was clicked.
export interface ChartMenuHandlers {
  onOrderAt: (action: CommandAction, price: number) => void;
  onNewTrade: () => void;
  onAlertAt: (price: number, direction: 'above' | 'below') => void;
}

const ORDER_LABEL: Partial<Record<CommandAction, string>> = {
  buylimit: 'buy limit', buystop: 'buy stop', selllimit: 'sell limit', sellstop: 'sell stop',
};

export function buildChartMenu(symbol: string, request: ChartContextRequest, handlers: ChartMenuHandlers): MenuSection[] {
  const { price, bid, ask } = request;
  const priceText = String(price);
  const hasQuote = bid !== null && ask !== null;

  const orderAt = (side: Side) => {
    if (!hasQuote) return [];
    const action = orderTypeAt(side, price, bid, ask);
    return [{
      key: `${side}-at`,
      label: `${side === 'buy' ? 'Buy' : 'Sell'} at ${priceText}…`,
      hint: ORDER_LABEL[action],
      tone: side,
      onSelect: () => handlers.onOrderAt(action, price),
    } as const];
  };

  const alertDirection = bid !== null && price > bid ? 'above' : 'below';

  return [
    {
      key: 'trade',
      title: `${symbol} · ${priceText}`,
      items: [
        ...orderAt('buy'),
        ...orderAt('sell'),
        { key: 'new-trade', label: 'New trade…', hint: 'market', onSelect: handlers.onNewTrade },
      ],
    },
    {
      key: 'alert',
      items: bid === null ? [] : [{
        key: 'alert-at', label: `Price alert at ${priceText}`, hint: alertDirection,
        onSelect: () => handlers.onAlertAt(price, alertDirection),
      }],
    },
  ];
}
