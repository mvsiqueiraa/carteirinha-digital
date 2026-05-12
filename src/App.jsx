import { useEffect, useState } from 'react';
import { AuthScreen } from './components/auth/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { getProfile } from './services/profiles';
import { registerOnlineSync } from './sync/supabaseSync';

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsAuthLoading(false);
      return undefined;
    }

    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setIsAuthLoading(false);
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      window.localStorage.setItem('caderninho-current-user-id', session.user.id);
    } else {
      window.localStorage.removeItem('caderninho-current-user-id');
    }
  }, [session?.user?.id]);
  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!session?.user?.id) {
        setProfile(null);
        return;
      }

      try {
        const data = await getProfile(session.user.id);
        if (mounted) setProfile(data);
      } catch (error) {
        console.error('Erro ao carregar perfil', error);
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [session?.user?.id]);

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

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-app-paper px-4 text-app-ink">
        <div className="rounded-xl border border-app-line bg-white p-5 text-center shadow-note">
          <p className="font-black text-app-coralDark">Carregando seu caderninho...</p>
        </div>
      </main>
    );
  }

  if (isSupabaseConfigured && !session) {
    return <AuthScreen />;
  }

  return (
    <Dashboard
      currentUser={session?.user ?? null}
      profile={profile}
      onProfileUpdated={setProfile}
      isOnline={isOnline}
      lastSync={lastSync}
      isSupabaseConfigured={isSupabaseConfigured}
    />
  );
}

