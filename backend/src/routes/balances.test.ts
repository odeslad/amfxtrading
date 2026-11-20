import { describe, it, expect } from 'vitest';
import { parseAccountColor } from './balances';
import { BadRequest } from '../middleware/errors';

describe('parseAccountColor', () => {
  it('accepts a colour and an empty one (clear)', () => {
    expect(parseAccountColor({ broker: 'ftmo', color: 'orange' })).toEqual({ broker: 'ftmo', color: 'orange' });
    expect(parseAccountColor({ broker: 'ftmo', color: '' })).toEqual({ broker: 'ftmo', color: '' });
    expect(parseAccountColor({ broker: 'ftmo' })).toEqual({ broker: 'ftmo', color: '' });
  });

  it('rejects a missing broker and a bad colour with 400', () => {
    expect(() => parseAccountColor({ color: 'orange' })).toThrow(BadRequest);
    expect(() => parseAccountColor({ broker: 'ftmo', color: 3 })).toThrow(BadRequest);
    expect(() => parseAccountColor({ broker: 'ftmo', color: 'x'.repeat(21) })).toThrow(BadRequest);
  });
});
