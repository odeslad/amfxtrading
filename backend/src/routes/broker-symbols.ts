import { Router } from 'express';
import { config } from '../config';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest, Conflict, NotFound } from '../middleware/errors';
import { bodyRecord } from '../middleware/parse';
import { getAllPositions } from '../store/positions';
import { BrokerSymbolsError, readActive, readAvailable, writeActive } from '../services/broker-symbols';

// Spec 056: the pairs each EA streams (its bridge/config.json), chosen in Settings › Visibility.

export interface BrokerSymbolsState {
  broker: string;
  available: string[] | null;   // null until the EA has reported what its broker offers
  active: string[];
}

type Broadcaster = (state: BrokerSymbolsState) => void;
type TurnedOnHandler = (broker: string, symbols: string[]) => void;
let broadcast: Broadcaster | null = null;
let onTurnedOn: TurnedOnHandler | null = null;
export const setBrokerSymbolsBroadcaster = (fn: Broadcaster): void => { broadcast = fn; };
export const setSymbolsTurnedOnHandler = (fn: TurnedOnHandler): void => { onTurnedOn = fn; };

function bridgePathOf(broker: string): string {
  const found = config.brokers.find(b => b.name === broker);
  if (!found) throw new NotFound(`Unknown broker: ${broker}`);
  return found.bridgePath;
}

const stateOf = (broker: string, bridgePath: string): BrokerSymbolsState =>
  ({ broker, available: readAvailable(bridgePath), active: readActive(bridgePath) });

// Symbols with open positions or pending orders on the broker; they cannot be turned off.
export function openSymbols(broker: string): Set<string> {
  const entry = getAllPositions().find(p => p.broker === broker);
  const symbols = (entry?.positions ?? []).map(p => (p as { symbol?: unknown }).symbol).filter((s): s is string => typeof s === 'string');
  return new Set(symbols);
}

export function parseSymbols(raw: unknown): string[] {
  const body = bodyRecord(raw);
  if (!Array.isArray(body.symbols) || body.symbols.some(s => typeof s !== 'string' || s.trim() === '')) {
    throw new BadRequest('symbols must be an array of symbol names');
  }
  const symbols = [...new Set((body.symbols as string[]).map(s => s.trim()))];
  // An empty list would make the EA fall back to its built-in SYMBOLS input.
  if (symbols.length === 0) throw new BadRequest('Keep at least one pair on');
  return symbols;
}

// What a save would change, or why it cannot: unknown symbols, or open ones being turned off.
export function planChange(current: string[], next: string[], available: string[] | null, open: Set<string>) {
  const unknown = available === null ? [] : next.filter(s => !available.includes(s));
  const turnedOff = current.filter(s => !next.includes(s));
  const blocked = turnedOff.filter(s => open.has(s));
  const turnedOn = next.filter(s => !current.includes(s));
  return { unknown, blocked, turnedOn };
}

const router = Router();

router.get('/', asyncRoute(async (_req, res) => {
  res.json(config.brokers.map(b => stateOf(b.name, b.bridgePath)));
}));

router.put('/:broker', asyncRoute(async (req, res) => {
  const broker = req.params.broker;
  const bridgePath = bridgePathOf(broker);
  const symbols = parseSymbols(req.body);
  const before = stateOf(broker, bridgePath);
  const { unknown, blocked, turnedOn } = planChange(before.active, symbols, before.available, openSymbols(broker));
  if (unknown.length > 0) throw new BadRequest(`${broker} does not offer: ${unknown.join(', ')}`);
  if (blocked.length > 0) throw new Conflict(`Open positions or orders on ${blocked.join(', ')}: close them before turning them off`);

  try {
    writeActive(bridgePath, symbols);
  } catch (err) {
    if (err instanceof BrokerSymbolsError) throw new Conflict(`Could not save ${broker}'s pairs: ${err.message}`);
    throw err;
  }
  const after = stateOf(broker, bridgePath);
  broadcast?.(after);
  if (turnedOn.length > 0) onTurnedOn?.(broker, turnedOn);
  res.json(after);
}));

export default router;
