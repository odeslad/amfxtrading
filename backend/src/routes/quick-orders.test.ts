import { describe, it, expect } from 'vitest';
import { parseQuickOrders, readQuickOrders } from './quick-orders';
import { parseDisplay } from './settings';
import { BadRequest } from '../middleware/errors';

const valid = { lotsMode: 'risk_pct', size: 0.5, slPips: 15, tpMode: 'r', tp: 2, mirrorPresetId: 3 };

describe('parseQuickOrders', () => {
  it('keeps the stored value when absent and clears it with null', () => {
    expect(parseQuickOrders(undefined)).toBeUndefined();
    expect(parseQuickOrders(null)).toBeNull();
  });

  it('accepts a full configuration and a minimal one', () => {
    expect(parseQuickOrders(valid)).toEqual(valid);
    expect(parseQuickOrders({ lotsMode: 'fixed', size: 0.1 })).toEqual({
      lotsMode: 'fixed', size: 0.1, slPips: null, tpMode: null, tp: null, mirrorPresetId: null,
    });
    expect(parseQuickOrders({ lotsMode: 'fixed', size: 0.1, tpMode: 'pips', tp: 30 })?.tp).toBe(30);
  });

  it('rejects invalid values with 400', () => {
    const bad = [
      { ...valid, size: 0 },
      { ...valid, lotsMode: 'units' },
      { ...valid, slPips: -1 },
      { ...valid, tpMode: 'r', tp: null },
      { ...valid, tpMode: null, tp: 2 },
      { ...valid, tpMode: 'ratio' },
      { lotsMode: 'fixed', size: 0.1, tpMode: 'r', tp: 2 },
      { lotsMode: 'risk_pct', size: 0.5 },
      { ...valid, mirrorPresetId: 0 },
    ];
    for (const value of bad) expect(() => parseQuickOrders(value)).toThrow(BadRequest);
  });

  it('is part of parseDisplay', () => {
    expect(parseDisplay({ pnlMode: 'net' }).quickOrders).toBeUndefined();
    expect(parseDisplay({ pnlMode: 'net', quickOrders: valid }).quickOrders).toEqual(valid);
  });
});

describe('readQuickOrders', () => {
  it('reads null, a deleted preset and a broken value safely', () => {
    expect(readQuickOrders(null, [3])).toBeNull();
    expect(readQuickOrders(valid, [3])).toEqual(valid);
    expect(readQuickOrders(valid, [1])?.mirrorPresetId).toBeNull();
    expect(readQuickOrders({ size: 'x' }, [])).toBeNull();
  });
});
