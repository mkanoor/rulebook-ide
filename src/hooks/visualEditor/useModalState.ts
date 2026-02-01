/**
 * Hook for managing all modal visibility states
 */
import { useState, useCallback } from 'react';

export interface ModalState {
  showEventLog: boolean;
  showExecutionModal: boolean;
  showWebhookModal: boolean;
  showSettingsModal: boolean;
  showStatsModal: boolean;
  showCloudTunnelModal: boolean;
  showAddActionModal: boolean;
  showTriggerEventModal: boolean;
}

export const useModalState = () => {
  const [showEventLog, setShowEventLog] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showCloudTunnelModal, setShowCloudTunnelModal] = useState(false);
  const [showAddActionModal, setShowAddActionModal] = useState(false);
  const [showTriggerEventModal, setShowTriggerEventModal] = useState(false);

  const openSettings = useCallback(() => setShowSettingsModal(true), []);
  const closeSettings = useCallback(() => setShowSettingsModal(false), []);

  const openEventLog = useCallback(() => setShowEventLog(true), []);
  const closeEventLog = useCallback(() => setShowEventLog(false), []);

  const openWebhookModal = useCallback(() => setShowWebhookModal(true), []);
  const closeWebhookModal = useCallback(() => setShowWebhookModal(false), []);

  const openExecutionModal = useCallback(() => setShowExecutionModal(true), []);
  const closeExecutionModal = useCallback(() => setShowExecutionModal(false), []);

  const openStatsModal = useCallback(() => setShowStatsModal(true), []);
  const closeStatsModal = useCallback(() => setShowStatsModal(false), []);

  const openCloudTunnel = useCallback(() => setShowCloudTunnelModal(true), []);
  const closeCloudTunnel = useCallback(() => setShowCloudTunnelModal(false), []);

  const openAddActionModal = useCallback(() => setShowAddActionModal(true), []);
  const closeAddActionModal = useCallback(() => setShowAddActionModal(false), []);

  const openTriggerEventModal = useCallback(() => setShowTriggerEventModal(true), []);
  const closeTriggerEventModal = useCallback(() => setShowTriggerEventModal(false), []);

  return {
    // State
    showEventLog,
    showExecutionModal,
    showWebhookModal,
    showSettingsModal,
    showStatsModal,
    showCloudTunnelModal,
    showAddActionModal,
    showTriggerEventModal,

    // Setters (for direct control)
    setShowEventLog,
    setShowExecutionModal,
    setShowWebhookModal,
    setShowSettingsModal,
    setShowStatsModal,
    setShowCloudTunnelModal,
    setShowAddActionModal,
    setShowTriggerEventModal,

    // Convenience methods
    openSettings,
    closeSettings,
    openEventLog,
    closeEventLog,
    openWebhookModal,
    closeWebhookModal,
    openExecutionModal,
    closeExecutionModal,
    openStatsModal,
    closeStatsModal,
    openCloudTunnel,
    closeCloudTunnel,
    openAddActionModal,
    closeAddActionModal,
    openTriggerEventModal,
    closeTriggerEventModal,
  };
};
