import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client', () => ({ db: {} }));
vi.mock('../config', () => ({ config: { brokers: [] } }));

import { parseMember } from './entry-groups';
import { parseCommand } from './commands';
import { BadRequest } from '../middleware/errors';

describe('parseMember', () => {
  it('reads a broker and a ticket', () => {
    expect(parseMember({ broker: 'ic', ticket: 10 })).toEqual({ broker: 'ic', ticket: 10 });
  });

  it('rejects a missing broker or a bad ticket with 400', () => {
    expect(() => parseMember({ ticket: 10 })).toThrow(BadRequest);
    expect(() => parseMember({ broker: 'ic', ticket: 'x' })).toThrow(BadRequest);
  });
});

describe('parseCommand groupId', () => {
  const open = { action: 'buy', id: 'c1', broker: 'ic', symbol: 'EURUSD', lots: 1 };

  it('is optional and kept on opening actions', () => {
    expect(parseCommand(open).groupId).toBeUndefined();
    expect(parseCommand({ ...open, groupId: 'g_1-a' }).groupId).toBe('g_1-a');
    expect(parseCommand({ ...open, action: 'buylimit', price: 1.1, groupId: 'g1' }).groupId).toBe('g1');
  });

  it('rejects a malformed groupId', () => {
    expect(() => parseCommand({ ...open, groupId: 'bad id' })).toThrow(BadRequest);
    expect(() => parseCommand({ ...open, groupId: '' })).toThrow(BadRequest);
    expect(() => parseCommand({ ...open, groupId: 5 })).toThrow(BadRequest);
  });

  it('rejects a groupId on close and modify', () => {
    expect(() => parseCommand({ action: 'close', id: 'c2', broker: 'ic', symbol: 'EURUSD', ticket: 7, groupId: 'g1' })).toThrow(BadRequest);
    expect(() => parseCommand({ action: 'modify', id: 'c3', broker: 'ic', symbol: 'EURUSD', ticket: 7, sl: 1, groupId: 'g1' })).toThrow(BadRequest);
  });
});
