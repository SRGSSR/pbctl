import { expect, test } from 'bun:test';
import { mapPool } from './pool';

test('mapPool keeps the order and bounds the calls in flight', async () => {
  let live = 0;
  let peak = 0;
  const items = Array.from({ length: 10 }, (_, index) => index);
  const results = await mapPool(items, 3, async (item) => {
    live += 1;
    peak = Math.max(peak, live);
    await Promise.resolve();
    live -= 1;
    return item * 2;
  });
  expect(results).toEqual(items.map((item) => item * 2));
  expect(peak).toBeLessThanOrEqual(3);
});

test('mapPool answers an empty list without calling the work', async () => {
  let calls = 0;
  const results = await mapPool([], 4, async () => {
    calls += 1;
    return 1;
  });
  expect(results).toEqual([]);
  expect(calls).toBe(0);
});
