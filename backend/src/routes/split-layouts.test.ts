import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client', () => ({ db: {} }));
vi.mock('../config', () => ({ config: { brokers: [] } }));

import { parseLayouts } from './split-layouts';
import { BadRequest } from '../middleware/errors';

const brokers = ['darwinex', 'FTMO'];
const side = (over: Record<string, unknown> = {}) => ({ broker: 'darwinex', symbol: 'eurusd', timeframe: 'H1', ...over });
const layout = (over: Record<string, unknown> = {}) => ({ name: 'EURUSD H1 + M5', left: side(), right: side({ timeframe: 'M5' }), ...over });

describe('parseLayouts', () => {
  it('reads a valid list, trimming names and upper-casing symbols', () => {
    expect(parseLayouts([layout({ id: 3, name: '  Main ' }), layout({ name: 'Other', right: side({ broker: 'FTMO', symbol: 'GBPUSD' }) })], brokers)).toEqual([
      { id: 3, name: 'Main', left: { broker: 'darwinex', symbol: 'EURUSD', timeframe: 'H1' }, right: { broker: 'darwinex', symbol: 'EURUSD', timeframe: 'M5' } },
      { name: 'Other', left: { broker: 'darwinex', symbol: 'EURUSD', timeframe: 'H1' }, right: { broker: 'FTMO', symbol: 'GBPUSD', timeframe: 'H1' } },
    ]);
    expect(parseLayouts([], brokers)).toEqual([]);
  });

  it('rejects a name that is empty, too long or repeated', () => {
    expect(() => parseLayouts([layout({ name: '   ' })], brokers)).toThrow(BadRequest);
    expect(() => parseLayouts([layout({ name: 'x'.repeat(41) })], brokers)).toThrow(BadRequest);
    expect(() => parseLayouts([layout({ name: 'Main' }), layout({ name: 'main' })], brokers)).toThrow(BadRequest);
  });

  it('rejects an unknown broker, an empty symbol and a timeframe the chart does not offer', () => {
    expect(() => parseLayouts([layout({ left: side({ broker: 'nope' }) })], brokers)).toThrow(BadRequest);
    expect(() => parseLayouts([layout({ right: side({ symbol: '' }) })], brokers)).toThrow(BadRequest);
    expect(() => parseLayouts([layout({ right: side({ timeframe: 'M1' }) })], brokers)).toThrow(BadRequest);
  });

  it('rejects a bad id, a non-array and more than 20 layouts', () => {
    expect(() => parseLayouts([layout({ id: 0 })], brokers)).toThrow(BadRequest);
    expect(() => parseLayouts([layout({ id: '3' })], brokers)).toThrow(BadRequest);
    expect(() => parseLayouts({}, brokers)).toThrow(BadRequest);
    expect(() => parseLayouts(Array.from({ length: 21 }, (_, i) => layout({ name: `L${i}` })), brokers)).toThrow(BadRequest);
  });
});
