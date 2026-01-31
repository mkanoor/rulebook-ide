import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { lazyLoad, preloadComponent, lazyLoadMultiple } from '../lazyLoad';

// Mock component for testing
function TestComponent({ message }: { message: string }) {
  return <div>{message}</div>;
}

describe('lazyLoad', () => {
  it('should lazy load a component with default loading fallback', async () => {
    const LazyTest = lazyLoad(() => Promise.resolve({ default: TestComponent }));

    render(<LazyTest message="Hello" />);

    // Should show loading state initially
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Should render component after loading
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
  });

  it('should lazy load a component with custom fallback', async () => {
    const customFallback = <div>Custom loading...</div>;
    const LazyTest = lazyLoad(() => Promise.resolve({ default: TestComponent }), customFallback);

    render(<LazyTest message="World" />);

    expect(screen.getByText('Custom loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('World')).toBeInTheDocument();
    });
  });

  it('should pass props to the lazy loaded component', async () => {
    const LazyTest = lazyLoad(() => Promise.resolve({ default: TestComponent }));

    render(<LazyTest message="Test props" />);

    await waitFor(() => {
      expect(screen.getByText('Test props')).toBeInTheDocument();
    });
  });
});

describe('preloadComponent', () => {
  it('should call the import function to preload', () => {
    const importFunc = vi.fn(() => Promise.resolve({ default: TestComponent }));

    preloadComponent(importFunc);

    expect(importFunc).toHaveBeenCalledTimes(1);
  });

  it('should not throw if import fails', () => {
    const importFunc = vi.fn(() => Promise.reject(new Error('Import failed')));

    expect(() => {
      preloadComponent(importFunc);
    }).not.toThrow();
  });
});

describe('lazyLoadMultiple', () => {
  it('should lazy load multiple components', async () => {
    const Component1 = ({ text }: { text: string }) => <div>Component 1: {text}</div>;
    const Component2 = ({ text }: { text: string }) => <div>Component 2: {text}</div>;

    const [LazyComp1, LazyComp2] = lazyLoadMultiple([
      () => Promise.resolve({ default: Component1 }),
      () => Promise.resolve({ default: Component2 }),
    ]);

    render(
      <div>
        <LazyComp1 text="First" />
        <LazyComp2 text="Second" />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText('Component 1: First')).toBeInTheDocument();
      expect(screen.getByText('Component 2: Second')).toBeInTheDocument();
    });
  });

  it('should use custom fallback for all components', async () => {
    const Component1 = ({ text }: { text: string }) => <div>{text}</div>;
    const Component2 = ({ text }: { text: string }) => <div>{text}</div>;

    const customFallback = <div>Loading all...</div>;

    const [LazyComp1, LazyComp2] = lazyLoadMultiple(
      [
        () => Promise.resolve({ default: Component1 }),
        () => Promise.resolve({ default: Component2 }),
      ],
      customFallback
    );

    render(
      <div>
        <LazyComp1 text="A" />
        <LazyComp2 text="B" />
      </div>
    );

    // Both should show the same custom fallback
    const loadingElements = screen.getAllByText('Loading all...');
    expect(loadingElements.length).toBeGreaterThan(0);
  });
});
