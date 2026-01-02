import { useState, useEffect } from 'react';
import { useAppStore } from '../store';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const setAppOnlineStatus = useAppStore(state => state.setOnlineStatus);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setAppOnlineStatus(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setAppOnlineStatus(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setAppOnlineStatus]);

  return isOnline;
}
