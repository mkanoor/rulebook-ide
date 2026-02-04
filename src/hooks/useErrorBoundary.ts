import { useState, useEffect } from 'react';
import { errorHandler } from '../utils/errors';

/**
 * Hook to catch and handle global errors
 */
export function useErrorBoundary() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setError(event.error);
      errorHandler.log(event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      setError(error);
      errorHandler.log(error, { type: 'unhandled_rejection' });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const clearError = () => setError(null);

  return { error, clearError };
}
