import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { LoadingFallback } from '@/components/LoadingFallback';

/**
 * Lazy load a component with optional loading fallback
 *
 * @example
 * const LazyEditor = lazyLoad(() => import('./Editor'));
 * const LazyEditor = lazyLoad(() => import('./Editor'), <CustomLoader />);
 */
export function lazyLoad<P extends Record<string, unknown>>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  fallback?: ReactNode
): ComponentType<P> {
  const LazyComponent = lazy(importFunc);

  return function LazyLoadedComponent(props: P) {
    return (
      <Suspense fallback={fallback || <LoadingFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Preload a lazy component
 *
 * @example
 * const LazyEditor = lazyLoad(() => import('./Editor'));
 * preloadComponent(() => import('./Editor')); // Start loading before needed
 */
export function preloadComponent(importFunc: () => Promise<unknown>): void {
  importFunc();
}

/**
 * Lazy load multiple components
 *
 * @example
 * const [Editor, Viewer] = lazyLoadMultiple([
 *   () => import('./Editor'),
 *   () => import('./Viewer')
 * ]);
 */
export function lazyLoadMultiple<P extends Record<string, unknown>>(
  importFuncs: (() => Promise<{ default: ComponentType<P> }>)[],
  fallback?: ReactNode
): ComponentType<P>[] {
  return importFuncs.map((importFunc) => lazyLoad(importFunc, fallback));
}
