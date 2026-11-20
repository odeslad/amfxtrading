import type { CommandAction } from './commands';

export type Side = 'buy' | 'sell';

// A pending order at `price`: a buy below the ask waits for a dip (limit), above it for a breakout (stop);
// a sell above the bid is a limit, below it a stop.
export function orderTypeAt(side: Side, price: number, bid: number, ask: number): CommandAction {
  if (side === 'buy') return price < ask ? 'buylimit' : 'buystop';
  return price > bid ? 'selllimit' : 'sellstop';
}
