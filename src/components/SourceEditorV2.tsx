import React from 'react';
import type { Source } from '../types/rulebook';
import { SourceEditorBase } from './common/SourceEditorBase';

interface SourceEditorV2Props {
  source: Source;
  index: number;
  onChange: (index: number, source: Source) => void;
  onDelete: (index: number) => void;
}

export const SourceEditorV2: React.FC<SourceEditorV2Props> = ({
  source,
  index,
  onChange,
  onDelete,
}) => {
  return (
    <SourceEditorBase
      source={source}
      onChange={(newSource) => onChange(index, newSource)}
      onDelete={() => onDelete(index)}
      logPrefix="SourceEditorV2"
      renderWrapper={(content) => (
        <div className="source">
          <div className="source-header">
            <h4>Source #{index + 1}</h4>
            <button className="btn btn-danger btn-small" onClick={() => onDelete(index)}>
              Delete Source
            </button>
          </div>
          {content}
        </div>
      )}
    />
  );
};
