import { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { registerOnlineSync } from './sync/supabaseSync';
import { isSupabaseConfigured } from './lib/supabase';

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {

    function updateOnlineStatus() {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const unregisterSync = registerOnlineSync((result) => {
      if (!result.skipped) {
        setLastSync(new Date().toLocaleTimeString('pt-BR'));
      }
    });

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      unregisterSync();
    };
  }, []);

  return (
    <Dashboard
      isOnline={isOnline}
      lastSync={lastSync}
      isSupabaseConfigured={isSupabaseConfigured}
    />
  );
}
