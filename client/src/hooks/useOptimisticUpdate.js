import { useState, useCallback, useRef } from 'react';

export function useOptimisticUpdate() {
  const [pendingActions, setPendingActions] = useState(new Map());
  const rollbackDataRef = useRef(new Map());

  const execute = useCallback(async ({
    action,
    optimisticUpdate,
    onRollback,
    onSuccess,
    maxRetries = 3,
    tempId
  }) => {
    const id = tempId || `action-${Date.now()}`;

    setPendingActions(prev => new Map(prev).set(id, { status: 'sending' }));

    if (optimisticUpdate) {
      rollbackDataRef.current.set(id, optimisticUpdate());
    }

    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await action();
        setPendingActions(prev => {
          const next = new Map(prev);
          next.set(id, { status: 'sent' });
          return next;
        });
        rollbackDataRef.current.delete(id);
        if (onSuccess) onSuccess(result);
        return { success: true, data: result };
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    setPendingActions(prev => {
      const next = new Map(prev);
      next.set(id, { status: 'failed', error: lastError });
      return next;
    });

    if (onRollback) {
      onRollback();
    }
    rollbackDataRef.current.delete(id);

    return { success: false, error: lastError };
  }, []);

  const retry = useCallback(async (tempId, executeFn) => {
    const pending = pendingActions.get(tempId);
    if (!pending || pending.status !== 'failed') return;

    setPendingActions(prev => new Map(prev).set(tempId, { status: 'retrying' }));
    await executeFn();
  }, [pendingActions, execute]);

  const clearAction = useCallback((tempId) => {
    setPendingActions(prev => {
      const next = new Map(prev);
      next.delete(tempId);
      return next;
    });
    rollbackDataRef.current.delete(tempId);
  }, []);

  const getActionStatus = useCallback((tempId) => {
    return pendingActions.get(tempId) || null;
  }, [pendingActions]);

  return {
    pendingActions,
    execute,
    retry,
    clearAction,
    getActionStatus
  };
}
