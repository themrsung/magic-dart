import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAmount, parseDate, parseNumber, parseRmFlags, RateLimiter, toDartDate, unzip, viewerUrl } from '../src/index.ts';
import { makeZip } from './helpers/fake.ts';

describe('normalize', () => {
  it('parses numbers', () => {
    assert.equal(parseNumber('9,999,999,999'), 9_999_999_999);
    assert.equal(parseNumber('-1,234'), -1234);
    assert.equal(parseNumber('(1,234)'), -1234);
    assert.equal(parseNumber('0.256'), 0.256);
    assert.equal(parseNumber('12.5%'), 12.5);
    assert.equal(parseNumber('-'), null);
    assert.equal(parseNumber(''), null);
    assert.equal(parseNumber('보통주'), null);
  });
  it('parses big amounts exactly', () => {
    assert.equal(parseAmount('300,870,903,000,000,000'), 300870903000000000n);
    assert.equal(parseAmount('-'), null);
  });
  it('normalises the three date formats', () => {
    assert.equal(parseDate('20240131'), '2024-01-31');
    assert.equal(parseDate('2024-01-31'), '2024-01-31');
    assert.equal(parseDate('2024.01.31'), '2024-01-31');
    assert.equal(parseDate('2024년 1월 31일'), '2024-01-31');
    assert.equal(parseDate('20240231'), null);
    assert.equal(parseDate('-'), null);
  });
  it('formats dates in KST', () => {
    assert.equal(toDartDate(new Date('2024-12-31T16:00:00Z')), '20250101');
    assert.equal(toDartDate('2024-01-02'), '20240102');
  });
  it('misc', () => {
    assert.deepEqual(parseRmFlags('유연정'), ['유', '연', '정']);
    assert.equal(viewerUrl('20240101000001'), 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20240101000001');
  });
});

describe('unzip', () => {
  it('round-trips deflated entries', () => {
    const entries = unzip(makeZip({ 'a.xml': '<x>한글</x>', 'b.txt': 'hello' }));
    assert.deepEqual(entries.map((e) => e.name), ['a.xml', 'b.txt']);
    assert.equal(new TextDecoder().decode(entries[0]!.data), '<x>한글</x>');
  });
});

describe('RateLimiter', () => {
  it('spaces slots at 1000/rps ms', async () => {
    let t = 0;
    const waits: number[] = [];
    const rl = new RateLimiter({ requestsPerSecond: 10, now: () => t, sleep: async (ms) => { waits.push(ms); } });
    await Promise.all([rl.acquire(), rl.acquire(), rl.acquire()]);
    assert.deepEqual(waits, [100, 200]);
    t = 1000;
    await rl.acquire();
    assert.equal(waits.length, 2);
    assert.equal(rl.issued, 4);
  });
  it('never allows more than rps starts in any 1s window', async () => {
    let t = 0;
    const starts: number[] = [];
    const rl = new RateLimiter({ requestsPerSecond: 10, now: () => t, sleep: async (ms) => { t += ms; } });
    for (let i = 0; i < 50; i++) { await rl.acquire(); starts.push(t); }
    for (let i = 10; i < starts.length; i++) assert.ok(starts[i]! - starts[i - 10]! >= 1000);
  });
});
