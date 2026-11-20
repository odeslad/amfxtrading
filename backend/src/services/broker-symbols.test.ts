import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BrokerSymbolsError, isTrackedPair, readActive, readAvailable, writeActive } from './broker-symbols';

const BOM = String.fromCharCode(0xfeff);
let dir: string;

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('isTrackedPair', () => {
  it('keeps crosses of the seven currencies, with or without a suffix', () => {
    expect(isTrackedPair('EURUSD')).toBe(true);
    expect(isTrackedPair('gbpjpy.r')).toBe(true);
    expect(isTrackedPair('EURCHF')).toBe(false);
    expect(isTrackedPair('XAUUSD')).toBe(false);
    expect(isTrackedPair('US30')).toBe(false);
    expect(isTrackedPair('USDUSD')).toBe(false);
  });
});

describe('readAvailable', () => {
  it('is null until the EA reports, then the tracked pairs in order', () => {
    expect(readAvailable(dir)).toBeNull();
    fs.writeFileSync(path.join(dir, 'symbols-available.json'), BOM + '{"symbols":["USDJPY","XAUUSD","EURUSD","EURCHF","EURUSD"]}');
    expect(readAvailable(dir)).toEqual(['EURUSD', 'USDJPY']);
  });
});

describe('readActive / writeActive', () => {
  it('reads the comma list and writes only symbols, keeping the other fields', () => {
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ brokerName: 'ftmo', symbols: 'EURUSD, GBPUSD', extra: 1 }));
    expect(readActive(dir)).toEqual(['EURUSD', 'GBPUSD']);
    writeActive(dir, ['EURUSD', 'AUDCAD']);
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    expect(saved).toEqual({ brokerName: 'ftmo', symbols: 'EURUSD,AUDCAD', extra: 1 });
    expect(fs.existsSync(path.join(dir, 'config.json.tmp'))).toBe(false);
  });

  it('creates the file when missing and fails clearly on a bad folder or file', () => {
    expect(readActive(dir)).toEqual([]);
    writeActive(dir, ['EURUSD']);
    expect(readActive(dir)).toEqual(['EURUSD']);
    expect(() => writeActive(path.join(dir, 'missing'), ['EURUSD'])).toThrow(BrokerSymbolsError);
    fs.writeFileSync(path.join(dir, 'config.json'), '{ broken');
    expect(() => writeActive(dir, ['EURUSD'])).toThrow(BrokerSymbolsError);
  });
});
