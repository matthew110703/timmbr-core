/**
 * Runs tasks that share a key one after another (tasks with different keys run in parallel).
 * In-process only: it prevents two requests on the same server from interleaving, not two
 * servers. Entries are removed when their queue drains, so the map does not grow.
 */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<unknown>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    // A failed task must not block the ones queued behind it.
    const result = previous.catch(() => undefined).then(task);
    const tail = result.catch(() => undefined);
    this.tails.set(key, tail);

    try {
      return await result;
    } finally {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}
