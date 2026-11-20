import { describe, it, expect, vi } from 'vitest';

vi.mock('../config', () => ({ config: { brokers: [] } }));
vi.mock('../db/client', () => ({ db: {} }));
import { planRollout } from './hidden-symbols-rollout';

describe('planRollout', () => {
  it('turns off hidden pairs, keeps those with open positions, and waits for unknown brokers', () => {
    const plan = planRollout(
      { ftmo: ['EURGBP', 'GBPJPY'], isa: ['AUDCAD'], gone: ['EURUSD'] },
      { ftmo: ['EURUSD', 'EURGBP.r', 'GBPJPY'], isa: ['AUDCAD'] },
      new Map([['ftmo', new Set(['GBPJPY'])]]),
    );
    expect(plan.steps).toEqual([{ broker: 'ftmo', removed: ['EURGBP.r'], keptOpen: ['GBPJPY'] }]);
    expect(plan.remaining).toEqual({ isa: ['AUDCAD'], gone: ['EURUSD'] });
  });
});
