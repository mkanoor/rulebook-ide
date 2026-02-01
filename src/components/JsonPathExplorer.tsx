import React, { useEffect, useRef, useState } from 'react';
import { createJSONEditor, type JSONContent } from 'vanilla-jsoneditor';
import * as yaml from 'js-yaml';
import 'vanilla-jsoneditor/themes/jse-theme-dark.css';

interface JsonPathExplorerProps {
  initialJson?: object;
  pathPrefix?: string;
}

export const JsonPathExplorer: React.FC<JsonPathExplorerProps> = ({ initialJson, pathPrefix = 'event' }) => {
  const editorRef = useRef<ReturnType<typeof createJSONEditor> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPath, setSelectedPath] = useState<string>('root');
  const [selectedValue, setSelectedValue] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const [copiedWithValue, setCopiedWithValue] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const editor = createJSONEditor({
        target: containerRef.current,
        props: {
          content: {
            json: initialJson || {
              event: {
                message: "Example webhook payload",
                user: { id: 123, name: "Alice" },
                timestamp: "2026-01-19T12:00:00Z"
              }
            }
          } as JSONContent,
          mode: 'tree' as unknown,
          onSelect: (selection: any) => {
            if (selection && selection.path) {
              const formattedPath = selection.path.length > 0
                ? pathPrefix + '.' + selection.path.join('.')
                : 'root';
              setSelectedPath(formattedPath);

              // Get the value at the selected path
              try {
                const content = editor.get();
                if (content && 'json' in content) {
                  let value: unknown = content.json;
                  for (const key of selection.path) {
                    value = value[key];
                  }
                  setSelectedValue(value);
                }
              } catch (error) {
                setSelectedValue(null);
              }
            }
          }
        }
      });

      editorRef.current = editor;
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);

  // Update editor content when initialJson changes
   
  useEffect(() => {
    if (editorRef.current && initialJson) {
      try {
        editorRef.current.set({ json: initialJson });
      } catch (error) {
        console.error('Error updating JSON editor:', error);
      }
    }
  }, [initialJson]);
   

  const copyPath = () => {
    navigator.clipboard.writeText(selectedPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyPathAndValue = () => {
    let formattedValue: string;

    if (selectedValue === null) {
      formattedValue = 'null';
    } else if (selectedValue === undefined) {
      formattedValue = 'undefined';
    } else if (typeof selectedValue === 'string') {
      formattedValue = `"${selectedValue}"`;
    } else if (typeof selectedValue === 'number' || typeof selectedValue === 'boolean') {
      formattedValue = String(selectedValue);
    } else if (Array.isArray(selectedValue)) {
      formattedValue = JSON.stringify(selectedValue);
    } else if (typeof selectedValue === 'object') {
      formattedValue = JSON.stringify(selectedValue);
    } else {
      formattedValue = String(selectedValue);
    }

    const pathWithValue = `${selectedPath} == ${formattedValue}`;
    navigator.clipboard.writeText(pathWithValue);
    setCopiedWithValue(true);
    setTimeout(() => setCopiedWithValue(false), 2000);
  };

  const handleFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let json;

        // Try to parse as JSON first
        try {
          json = JSON.parse(content);
        } catch {
          // If JSON parsing fails, try YAML
          try {
            json = yaml.load(content);
          } catch (yamlError) {
            throw new Error('Failed to parse as JSON or YAML: ' + (yamlError as Error).message);
          }
        }

        // Update the editor content
        if (editorRef.current) {
          editorRef.current.set({ json });
        }
      } catch (error) {
        alert('Failed to parse file: ' + (error as Error).message);
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be loaded again
    event.target.value = '';
  };

  const handleLoadFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{
        background: '#2c3e50',
        color: 'white',
        padding: '12px',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <strong>Selected Path:</strong>{' '}
          <span style={{
            fontFamily: 'monospace',
            color: '#3498db',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            {selectedPath}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-small"
            onClick={handleLoadFileClick}
            style={{ marginLeft: '10px' }}
          >
            📁 Load File
          </button>
          <button
            className="btn btn-secondary btn-small"
            onClick={copyPath}
          >
            {copied ? '✓ Copied!' : 'Copy Path'}
          </button>
          <button
            className="btn btn-secondary btn-small"
            onClick={copyPathAndValue}
          >
            {copiedWithValue ? '✓ Copied!' : 'Copy Path & Value'}
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.yaml,.yml,application/json,application/x-yaml,text/yaml"
        onChange={handleFileLoad}
        style={{ display: 'none' }}
      />
      <div
        ref={containerRef}
        style={{
          height: '400px',
          border: '1px solid #ddd',
          borderRadius: '6px',
          overflow: 'hidden'
        }}
      />
      <div style={{ fontSize: '0.85em', color: '#718096' }}>
        💡 Click on any field in the JSON tree to see its path. Use this path in your rule conditions. You can load JSON or YAML files - YAML will be automatically converted to JSON.
      </div>
    </div>
  );
};
