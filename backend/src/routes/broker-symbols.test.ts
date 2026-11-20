import { describe, it, expect, vi } from 'vitest';

vi.mock('../config', () => ({ config: { brokers: [] } }));
import { parseSymbols, planChange } from './broker-symbols';
import { BadRequest } from '../middleware/errors';

describe('parseSymbols', () => {
  it('accepts a list of names, trimmed and unique', () => {
    expect(parseSymbols({ symbols: [' EURUSD', 'GBPJPY', 'EURUSD'] })).toEqual(['EURUSD', 'GBPJPY']);
    expect(parseSymbols({ symbols: [] })).toEqual([]);
  });

  it('rejects anything else with 400', () => {
    expect(() => parseSymbols({})).toThrow(BadRequest);
    expect(() => parseSymbols({ symbols: 'EURUSD' })).toThrow(BadRequest);
    expect(() => parseSymbols({ symbols: ['EURUSD', 3] })).toThrow(BadRequest);
    expect(() => parseSymbols({ symbols: [' '] })).toThrow(BadRequest);
  });
});

describe('planChange', () => {
  const available = ['AUDCAD', 'EURUSD', 'GBPJPY', 'USDJPY'];

  it('lists what turns on and nothing blocked when the open symbols stay', () => {
    expect(planChange(['EURUSD', 'GBPJPY'], ['EURUSD', 'GBPJPY', 'AUDCAD'], available, new Set(['EURUSD'])))
      .toEqual({ unknown: [], blocked: [], turnedOn: ['AUDCAD'] });
  });

  it('blocks turning off a symbol with open positions and flags unknown ones', () => {
    expect(planChange(['EURUSD', 'GBPJPY'], ['GBPJPY', 'EURCHF'], available, new Set(['EURUSD'])))
      .toEqual({ unknown: ['EURCHF'], blocked: ['EURUSD'], turnedOn: ['EURCHF'] });
  });

  it('accepts any symbol while the EA has not reported its list', () => {
    expect(planChange([], ['EURUSD'], null, new Set()).unknown).toEqual([]);
  });
});
