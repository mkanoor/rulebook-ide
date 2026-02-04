import { useState, useRef, useCallback } from 'react';
import type { JsonSchema } from '../utils/schemaLoader';
import {
  loadAndProcessSchemaFromUrl,
  loadAndProcessSchemaFromFile,
  isSchemaLoadError,
  type SchemaLoadResult,
} from '../utils/schemaLoaderUtils';

interface UseSchemaLoaderOptions {
  onSchemaLoaded?: (result: SchemaLoadResult) => void;
  onError?: (error: string) => void;
}

export function useSchemaLoader(options: UseSchemaLoaderOptions = {}) {
  const [schemaUrl, setSchemaUrl] = useState<string>('');
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedSchema, setLoadedSchema] = useState<JsonSchema | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Load schema from a URL or file path
   */
  const loadFromUrl = useCallback(
    async (url: string): Promise<SchemaLoadResult | null> => {
      setLoading(true);
      setSchemaError(null);

      const result = await loadAndProcessSchemaFromUrl(url);

      if (isSchemaLoadError(result)) {
        setSchemaError(result.error);
        setLoading(false);
        options.onError?.(result.error);
        return null;
      }

      setLoadedSchema(result.schema);
      setLoading(false);
      options.onSchemaLoaded?.(result);
      return result;
    },
    [options]
  );

  /**
   * Load schema from a File object
   */
  const loadFromFile = useCallback(
    async (file: File): Promise<SchemaLoadResult | null> => {
      console.log('useSchemaLoader: Loading file:', file.name);
      setLoading(true);
      setSchemaError(null);

      const result = await loadAndProcessSchemaFromFile(file);

      if (isSchemaLoadError(result)) {
        console.error('useSchemaLoader: Schema load error:', result.error);
        setSchemaError(result.error);
        setLoading(false);
        options.onError?.(result.error);
        return null;
      }

      console.log('useSchemaLoader: Schema loaded successfully:', result.schema.title);
      // Update the URL to show the filename
      setSchemaUrl(file.name);
      setLoadedSchema(result.schema);
      setLoading(false);
      console.log('useSchemaLoader: Calling onSchemaLoaded callback');
      options.onSchemaLoaded?.(result);
      return result;
    },
    [options]
  );

  /**
   * Handle file input change event
   */
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>): Promise<SchemaLoadResult | null> => {
      const file = event.target.files?.[0];
      if (!file) return null;

      const result = await loadFromFile(file);

      // Reset the input so the same file can be selected again
      event.target.value = '';

      return result;
    },
    [loadFromFile]
  );

  /**
   * Open the file picker dialog
   */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Clear the loaded schema and reset state
   */
  const clearSchema = useCallback(() => {
    setLoadedSchema(null);
    setSchemaUrl('');
    setSchemaError(null);
    setLoading(false);
  }, []);

  return {
    // State
    schemaUrl,
    schemaError,
    loading,
    loadedSchema,
    fileInputRef,

    // Actions
    setSchemaUrl,
    loadFromUrl,
    loadFromFile,
    handleFileSelect,
    openFilePicker,
    clearSchema,
  };
}
