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
                // Handle links: internal anchors scroll within modal, external links open in new tab
                a: ({ node, href, ...props }) => {
                  // Check if it's an internal anchor link (starts with #)
                  if (href && href.startsWith('#')) {
                    return (
                      <a
                        {...props}
                        href={href}
                        onClick={(e) => {
                          e.preventDefault();
                          // Find the target element by ID (remove the # from href)
                          const targetId = href.substring(1);
                          const targetElement = document.getElementById(targetId);
                          if (targetElement) {
                            // Scroll within the help modal content
                            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }}
                      />
                    );
                  }
                  // External links open in new tab
                  return <a {...props} href={href} target="_blank" rel="noopener noreferrer" />;
                },
                // Add IDs to headings so they can be linked to
                h1: ({ node, children, ...props }) => {
                  const id = typeof children === 'string'
                    ? children.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    : undefined;
                  return <h1 {...props} id={id}>{children}</h1>;
                },
                h2: ({ node, children, ...props }) => {
                  const id = typeof children === 'string'
                    ? children.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    : undefined;
                  return <h2 {...props} id={id}>{children}</h2>;
                },
                h3: ({ node, children, ...props }) => {
                  const id = typeof children === 'string'
                    ? children.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    : undefined;
                  return <h3 {...props} id={id}>{children}</h3>;
                },
                h4: ({ node, children, ...props }) => {
                  const id = typeof children === 'string'
                    ? children.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    : undefined;
                  return <h4 {...props} id={id}>{children}</h4>;
                },
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
