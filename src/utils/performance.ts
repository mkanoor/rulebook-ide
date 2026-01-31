/**
 * Performance utilities for optimizing React components
 */

/**
 * Debounce function - delays execution until after wait time has elapsed
 * since the last time it was invoked
 *
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   performSearch(query);
 * }, 300);
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - ensures function is called at most once per specified time period
 *
 * @example
 * const throttledScroll = throttle((event: Event) => {
 *   handleScroll(event);
 * }, 100);
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Memoize function results - caches results of expensive function calls
 *
 * @example
 * const memoizedCalculation = memoize((n: number) => {
 *   return expensiveCalculation(n);
 * });
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  func: T
): (...args: Parameters<T>) => ReturnType<T> {
  const cache = new Map<string, ReturnType<T>>();

  return function memoized(...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = func(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  };
}

/**
 * Lazy load a component with a loading fallback
 *
 * @example
 * const LazyEditor = lazyLoad(() => import('./Editor'));
 */
export function measurePerformance(name: string, fn: () => void): void {
  const start = performance.now();
  fn();
  const end = performance.now();
  console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
}

/**
 * Wait for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Batch multiple state updates to prevent excessive re-renders
 */
export function batchUpdates(updates: (() => void)[]): void {
  updates.forEach((update) => update());
}
