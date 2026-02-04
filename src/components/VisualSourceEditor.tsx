import React from 'react';
import type { Source } from '../types/rulebook';
import { SourceEditorBase } from './common/SourceEditorBase';

interface VisualSourceEditorProps {
  source: Source;
  onChange: (source: Source) => void;
  onDelete: () => void;
}

export const VisualSourceEditor: React.FC<VisualSourceEditorProps> = ({
  source,
  onChange,
  onDelete,
}) => {
  return (
    <SourceEditorBase
      source={source}
      onChange={onChange}
      onDelete={onDelete}
      logPrefix="VisualSourceEditor"
      renderWrapper={(content) => (
        <div className="properties-content">
          <h3>Source Properties</h3>
          {content}
          <button className="btn btn-danger" onClick={onDelete} style={{ marginTop: '20px' }}>
            Delete Source
          </button>
        </div>
      )}
    />
  );
};
