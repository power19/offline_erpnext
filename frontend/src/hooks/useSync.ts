import { useState, useCallback, useEffect } from 'react';
import { syncService } from '../services/sync';
import { useAppStore } from '../store';
import { useOnlineStatus } from './useOnlineStatus';

export function useSync() {
  const isOnline = useOnlineStatus();
  const {
    isSyncing,
    pendingSyncCount,
    lastSyncTime,
    setSyncing,
    setPendingSyncCount,
    setLastSyncTime
  } = useAppStore();

  const [error, setError] = useState<string | null>(null);

  // Update sync status
  const updateStatus = useCallback(async () => {
    try {
      const status = await syncService.getSyncStatus();
      setPendingSyncCount(status.pendingCount + status.failedCount);
      setLastSyncTime(status.lastSync);
    } catch (err) {
      console.error('Error updating sync status:', err);
    }
  }, [setPendingSyncCount, setLastSyncTime]);

  // Trigger sync
  const sync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setSyncing(true);
    setError(null);

    try {
      const result = await syncService.triggerSync();
      await updateStatus();

      if (!result.success && result.failed > 0) {
        setError(`${result.failed} item(s) failed to sync`);
      }

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [isOnline, isSyncing, setSyncing, updateStatus]);

  // Pull latest data
  const pullData = useCallback(async () => {
    if (!isOnline) {
      throw new Error('Cannot pull data while offline');
    }

    setSyncing(true);
    setError(null);

    try {
      await syncService.pullLatestData();
      await updateStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull failed');
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [isOnline, setSyncing, updateStatus]);

  // Retry failed syncs
  const retryFailed = useCallback(async () => {
    if (!isOnline) return;

    setSyncing(true);
    setError(null);

    try {
      await syncService.retryFailed();
      await updateStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setSyncing(false);
    }
  }, [isOnline, setSyncing, updateStatus]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingSyncCount > 0) {
      sync();
    }
  }, [isOnline, pendingSyncCount, sync]);

  // Update status periodically
  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [updateStatus]);

  return {
    isOnline,
    isSyncing,
    pendingSyncCount,
    lastSyncTime,
    error,
    sync,
    pullData,
    retryFailed,
    updateStatus
  };
}
