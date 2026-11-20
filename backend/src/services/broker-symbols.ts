import fs from 'fs';
import path from 'path';

// Spec 056: the pairs each EA streams live in its bridge/config.json (`symbols`, a comma-separated
// string, as the EA parses it); the EA lists every symbol its broker offers in symbols-available.json.

export const PAIR_CURRENCIES = ['AUD', 'EUR', 'NZD', 'USD', 'CAD', 'GBP', 'JPY'] as const;

const CONFIG_FILE = 'config.json';
const AVAILABLE_FILE = 'symbols-available.json';

export class BrokerSymbolsError extends Error {}

// A cross of two different currencies of the list; the broker's suffix (EURUSD.r) is allowed.
export function isTrackedPair(symbol: string): boolean {
  const base = symbol.slice(0, 3).toUpperCase();
  const quote = symbol.slice(3, 6).toUpperCase();
  const currencies: readonly string[] = PAIR_CURRENCIES;
  return base !== quote && currencies.includes(base) && currencies.includes(quote);
}

export const parseSymbolList = (raw: unknown): string[] =>
  typeof raw === 'string' ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];

const BOM = new RegExp('^' + String.fromCharCode(0xfeff));

function readJson(file: string): Record<string, unknown> | null {
  try {
    // MT4 may write a BOM; JSON.parse does not accept one.
    const text = fs.readFileSync(file, 'utf8').replace(BOM, '');
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Every tracked pair the broker offers, alphabetical; null until the EA has reported its list.
export function readAvailable(bridgePath: string): string[] | null {
  const data = readJson(path.join(bridgePath, AVAILABLE_FILE));
  if (!data || !Array.isArray(data.symbols)) return null;
  const names = data.symbols.filter((s): s is string => typeof s === 'string');
  return [...new Set(names.filter(isTrackedPair))].sort();
}

// The symbols the EA streams today (config.json); empty when the file is missing.
export function readActive(bridgePath: string): string[] {
  return parseSymbolList(readJson(path.join(bridgePath, CONFIG_FILE))?.symbols);
}

// Replaces only `symbols`, keeping brokerName and any other field; temp file + rename so the EA
// never reads a partial file.
export function writeActive(bridgePath: string, symbols: string[]): void {
  const file = path.join(bridgePath, CONFIG_FILE);
  if (!fs.existsSync(bridgePath)) throw new BrokerSymbolsError(`bridge folder not found: ${bridgePath}`);
  const current = fs.existsSync(file) ? readJson(file) : {};
  if (current === null) throw new BrokerSymbolsError(`${CONFIG_FILE} cannot be read; fix it by hand before saving`);
  const next = { ...current, symbols: symbols.join(',') };
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, file);
  } catch (err) {
    throw new BrokerSymbolsError(`${CONFIG_FILE} cannot be written: ${err instanceof Error ? err.message : String(err)}`);
  }
}
