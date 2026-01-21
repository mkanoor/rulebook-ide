import React, { useState, useRef, useEffect } from 'react';
import * as yaml from 'js-yaml';
import type { Ruleset } from './types/rulebook';
import { RulesetEditor } from './components/RulesetEditor';
import { VisualEditor, type VisualEditorRef, type ExecutionState } from './components/VisualEditor';
import { JsonPathExplorer } from './components/JsonPathExplorer';
import { Modal } from './components/common/Modal';
import { themes, defaultTheme, getThemeById, applyTheme, type Theme } from './themes';
import { validateRulesetArray, formatValidationErrors } from './utils/schemaValidator';
import './App.css';

type ViewMode = 'form' | 'visual';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('visual');
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('rulebook-editor-theme');
    return saved ? getThemeById(saved) : defaultTheme;
  });
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [ansibleVersion, setAnsibleVersion] = useState<string>('v1.0.0');
  const [ansibleVersionInfo, setAnsibleVersionInfo] = useState<any>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [rulesets, setRulesets] = useState<Ruleset[]>([
    {
      name: 'Example Ruleset',
      hosts: 'all',
      sources: [
        {
          name: 'Example Source',
          'eda.builtin.range': { limit: 5 },
        },
      ],
      rules: [
        {
          name: 'Example Rule',
          condition: 'event.i == 1',
          actions: [
            {
              debug: {
                msg: 'Event triggered!',
              },
            },
          ],
        },
      ],
    },
  ]);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visualEditorRef = useRef<VisualEditorRef>(null);
  const [executionState, setExecutionState] = useState<ExecutionState>({
    isConnected: false,
    isRunning: false,
    hasWebhookPorts: false,
    eventCount: 0,
  });
  const [showJsonPathExplorer, setShowJsonPathExplorer] = useState(false);
  const [webhookPayload, setWebhookPayload] = useState<object | null>(null);
  const [hasNgrokToken, setHasNgrokToken] = useState(false);
  const [jsonPathPrefix, setJsonPathPrefix] = useState('event');
  const [unreadWebhooks, setUnreadWebhooks] = useState(0);
  const [hasNewWebhook, setHasNewWebhook] = useState(false);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  // Check for ngrok token and json path prefix on mount and periodically
  useEffect(() => {
    const checkSettings = () => {
      try {
        const saved = localStorage.getItem('rulebook-editor-settings');
        if (saved) {
          const settings = JSON.parse(saved);
          setHasNgrokToken(!!settings.ngrokApiToken && settings.ngrokApiToken.trim() !== '');
          setJsonPathPrefix(settings.jsonPathPrefix || 'event');
        } else {
          setHasNgrokToken(false);
          setJsonPathPrefix('event');
        }
      } catch {
        setHasNgrokToken(false);
        setJsonPathPrefix('event');
      }
    };

    checkSettings();
    // Check periodically in case settings change
    const interval = setInterval(checkSettings, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close theme selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showThemeSelector && !target.closest('.theme-selector-dropdown') && !target.closest('button[title="Change Theme"]')) {
        setShowThemeSelector(false);
      }
    };

    if (showThemeSelector) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showThemeSelector]);

  const handleThemeChange = (theme: Theme) => {
    setCurrentTheme(theme);
    localStorage.setItem('rulebook-editor-theme', theme.id);
    setShowThemeSelector(false);
    setMessage({ type: 'success', text: `Theme changed to ${theme.name} (${theme.year})` });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleRulesetChange = (index: number, ruleset: Ruleset) => {
    const newRulesets = [...rulesets];
    newRulesets[index] = ruleset;
    setRulesets(newRulesets);
  };

  const handleDeleteRuleset = (index: number) => {
    const newRulesets = rulesets.filter((_, i) => i !== index);
    setRulesets(newRulesets);
  };

  const handleAddRuleset = () => {
    const newRuleset: Ruleset = {
      name: 'New Ruleset',
      hosts: 'all',
      sources: [
        {
          name: 'Example Source',
          'eda.builtin.range': { limit: 5 },
        },
      ],
      rules: [
        {
          name: 'New Rule',
          condition: 'event.status == "active"',
          actions: [
            {
              debug: {
                msg: 'Rule triggered',
              },
            },
          ],
        },
      ],
    };
    setRulesets([...rulesets, newRuleset]);
  };

  const handleExportYAML = async () => {
    try {
      // Validate rulesets before exporting
      try {
        const validationErrors = validateRulesetArray(rulesets);
        if (validationErrors.length > 0) {
          const errorMessage = formatValidationErrors(validationErrors);
          const confirmed = window.confirm(
            `Validation errors found:\n\n${errorMessage}\n\nDo you want to export anyway?`
          );
          if (!confirmed) {
            return;
          }
        }
      } catch (validationError) {
        console.error('Validation error:', validationError);
        // Continue with export even if validation fails
      }

      const yamlStr = yaml.dump(rulesets, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });

      // Use File System Access API if available
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: currentFilename || 'rulebook.yml',
            types: [
              {
                description: 'YAML Files',
                accept: {
                  'text/yaml': ['.yml', '.yaml'],
                },
              },
            ],
          });

          const writable = await handle.createWritable();
          await writable.write(yamlStr);
          await writable.close();

          setMessage({ type: 'success', text: 'Rulebook exported successfully!' });
          setTimeout(() => setMessage(null), 3000);
        } catch (err) {
          // User cancelled or error occurred
          if ((err as Error).name !== 'AbortError') {
            throw err;
          }
          // User cancelled, don't show error
        }
      } else {
        // Fallback to download method for browsers without File System Access API
        const blob = new Blob([yamlStr], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentFilename || 'rulebook.yml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setMessage({ type: 'success', text: 'Rulebook exported successfully!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Failed to export: ${error instanceof Error ? error.message : String(error)}`,
      });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleImportYAML = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = yaml.load(content) as Ruleset[];

        if (!Array.isArray(parsed)) {
          throw new Error('Invalid rulebook format: expected an array of rulesets');
        }

        setRulesets(parsed);
        setCurrentFilename(file.name);
        setMessage({ type: 'success', text: 'Rulebook imported successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        setMessage({
          type: 'error',
          text: `Failed to import: ${error instanceof Error ? error.message : String(error)}`,
        });
        setTimeout(() => setMessage(null), 5000);
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleNewRulebook = async () => {
    if (
      rulesets.length === 0 ||
      window.confirm('This will clear the current rulebook. Continue?')
    ) {
      try {
        // Get template path from settings
        const settings = visualEditorRef.current?.getSettings();
        const templatePath = settings?.templatePath || '/templates/default-rulebook.yml';

        // Load template
        const response = await fetch(templatePath);
        if (!response.ok) {
          throw new Error(`Failed to load template: ${response.statusText}`);
        }

        const templateContent = await response.text();
        const parsedTemplate = yaml.load(templateContent) as Ruleset[];

        if (!Array.isArray(parsedTemplate)) {
          throw new Error('Invalid template format: expected an array of rulesets');
        }

        setRulesets(parsedTemplate);
        setCurrentFilename(null);
        setMessage({ type: 'success', text: 'New rulebook created from template!' });
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Failed to load template:', error);
        // Fallback to empty rulebook if template fails
        setRulesets([
          {
            name: 'New Ruleset',
            hosts: 'all',
            sources: [],
            rules: [],
          },
        ]);
        setCurrentFilename(null);
        setMessage({
          type: 'error',
          text: `Template load failed, created empty rulebook: ${error instanceof Error ? error.message : String(error)}`
        });
        setTimeout(() => setMessage(null), 5000);
      }
    }
  };

  const handleViewYAML = () => {
    try {
      const yamlStr = yaml.dump(rulesets, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });

      const win = window.open('', '_blank');
      if (win) {
        win.document.write('<html><head><title>Rulebook YAML</title>');
        win.document.write(
          '<style>body { font-family: monospace; white-space: pre; padding: 20px; background: #1e1e1e; color: #d4d4d4; }</style>'
        );
        win.document.write('</head><body>');
        win.document.write(yamlStr);
        win.document.write('</body></html>');
        win.document.close();
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Failed to generate YAML: ${error instanceof Error ? error.message : String(error)}`,
      });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleWebhookReceived = (payload: unknown) => {
    try {
      // Store the payload
      console.log('=== WEBHOOK RECEIVED ===');
      console.log('Payload:', payload);
      console.log('Type:', typeof payload);
      console.log('========================');

      setWebhookPayload(payload as object);

      // Check if auto-show is enabled in settings
      let autoShow = false;
      try {
        const saved = localStorage.getItem('rulebook-editor-settings');
        if (saved) {
          const settings = JSON.parse(saved);
          autoShow = settings.autoShowJsonExplorer || false;
        }
      } catch {
        autoShow = false;
      }

      // Update webhook notification state
      setUnreadWebhooks(prev => prev + 1);
      setHasNewWebhook(true);

      // Clear animation after 3 seconds
      setTimeout(() => setHasNewWebhook(false), 3000);

      // Conditionally open JSON Path Explorer based on setting
      if (autoShow) {
        setShowJsonPathExplorer(true);
        setUnreadWebhooks(0); // Mark as read when auto-opened
        setMessage({
          type: 'success',
          text: '📥 Webhook received via cloud tunnel - JSON Path Explorer opened automatically.',
        });
      } else {
        setMessage({
          type: 'success',
          text: '📥 Webhook received via cloud tunnel - View in JSON Path Explorer 🔍',
        });
      }
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error handling webhook:', error);
      setMessage({
        type: 'error',
        text: `Failed to display webhook: ${error instanceof Error ? error.message : String(error)}`,
      });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleVersionInfoReceived = (version: string, versionInfo: any) => {
    setAnsibleVersion(version);
    setAnsibleVersionInfo(versionInfo);
  };

  return (
    <div className="app">
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0 }}>Ansible Rulebook IDE</h1>
          <span className="app-header-version">{ansibleVersion}</span>
          {currentFilename && (
            <span className="app-header-filename">
              📄 <strong>{currentFilename}</strong>
            </span>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-small btn-outline"
            onClick={() => setShowThemeSelector(!showThemeSelector)}
            title="Change Theme"
          >
            🎨 {currentTheme.name}
          </button>
          {showThemeSelector && (
            <div className="theme-selector-dropdown">
              <div className="theme-selector-header">
                <strong>Pantone Colors of the Year</strong>
              </div>
              <div className="theme-grid">
                {themes.map((theme) => (
                  <div
                    key={theme.id}
                    className={`theme-option ${currentTheme.id === theme.id ? 'selected' : ''}`}
                    onClick={() => handleThemeChange(theme)}
                  >
                    <div
                      className="theme-color-preview"
                      style={{ backgroundColor: theme.colors.primary }}
                    />
                    <div className="theme-info">
                      <div className="theme-name">{theme.name}</div>
                      <div className="theme-year">{theme.year}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary btn-icon" onClick={handleNewRulebook} title="New Rulebook">
          📄
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleAddRuleset}
          title="Add Ruleset"
        >
          ➕
        </button>
        <button className="btn btn-outline btn-icon" onClick={handleViewYAML} title="View YAML">
          👁️
        </button>
        <button className="btn btn-outline btn-icon" onClick={handleExportYAML} title="Export YAML">
          💾
        </button>
        <label className="btn btn-outline btn-icon" style={{ cursor: 'pointer' }} title="Import YAML">
          📁
          <input
            ref={fileInputRef}
            type="file"
            accept=".yml,.yaml"
            onChange={handleImportYAML}
            style={{ display: 'none' }}
          />
        </label>
        <button
          className="btn btn-outline btn-icon"
          onClick={() => visualEditorRef.current?.openSettings()}
          disabled={viewMode !== 'visual'}
          title="Server Settings"
        >
          🔧
        </button>
        <button
          className={`btn btn-outline btn-icon ${hasNewWebhook ? 'btn-has-notification' : ''}`}
          onClick={() => {
            setShowJsonPathExplorer(true);
            setUnreadWebhooks(0);
            setHasNewWebhook(false);
          }}
          title="JSON Path Explorer"
          style={{ position: 'relative' }}
        >
          🔍
          {unreadWebhooks > 0 && (
            <span className="notification-badge">{unreadWebhooks}</span>
          )}
        </button>
        {hasNgrokToken && (
          <button
            className="btn btn-outline btn-icon"
            onClick={() => visualEditorRef.current?.openCloudTunnel()}
            title="Cloud Tunnel (External Access)"
          >
            ☁️
          </button>
        )}
        <button
          className="btn btn-outline btn-icon"
          onClick={() => setShowAboutModal(true)}
          title="About"
        >
          ℹ️
        </button>

        {/* Separator */}
        {viewMode === 'visual' && <div className="toolbar-separator"></div>}

        {/* Execution Controls - Only visible in Visual mode */}
        {viewMode === 'visual' && (
          <>
            {!executionState.isRunning ? (
              <button
                className="btn btn-primary btn-icon"
                onClick={() => visualEditorRef.current?.startExecution()}
                title="Start Execution"
              >
                ▶
              </button>
            ) : (
              <button
                className="btn btn-danger btn-icon"
                onClick={() => visualEditorRef.current?.stopExecution()}
                title="Stop Execution"
              >
                ⏹
              </button>
            )}
            {executionState.hasWebhookPorts && executionState.isRunning && (
              <button
                className="btn btn-outline btn-icon"
                onClick={() => visualEditorRef.current?.openWebhookModal()}
                title="Send Webhook"
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '18px', height: '18px' }}>
                  <path fillRule="evenodd" clipRule="evenodd" d="M12.52 3.046a3 3 0 0 0-2.13 5.486 1 1 0 0 1 .306 1.38l-3.922 6.163a2 2 0 1 1-1.688-1.073l3.44-5.405a5 5 0 1 1 8.398-2.728 1 1 0 1 1-1.97-.348 3 3 0 0 0-2.433-3.475zM10 6a2 2 0 1 1 3.774.925l3.44 5.405a5 5 0 1 1-1.427 8.5 1 1 0 0 1 1.285-1.532 3 3 0 1 0 .317-4.83 1 1 0 0 1-1.38-.307l-3.923-6.163A2 2 0 0 1 10 6zm-5.428 6.9a1 1 0 0 1-.598 1.281A3 3 0 1 0 8.001 17a1 1 0 0 1 1-1h8.266a2 2 0 1 1 0 2H9.9a5 5 0 1 1-6.61-5.698 1 1 0 0 1 1.282.597Z" fill="currentColor"></path>
                </svg>
              </button>
            )}
            <button
              className="btn btn-outline btn-icon"
              onClick={() => visualEditorRef.current?.openEventLog()}
              title={`Show Event Log${executionState.eventCount > 0 ? ` (${executionState.eventCount})` : ''}`}
            >
              📋
            </button>
            {executionState.eventCount > 0 && (
              <button
                className="btn btn-outline btn-icon"
                onClick={() => visualEditorRef.current?.clearEvents()}
                title="Clear Event Log"
              >
                🗑️
              </button>
            )}
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Connection Status - Only visible in Visual mode */}
          {viewMode === 'visual' && (
            <div
              className="status-badge"
              title={executionState.isConnected ? 'Connected to backend server' : 'Not connected to backend server'}
              style={{ cursor: 'help' }}
            >
              <span className={`status-dot ${executionState.isConnected ? 'connected' : 'disconnected'}`}></span>
              <span title={executionState.isConnected ? 'Connected to backend server' : 'Not connected to backend server'}>
                {executionState.isConnected ? '🟢' : '🔴'}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: '5px', marginRight: '15px' }}>
            <button
              className={`btn btn-small ${viewMode === 'visual' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('visual')}
            >
              📊 Visual
            </button>
            <button
              className={`btn btn-small ${viewMode === 'form' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('form')}
            >
              📝 Form
            </button>
          </div>
          <span className="badge badge-info">{rulesets.length} Ruleset(s)</span>
          <span className="badge badge-success">
            {rulesets.reduce((sum, rs) => sum + rs.rules.length, 0)} Rule(s)
          </span>
        </div>
      </div>

      {message && (
        <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
          {message.text}
        </div>
      )}

      {viewMode === 'visual' ? (
        <VisualEditor
          ref={visualEditorRef}
          rulesets={rulesets}
          onRulesetsChange={setRulesets}
          onExecutionStateChange={setExecutionState}
          onWebhookReceived={handleWebhookReceived}
          onVersionInfoReceived={handleVersionInfoReceived}
        />
      ) : rulesets.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No rulesets defined</h3>
            <p>Get started by creating a new ruleset or importing an existing YAML file.</p>
            <button
              className="btn btn-primary"
              onClick={handleAddRuleset}
              style={{ marginTop: '20px' }}
            >
              Create First Ruleset
            </button>
          </div>
        </div>
      ) : (
        rulesets.map((ruleset, index) => (
          <RulesetEditor
            key={index}
            ruleset={ruleset}
            index={index}
            onChange={handleRulesetChange}
            onDelete={handleDeleteRuleset}
          />
        ))
      )}

      {/* JSON Path Explorer Modal */}
      <Modal
        isOpen={showJsonPathExplorer}
        onClose={() => setShowJsonPathExplorer(false)}
        title="JSON Path Explorer"
        size="large"
        footer={
          <button
            className="btn btn-primary"
            onClick={() => setShowJsonPathExplorer(false)}
          >
            Close
          </button>
        }
      >
        <JsonPathExplorer initialJson={webhookPayload || undefined} pathPrefix={jsonPathPrefix} />
      </Modal>

      {/* About Modal */}
      <Modal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
        title="About Ansible Rulebook IDE"
        footer={
          <button
            className="btn btn-primary"
            onClick={() => setShowAboutModal(false)}
          >
            Close
          </button>
        }
      >
        <div>
              {ansibleVersionInfo ? (
                <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '12px', color: currentTheme.colors.primary }}>
                      Ansible Rulebook
                    </h3>
                    <div style={{ padding: '12px', backgroundColor: '#f7fafc', borderRadius: '6px', marginBottom: '8px' }}>
                      <strong>Version:</strong> {ansibleVersionInfo.version}
                    </div>
                    {ansibleVersionInfo.executableLocation && (
                      <div style={{ fontSize: '11px', color: '#718096', marginTop: '4px' }}>
                        <strong>Location:</strong> {ansibleVersionInfo.executableLocation}
                      </div>
                    )}
                  </div>

                  {ansibleVersionInfo.droolsJpyVersion && (
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '16px', marginBottom: '8px', color: currentTheme.colors.primary }}>
                        Drools JPY
                      </h3>
                      <div style={{ padding: '12px', backgroundColor: '#f7fafc', borderRadius: '6px' }}>
                        <strong>Version:</strong> {ansibleVersionInfo.droolsJpyVersion}
                      </div>
                    </div>
                  )}

                  {ansibleVersionInfo.javaVersion && (
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '16px', marginBottom: '8px', color: currentTheme.colors.primary }}>
                        Java
                      </h3>
                      <div style={{ padding: '12px', backgroundColor: '#f7fafc', borderRadius: '6px', marginBottom: '8px' }}>
                        <strong>Version:</strong> {ansibleVersionInfo.javaVersion}
                      </div>
                      {ansibleVersionInfo.javaHome && (
                        <div style={{ fontSize: '11px', color: '#718096', marginTop: '4px' }}>
                          <strong>Home:</strong> {ansibleVersionInfo.javaHome}
                        </div>
                      )}
                    </div>
                  )}

                  {ansibleVersionInfo.ansibleCoreVersion && (
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '16px', marginBottom: '8px', color: currentTheme.colors.primary }}>
                        Ansible Core
                      </h3>
                      <div style={{ padding: '12px', backgroundColor: '#f7fafc', borderRadius: '6px' }}>
                        <strong>Version:</strong> {ansibleVersionInfo.ansibleCoreVersion}
                      </div>
                    </div>
                  )}

                  {ansibleVersionInfo.pythonVersion && (
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '16px', marginBottom: '8px', color: currentTheme.colors.primary }}>
                        Python
                      </h3>
                      <div style={{ padding: '12px', backgroundColor: '#f7fafc', borderRadius: '6px', marginBottom: '8px' }}>
                        <strong>Version:</strong> {ansibleVersionInfo.pythonVersion}
                      </div>
                      {ansibleVersionInfo.pythonExecutable && (
                        <div style={{ fontSize: '11px', color: '#718096', marginTop: '4px' }}>
                          <strong>Executable:</strong> {ansibleVersionInfo.pythonExecutable}
                        </div>
                      )}
                    </div>
                  )}

                  {ansibleVersionInfo.platform && (
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '16px', marginBottom: '8px', color: currentTheme.colors.primary }}>
                        Platform
                      </h3>
                      <div style={{ padding: '12px', backgroundColor: '#f7fafc', borderRadius: '6px' }}>
                        {ansibleVersionInfo.platform}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#718096' }}>
                  <p>Version information not available.</p>
                  <p style={{ fontSize: '12px', marginTop: '8px' }}>
                    Connect to the server to retrieve version details.
                  </p>
                </div>
              )}
            </div>
      </Modal>
    </div>
  );
}

export default App;
