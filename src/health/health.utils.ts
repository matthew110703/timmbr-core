/** Max time a single dependency check may take before it's reported as down. */
export const HEALTH_CHECK_TIMEOUT_MS = 2000;

/** Rejects if `promise` doesn't settle within `ms`. The timer is always cleared. */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
