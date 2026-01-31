import { useState, useCallback } from 'react';

/**
 * Hook for managing webhook-related state
 */
export function useWebhook() {
  const [showJsonPathExplorer, setShowJsonPathExplorer] = useState(false);
  const [webhookPayload, setWebhookPayload] = useState<object | null>(null);
  const [unreadWebhooks, setUnreadWebhooks] = useState(0);
  const [hasNewWebhook, setHasNewWebhook] = useState(false);

  const handleWebhookReceived = useCallback((payload: object) => {
    setWebhookPayload(payload);
    setUnreadWebhooks((prev) => prev + 1);
    setHasNewWebhook(true);
    setShowJsonPathExplorer(true);
  }, []);

  const markWebhooksAsRead = useCallback(() => {
    setUnreadWebhooks(0);
    setHasNewWebhook(false);
  }, []);

  const closeJsonPathExplorer = useCallback(() => {
    setShowJsonPathExplorer(false);
    setHasNewWebhook(false);
  }, []);

  return {
    showJsonPathExplorer,
    setShowJsonPathExplorer,
    webhookPayload,
    setWebhookPayload,
    unreadWebhooks,
    setUnreadWebhooks,
    hasNewWebhook,
    handleWebhookReceived,
    markWebhooksAsRead,
    closeJsonPathExplorer,
  };
}
