import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Modal } from './common/Modal';
import './HelpModal.css';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [markdown, setMarkdown] = useState<string>('Loading documentation...');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);

      fetch('/docs/USER_GUIDE.md')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load documentation: ${response.statusText}`);
          }
          return response.text();
        })
        .then(text => {
          setMarkdown(text);
          setIsLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📚 Help & Documentation"
      size="large"
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="help-modal-content">
        {isLoading && (
          <div className="help-loading">
            <p>Loading documentation...</p>
          </div>
        )}

        {error && (
          <div className="help-error">
            <p><strong>Error:</strong> {error}</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>
              Please check that the documentation file exists in the public/docs directory.
            </p>
          </div>
        )}

        {!isLoading && !error && (
          <div className="help-markdown">
            <ReactMarkdown
              components={{
                // Make links open in new tabs
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
                // Add syntax highlighting class to code blocks
                code: ({ node, className, children, ...props }) => {
                  const isInline = !className?.includes('language-');
                  return isInline
                    ? <code {...props} className="inline-code">{children}</code>
                    : <code {...props} className="code-block">{children}</code>;
                },
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </Modal>
  );
};
