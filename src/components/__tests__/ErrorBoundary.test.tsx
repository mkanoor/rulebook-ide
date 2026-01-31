import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for cleaner test output
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should catch errors and display default error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/The application encountered an unexpected error/)).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('should display error details in the default UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error details')).toBeInTheDocument();
    expect(screen.getByText(/Error: Test error/)).toBeInTheDocument();
  });

  it('should render custom fallback UI when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should not call onError callback when no error occurs', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(onError).not.toHaveBeenCalled();
  });

  it('should update state via getDerivedStateFromError', () => {
    const error = new Error('Test error');
    const state = ErrorBoundary.getDerivedStateFromError(error);

    expect(state).toEqual({
      hasError: true,
      error,
    });
  });

  it('should reload page when reload button is clicked', () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByText('Reload Page');
    reloadButton.click();

    expect(reloadSpy).toHaveBeenCalled();
  });
});
