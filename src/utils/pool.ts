// Runs asynchronous work over a list, a few calls at a time.

/**
 * Maps a list through an asynchronous function, keeping at most `limit` calls
 * in flight. The results keep the order of the items.
 *
 * @param items - The items to map.
 * @param limit - The calls in flight at most; at least one is used.
 * @param work - The function called with each item.
 * @returns The results, in the order of the items.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const queue = [...items.entries()];
  const results: R[] = [];
  const runner = async (): Promise<void> => {
    for (
      let entry = queue.shift();
      entry !== undefined;
      entry = queue.shift()
    ) {
      const [index, item] = entry;
      results[index] = await work(item);
    }
  };
  const width = Math.min(Math.max(limit, 1), items.length);
  await Promise.all(Array.from({ length: width }, runner));
  return results;
}
