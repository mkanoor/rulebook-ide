import React, { useState, useRef, useEffect } from 'react';
import * as yaml from 'js-yaml';
import type { Ruleset } from './types/rulebook';
import { VisualEditor, type VisualEditorRef, type ExecutionState } from './components/VisualEditor';
import { JsonPathExplorer } from './components/JsonPathExplorer';
import { HelpModal } from './components/HelpModal';
import { Footer } from './components/Footer';
import { Modal } from './components/common/Modal';
import { themes, defaultTheme, getThemeById, applyTheme, type Theme } from './themes';
import { validateRulesetArray, formatValidationErrors } from './utils/schemaValidator';
import { getCurrentSourceNameFormat, convertAllSources } from './utils/sourceNameConverter';
import { validateAllConditions, formatConditionErrors, getConditionErrorSummary, getFirstInvalidConditionLocation } from './utils/rulebookValidator';
import './App.css';

function App() {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('rulebook-ide-theme');
    return saved ? getThemeById(saved) : defaultTheme;
  });
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [ansibleVersion, setAnsibleVersion] = useState<string>('v1.0.0');
  const [ansibleVersionInfo, setAnsibleVersionInfo] = useState<any>(null);
  const [collectionList, setCollectionList] = useState<any[]>([]);
  const [collectionSearchTerm, setCollectionSearchTerm] = useState('');
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [rulesets, setRulesets] = useState<Ruleset[]>([
    {
      name: 'Example Ruleset',
      hosts: 'all',
      sources: [
        {
          name: 'Example Source',
          'ansible.eda.range': { limit: 5 },
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialRulesets, setInitialRulesets] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visualEditorRef = useRef<VisualEditorRef>(null);
  const [executionState, setExecutionState] = useState<ExecutionState>({
    isConnected: false,
    isRunning: false,
    hasWebhookPorts: false,
    eventCount: 0,
    binaryFound: false,
    binaryError: null,
    executionMode: 'custom',
  });
  const [showJsonPathExplorer, setShowJsonPathExplorer] = useState(false);
  const [webhookPayload, setWebhookPayload] = useState<object | null>(null);
  const [hasNgrokToken, setHasNgrokToken] = useState(false);
  const [jsonPathPrefix, setJsonPathPrefix] = useState('event');
  const [unreadWebhooks, setUnreadWebhooks] = useState(0);
  const [hasNewWebhook, setHasNewWebhook] = useState(false);
  const [rulesetStats, setRulesetStats] = useState<Map<string, any>>(new Map());

  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  // Check for ngrok token and json path prefix on mount and periodically
  useEffect(() => {
    const checkSettings = () => {
      try {
        const saved = localStorage.getItem('rulebook-ide-settings');
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

  // Track unsaved changes
  useEffect(() => {
    const currentState = JSON.stringify(rulesets);
    if (initialRulesets && currentState !== initialRulesets) {
      setHasUnsavedChanges(true);
    } else if (initialRulesets && currentState === initialRulesets) {
      setHasUnsavedChanges(false);
    }
  }, [rulesets, initialRulesets]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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
    localStorage.setItem('rulebook-ide-theme', theme.id);
    setShowThemeSelector(false);
    setMessage({ type: 'success', text: `Theme changed to ${theme.name} (${theme.year})` });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddRuleset = () => {
    const newRuleset: Ruleset = {
      name: 'New Ruleset',
      hosts: 'all',
      sources: [
        {
          name: 'Example Source',
          'ansible.eda.range': { limit: 5 },
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
    // Check for duplicate ruleset names
    const rulesetNames = new Map<string, number>();
    const duplicateRulesets: string[] = [];

    rulesets.forEach((rs, idx) => {
      const trimmedName = rs.name.trim();
      if (rulesetNames.has(trimmedName)) {
        duplicateRulesets.push(`"${trimmedName}" (rulesets #${rulesetNames.get(trimmedName)! + 1} and #${idx + 1})`);
      } else {
        rulesetNames.set(trimmedName, idx);
      }
    });

    // Check for duplicate rule names within each ruleset
    const duplicateRules: string[] = [];
    rulesets.forEach((rs) => {
      const ruleNames = new Map<string, number>();
      rs.rules.forEach((rule, ruleIdx) => {
        const trimmedName = rule.name.trim();
        if (ruleNames.has(trimmedName)) {
          duplicateRules.push(`"${trimmedName}" in ruleset "${rs.name}" (rules #${ruleNames.get(trimmedName)! + 1} and #${ruleIdx + 1})`);
        } else {
          ruleNames.set(trimmedName, ruleIdx);
        }
      });
    });

    // Show error if there are duplicates
    if (duplicateRulesets.length > 0 || duplicateRules.length > 0) {
      let errorMsg = 'Cannot export with duplicate names:\n\n';
      if (duplicateRulesets.length > 0) {
        errorMsg += 'Duplicate Ruleset Names:\n' + duplicateRulesets.map(d => `  • ${d}`).join('\n') + '\n\n';
      }
      if (duplicateRules.length > 0) {
        errorMsg += 'Duplicate Rule Names:\n' + duplicateRules.map(d => `  • ${d}`).join('\n') + '\n\n';
      }
      errorMsg += 'Please fix these issues before exporting.';

      alert(errorMsg);
      return;
    }

    // Validate all conditions before exporting
    const conditionErrors = validateAllConditions(rulesets);
    if (conditionErrors.length > 0) {
      const summary = getConditionErrorSummary(conditionErrors);
      const details = formatConditionErrors(conditionErrors);
      const location = getFirstInvalidConditionLocation(conditionErrors);

      setConfirmationModal({
        isOpen: true,
        title: 'Invalid Conditions',
        message:
          `❌ Cannot export rulebook with invalid conditions!\n\n${summary}\n${details}\n\n⚠️ Please fix these condition errors before exporting your rulebook.`,
        confirmText: 'Go to First Error',
        onConfirm: () => {
          if (location && visualEditorRef.current) {
            visualEditorRef.current.navigateToRule(location.rulesetIndex, location.ruleIndex);
          }
          setConfirmationModal({ ...confirmationModal, isOpen: false });
        },
      });
      return;
    }

    // Validate rulesets before exporting
    const performExport = async () => {
      try {
        // Convert source names based on user's preferred format
        const sourceNameFormat = getCurrentSourceNameFormat();
        const convertedRulesets = convertAllSources(rulesets, sourceNameFormat);

        const yamlStr = yaml.dump(convertedRulesets, {
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
                  description: 'Ansible Rulebook Files (YAML)',
                  accept: {
                    'text/yaml': ['.yml', '.yaml'],
                  },
                },
              ],
            });

            const writable = await handle.createWritable();
            await writable.write(yamlStr);
            await writable.close();

            // Mark as saved - update the baseline state
            setInitialRulesets(JSON.stringify(rulesets));
            setHasUnsavedChanges(false);

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

          // Mark as saved - update the baseline state
          setInitialRulesets(JSON.stringify(rulesets));
          setHasUnsavedChanges(false);

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

    try {
      const validationErrors = validateRulesetArray(rulesets);
      if (validationErrors.length > 0) {
        const errorMessage = formatValidationErrors(validationErrors);
        setConfirmationModal({
          isOpen: true,
          title: 'Validation Errors',
          message: `Validation errors found:\n\n${errorMessage}\n\nDo you want to export anyway?`,
          confirmText: 'Export Anyway',
          onConfirm: () => {
            setConfirmationModal({ ...confirmationModal, isOpen: false });
            performExport();
          },
        });
        return;
      }
    } catch (validationError) {
      console.error('Validation error:', validationError);
      // Continue with export even if validation fails
    }

    await performExport();
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

        // Convert imported source names to the current preferred format
        // This ensures internal consistency regardless of the format of the imported file
        const sourceNameFormat = getCurrentSourceNameFormat();
        const convertedRulesets = convertAllSources(parsed, sourceNameFormat);

        setRulesets(convertedRulesets);
        setCurrentFilename(file.name);

        // Set baseline state for change tracking
        setInitialRulesets(JSON.stringify(convertedRulesets));
        setHasUnsavedChanges(false);

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
    const performNewRulebook = async () => {
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

        // Set baseline state for change tracking
        setInitialRulesets(JSON.stringify(parsedTemplate));
        setHasUnsavedChanges(false);

        setMessage({ type: 'success', text: 'New rulebook created from template!' });
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Failed to load template:', error);
        // Fallback to empty rulebook if template fails
        const fallbackRulesets = [
          {
            name: 'New Ruleset',
            hosts: 'all',
            sources: [],
            rules: [],
          },
        ];
        setRulesets(fallbackRulesets);
        setCurrentFilename(null);

        // Set baseline state for change tracking
        setInitialRulesets(JSON.stringify(fallbackRulesets));
        setHasUnsavedChanges(false);

        setMessage({
          type: 'error',
          text: `Template load failed, created empty rulebook: ${error instanceof Error ? error.message : String(error)}`
        });
        setTimeout(() => setMessage(null), 5000);
      }
    };

    // Check for unsaved changes
    if (hasUnsavedChanges) {
      setConfirmationModal({
        isOpen: true,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Creating a new rulebook will discard them.\n\nAre you sure you want to continue?',
        confirmText: 'Discard Changes',
        onConfirm: () => {
          setConfirmationModal({ ...confirmationModal, isOpen: false });
          performNewRulebook();
        },
      });
      return;
    } else if (rulesets.length > 0) {
      setConfirmationModal({
        isOpen: true,
        title: 'Clear Rulebook',
        message: 'This will clear the current rulebook.\n\nAre you sure you want to continue?',
        confirmText: 'Clear Rulebook',
        onConfirm: () => {
          setConfirmationModal({ ...confirmationModal, isOpen: false });
          performNewRulebook();
        },
      });
      return;
    }

    await performNewRulebook();
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
        text: `Failed to generate rulebook view: ${error instanceof Error ? error.message : String(error)}`,
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
        const saved = localStorage.getItem('rulebook-ide-settings');
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

  const handleCollectionListReceived = (collections: any[]) => {
    setCollectionList(collections);
  };

  return (
    <div className="app">
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0 }}>Ansible Rulebook IDE</h1>
          <span className="app-header-version">{ansibleVersion}</span>
          {currentFilename && (
            <span
              className="app-header-filename"
              title={hasUnsavedChanges ? "Unsaved changes" : "No unsaved changes"}
            >
              📄 <strong>{currentFilename}{hasUnsavedChanges ? ' *' : ''}</strong>
            </span>
          )}
          {!currentFilename && hasUnsavedChanges && (
            <span
              className="app-header-filename"
              title="Unsaved changes"
              style={{ color: 'var(--color-warning, #fbbf24)' }}
            >
              ⚠️ <strong>Unsaved changes</strong>
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
        <button className="btn btn-primary btn-icon" onClick={handleNewRulebook} data-title="New Rulebook">
          📄
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleAddRuleset}
          data-title="Add Ruleset"
        >
          ➕
        </button>
        <button className="btn btn-outline btn-icon" onClick={handleViewYAML} data-title="View Rulebook YAML">
          👁️
        </button>
        <button className="btn btn-outline btn-icon" onClick={handleExportYAML} data-title="Export Rulebook">
          💾
        </button>
        <label className="btn btn-outline btn-icon" style={{ cursor: 'pointer' }} data-title="Import Rulebook">
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
          data-title="Server Settings"
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
          data-title="JSON Path Explorer"
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
            data-title="Cloud Tunnel (External Access)"
          >
            ☁️
          </button>
        )}

        {/* Separator */}
        <div className="toolbar-separator"></div>

        {/* Execution Controls */}
        {!executionState.isRunning ? (
          <button
            className="btn btn-primary btn-icon"
            onClick={() => visualEditorRef.current?.startExecution()}
            disabled={executionState.executionMode !== 'container' && !executionState.binaryFound}
            data-title={
              executionState.executionMode !== 'container' && !executionState.binaryFound
                ? (executionState.binaryError || 'Please set the path of ansible-rulebook in Settings')
                : 'Start Execution'
            }
            style={{
              opacity: executionState.executionMode === 'container' || executionState.binaryFound ? 1 : 0.5,
              cursor: executionState.executionMode === 'container' || executionState.binaryFound ? 'pointer' : 'not-allowed'
            }}
          >
            ▶
          </button>
        ) : (
          <button
            className="btn btn-danger btn-icon"
            onClick={() => visualEditorRef.current?.stopExecution()}
            data-title="Stop Execution"
          >
            ⏹
          </button>
        )}
        {executionState.hasWebhookPorts && executionState.isRunning && (
          <button
            className="btn btn-outline btn-icon"
            onClick={() => visualEditorRef.current?.openWebhookModal()}
            data-title="Send Webhook"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '18px', height: '18px' }}>
              <path fillRule="evenodd" clipRule="evenodd" d="M12.52 3.046a3 3 0 0 0-2.13 5.486 1 1 0 0 1 .306 1.38l-3.922 6.163a2 2 0 1 1-1.688-1.073l3.44-5.405a5 5 0 1 1 8.398-2.728 1 1 0 1 1-1.97-.348 3 3 0 0 0-2.433-3.475zM10 6a2 2 0 1 1 3.774.925l3.44 5.405a5 5 0 1 1-1.427 8.5 1 1 0 0 1 1.285-1.532 3 3 0 1 0 .317-4.83 1 1 0 0 1-1.38-.307l-3.923-6.163A2 2 0 0 1 10 6zm-5.428 6.9a1 1 0 0 1-.598 1.281A3 3 0 1 0 8.001 17a1 1 0 0 1 1-1h8.266a2 2 0 1 1 0 2H9.9a5 5 0 1 1-6.61-5.698 1 1 0 0 1 1.282.597Z" fill="currentColor"></path>
            </svg>
          </button>
        )}
        <button
          className="btn btn-outline btn-icon"
          onClick={() => visualEditorRef.current?.openEventLog()}
          data-title={`Show Event Log${executionState.eventCount > 0 ? ` (${executionState.eventCount})` : ''}`}
        >
          📋
        </button>
        {executionState.eventCount > 0 && (
          <button
            className="btn btn-outline btn-icon"
            onClick={() => visualEditorRef.current?.clearEvents()}
            data-title="Clear Event Log"
          >
            🗑️
          </button>
        )}

        {/* Spacer to push Help and About to the right */}
        <div style={{ flex: 1 }}></div>

        {/* Help and About - Always at the far right */}
        <button
          className="btn btn-outline btn-icon"
          onClick={() => setShowHelpModal(true)}
          data-title="Help & Documentation"
        >
          ❓
        </button>
        <button
          className="btn btn-outline btn-icon"
          onClick={() => setShowAboutModal(true)}
          data-title="About"
        >
          ℹ️
        </button>
      </div>

      {message && (
        <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
          {message.text}
        </div>
      )}

      <VisualEditor
        ref={visualEditorRef}
        rulesets={rulesets}
        onRulesetsChange={setRulesets}
        onExecutionStateChange={setExecutionState}
        onWebhookReceived={handleWebhookReceived}
        onVersionInfoReceived={handleVersionInfoReceived}
        onCollectionListReceived={handleCollectionListReceived}
        onStatsChange={setRulesetStats}
      />

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
        onClose={() => {
          setShowAboutModal(false);
          setCollectionSearchTerm(''); // Reset search when closing
        }}
        title="About Ansible Rulebook IDE"
        footer={
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowAboutModal(false);
              setCollectionSearchTerm(''); // Reset search when closing
            }}
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

                  {/* Ansible Collections Section */}
                  <div style={{ marginTop: '24px', borderTop: '2px solid #e2e8f0', paddingTop: '20px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '12px', color: currentTheme.colors.primary }}>
                      Ansible Collections
                    </h3>

                    {collectionList.length > 0 ? (
                      <>
                        {/* Search box */}
                        <input
                          type="text"
                          placeholder="Search collections..."
                          value={collectionSearchTerm}
                          onChange={(e) => setCollectionSearchTerm(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            marginBottom: '12px',
                            border: '1px solid #cbd5e0',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontFamily: 'monospace'
                          }}
                        />

                        {/* Collection list */}
                        <div style={{
                          maxHeight: '300px',
                          overflowY: 'auto',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          backgroundColor: '#f7fafc'
                        }}>
                          {collectionList
                            .filter(col => {
                              const searchLower = collectionSearchTerm.toLowerCase();
                              return col.name?.toLowerCase().includes(searchLower) ||
                                     col.version?.toLowerCase().includes(searchLower);
                            })
                            .map((col, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding: '10px 12px',
                                  borderBottom: idx < collectionList.length - 1 ? '1px solid #e2e8f0' : 'none',
                                  fontSize: '12px'
                                }}
                              >
                                <div style={{ fontWeight: 600, color: '#2d3748', marginBottom: '2px' }}>
                                  {col.name}
                                </div>
                                <div style={{ color: '#718096', fontSize: '11px' }}>
                                  Version: {col.version}
                                </div>
                              </div>
                            ))}

                          {collectionList.filter(col => {
                            const searchLower = collectionSearchTerm.toLowerCase();
                            return col.name?.toLowerCase().includes(searchLower) ||
                                   col.version?.toLowerCase().includes(searchLower);
                          }).length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#a0aec0', fontSize: '12px' }}>
                              No collections match your search
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#718096' }}>
                          Showing {collectionList.filter(col => {
                            const searchLower = collectionSearchTerm.toLowerCase();
                            return col.name?.toLowerCase().includes(searchLower) ||
                                   col.version?.toLowerCase().includes(searchLower);
                          }).length} of {collectionList.length} collections
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '12px', backgroundColor: '#f7fafc', borderRadius: '6px', color: '#718096', fontSize: '12px' }}>
                        No collections found or not yet loaded
                      </div>
                    )}
                  </div>
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

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmationModal.isOpen}
        onClose={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
        title={confirmationModal.title}
        footer={
          <>
            <button
              className="btn btn-outline"
              onClick={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
            >
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmationModal.onConfirm}>
              {confirmationModal.confirmText || 'Confirm'}
            </button>
          </>
        }
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>{confirmationModal.message}</div>
      </Modal>

      {/* Footer */}
      <Footer
        isConnected={executionState.isConnected}
        isRunning={executionState.isRunning}
        rulesetCount={rulesets.length}
        ruleCount={rulesets.reduce((sum, rs) => sum + rs.rules.length, 0)}
        rulesetStats={rulesetStats}
      />
    </div>
  );
}

export default App;
