import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Modal } from './common/Modal';
import './HelpModal.css';
import mermaid from 'mermaid';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpTopic {
  id: string;
  title: string;
  file: string;
  icon: string;
  description: string;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'user-guide',
    title: 'User Guide',
    file: '/docs/USER_GUIDE.md',
    icon: '📖',
    description: 'Complete guide to using the Rulebook IDE',
  },
  {
    id: 'cloud-tunnel',
    title: 'Cloud Tunnel',
    file: '/docs/cloud-tunnel-architecture.md',
    icon: '☁️',
    description: 'Ngrok integration for external webhook testing',
  },
  {
    id: 'autocomplete',
    title: 'Autocomplete',
    file: '/docs/AUTOCOMPLETE_GUIDE.md',
    icon: '⚡',
    description: 'Condition editor autocomplete features',
  },
  {
    id: 'source-compatibility',
    title: 'Source Names',
    file: '/docs/SOURCE_NAME_COMPATIBILITY.md',
    icon: '🔄',
    description: 'Source naming format compatibility',
  },
  {
    id: 'browser-logging',
    title: 'Browser Logging',
    file: '/docs/BROWSER_LOGGING.md',
    icon: '🐛',
    description: 'Debugging with browser console logs',
  },
];

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'system-ui, -apple-system, sans-serif',
});

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [selectedTopic, setSelectedTopic] = useState<string>(HELP_TOPICS[0].id);
  const [markdown, setMarkdown] = useState<string>('Loading documentation...');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mermaidCounterRef = useRef(0);

  const loadTopic = useCallback((topicId: string) => {
    const topic = HELP_TOPICS.find((t) => t.id === topicId);
    if (!topic) return;

    setIsLoading(true);
    setError(null);
    setSelectedTopic(topicId);

    fetch(topic.file)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load documentation: ${response.statusText}`);
        }
        return response.text();
      })
      .then((text) => {
        setMarkdown(text);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  // Load topic when modal opens or topic changes
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadTopic(selectedTopic);
    }
  }, [isOpen, selectedTopic, loadTopic]);

  // Render Mermaid diagrams after markdown content changes

  useEffect(() => {
    if (!isLoading && !error && markdown) {
      // Use setTimeout to ensure DOM is updated
      const timer = setTimeout(() => {
        const mermaidElements = document.querySelectorAll('.mermaid-diagram');
        mermaidElements.forEach((element) => {
          if (element.getAttribute('data-processed') !== 'true') {
            element.setAttribute('data-processed', 'true');
            const code = element.textContent || '';
            const id = `mermaid-${mermaidCounterRef.current++}`;

            mermaid
              .render(id, code)
              .then(({ svg }) => {
                element.innerHTML = svg;
              })
              .catch((error: Error | null) => {
                console.error('Mermaid rendering error:', error);
                element.innerHTML = `<pre style="color: red;">Error rendering diagram: ${error?.message || 'Unknown error'}</pre>`;
              });
          }
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [markdown, isLoading, error]);

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
        {/* Sidebar Navigation */}
        <div className="help-sidebar">
          <div className="help-topics-list">
            {HELP_TOPICS.map((topic) => (
              <button
                key={topic.id}
                className={`help-topic-item ${selectedTopic === topic.id ? 'active' : ''}`}
                onClick={() => loadTopic(topic.id)}
                title={topic.description}
              >
                <span className="help-topic-icon">{topic.icon}</span>
                <div className="help-topic-info">
                  <div className="help-topic-title">{topic.title}</div>
                  <div className="help-topic-desc">{topic.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="help-content-area">
          {isLoading && (
            <div className="help-loading">
              <p>Loading documentation...</p>
            </div>
          )}

          {error && (
            <div className="help-error">
              <p>
                <strong>Error:</strong> {error}
              </p>
              <p style={{ fontSize: '12px', marginTop: '8px' }}>
                Please check that the documentation file exists in the public/docs directory.
              </p>
            </div>
          )}

          {!isLoading && !error && (
            <div className="help-markdown">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Handle images: resolve relative paths to /docs/ directory
                  img: ({ node: _node, src, ...props }) => {
                    // If src is relative (doesn't start with http:// or https:// or /), prepend /docs/
                    const resolvedSrc =
                      src && !src.startsWith('http') && !src.startsWith('/') ? `/docs/${src}` : src;
                    return <img {...props} src={resolvedSrc} />;
                  },
                  // Handle links: internal anchors scroll within modal, external links open in new tab
                  a: ({ node: _node, href, ...props }) => {
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
                  h1: ({ node: _node, children, ...props }) => {
                    const id =
                      typeof children === 'string'
                        ? children
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, '')
                        : undefined;
                    return (
                      <h1 {...props} id={id}>
                        {children}
                      </h1>
                    );
                  },
                  h2: ({ node: _node, children, ...props }) => {
                    const id =
                      typeof children === 'string'
                        ? children
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, '')
                        : undefined;
                    return (
                      <h2 {...props} id={id}>
                        {children}
                      </h2>
                    );
                  },
                  h3: ({ node: _node, children, ...props }) => {
                    const id =
                      typeof children === 'string'
                        ? children
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, '')
                        : undefined;
                    return (
                      <h3 {...props} id={id}>
                        {children}
                      </h3>
                    );
                  },
                  h4: ({ node: _node, children, ...props }) => {
                    const id =
                      typeof children === 'string'
                        ? children
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, '')
                        : undefined;
                    return (
                      <h4 {...props} id={id}>
                        {children}
                      </h4>
                    );
                  },
                  // Handle code blocks - detect Mermaid diagrams
                  code: ({ node: _node, className, children, ...props }) => {
                    const isInline = !className?.includes('language-');
                    const isMermaid = className?.includes('language-mermaid');

                    if (isMermaid) {
                      return (
                        <div className="mermaid-diagram" data-processed="false">
                          {children}
                        </div>
                      );
                    }

                    return isInline ? (
                      <code {...props} className="inline-code">
                        {children}
                      </code>
                    ) : (
                      <code {...props} className="code-block">
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
