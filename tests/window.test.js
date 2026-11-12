import test from 'node:test';
import assert from 'node:assert/strict';
import { WatermarkTracker } from '../src/watermark.js';
import { TumblingWindowAssigner, SlidingWindowAssigner, aggregateRecords } from '../src/window.js';
import { StreamEngine } from '../src/engine.js';

test('watermark advances with max event time minus lateness', () => {
  const wm = new WatermarkTracker({ allowedLatenessMs: 500 });
  assert.equal(wm.observe(1000), 500);
  assert.equal(wm.observe(800), 500);
  assert.equal(wm.observe(2000), 1500);
  assert.equal(wm.current(), 1500);
});

test('tumbling windows align to size boundaries', () => {
  const a = new TumblingWindowAssigner({ sizeMs: 1000 });
  assert.deepEqual(a.assign(0), [{ start: 0, end: 1000 }]);
  assert.deepEqual(a.assign(999), [{ start: 0, end: 1000 }]);
  assert.deepEqual(a.assign(1000), [{ start: 1000, end: 2000 }]);
  assert.deepEqual(a.assign(2500), [{ start: 2000, end: 3000 }]);
});

test('sliding windows emit overlapping ranges', () => {
  const a = new SlidingWindowAssigner({ sizeMs: 3000, slideMs: 1000 });
  const wins = a.assign(2500);
  assert.deepEqual(wins, [
    { start: 0, end: 3000 },
    { start: 1000, end: 4000 },
  ]);
});

test('aggregateRecords computes count sum avg', () => {
  const out = aggregateRecords([
    { value: 10 },
    { value: 20 },
    { value: 30 },
  ]);
  assert.deepEqual(out, { count: 3, sum: 60, avg: 20 });
});

test('engine closes windows by watermark and marks late events', () => {
  const engine = new StreamEngine({
    assigner: new TumblingWindowAssigner({ sizeMs: 1000 }),
    allowedLatenessMs: 200,
  });
  const events = [
    { key: 'a', ts: 100, value: 1 },
    { key: 'a', ts: 800, value: 2 },
    { key: 'a', ts: 1500, value: 3 },
    { key: 'a', ts: 500, value: 99 }, // late after watermark advances past 1000 window
  ];
  // Feed in order but third event advances watermark enough to close [0,1000)
  const closed = [];
  engine.onWindowClosed((r) => closed.push(r));
  for (const e of events) engine.accept(e);
  engine.flush();

  assert.ok(engine.lateCount >= 1);
  assert.ok(closed.length >= 1);
  const first = closed.find((c) => c.start === 0 && c.end === 1000 && c.key === 'a');
  assert.ok(first);
  assert.equal(first.count, 2);
  assert.equal(first.sum, 3);
});

test('engine processes fixture-like stream end-to-end', () => {
  const engine = new StreamEngine({
    assigner: new TumblingWindowAssigner({ sizeMs: 2000 }),
    allowedLatenessMs: 500,
  });
  const results = [];
  engine.onWindowClosed((r) => results.push(r));
  const lines = [
    { key: 'shop-a', ts: 1000, value: 10 },
    { key: 'shop-a', ts: 1500, value: 20 },
    { key: 'shop-b', ts: 1200, value: 5 },
    { key: 'shop-a', ts: 3100, value: 7 },
    { key: 'shop-b', ts: 4100, value: 9 },
  ];
  for (const e of lines) engine.accept(e);
  engine.flush();
  assert.ok(results.length >= 2);
  assert.ok(results.every((r) => typeof r.avg === 'number'));
});
