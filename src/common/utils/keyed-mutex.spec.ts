import { KeyedMutex } from './keyed-mutex';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

describe('KeyedMutex', () => {
  it('runs tasks with the same key one at a time, in order', async () => {
    const mutex = new KeyedMutex();
    const log: string[] = [];
    const gate = deferred();

    const first = mutex.run('a', async () => {
      log.push('first:start');
      await gate.promise;
      log.push('first:end');
    });
    const second = mutex.run('a', () => {
      log.push('second:start');
      return Promise.resolve();
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(log).toEqual(['first:start']);

    gate.resolve();
    await Promise.all([first, second]);
    expect(log).toEqual(['first:start', 'first:end', 'second:start']);
  });

  it('runs different keys in parallel', async () => {
    const mutex = new KeyedMutex();
    const gate = deferred();
    const started: string[] = [];

    const a = mutex.run('a', async () => {
      started.push('a');
      await gate.promise;
    });
    const b = mutex.run('b', () => {
      started.push('b');
      return Promise.resolve();
    });

    await b;
    expect(started).toEqual(['a', 'b']);
    gate.resolve();
    await a;
  });

  it('keeps going after a task fails, and returns each task its own result', async () => {
    const mutex = new KeyedMutex();

    const failing = mutex.run('a', () => Promise.reject(new Error('boom')));
    const next = mutex.run('a', () => Promise.resolve('ok'));

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('forgets a key once its queue is empty', async () => {
    const mutex = new KeyedMutex();
    await mutex.run('a', () => Promise.resolve(1));

    expect((mutex as unknown as { tails: Map<string, unknown> }).tails.size).toBe(0);
  });
});
