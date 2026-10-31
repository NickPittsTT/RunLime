import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { forgetPhotoUrls } from '@/lib/profilePhoto';
import { wipeLocalRuns } from '@/lib/runDb';
import { clearRunPrefs } from '@/lib/runPrefs';
import { syncRuns } from '@/lib/runSync';
import { disablePushForThisPhone, retryPendingUnregister } from '@/lib/push';
import { forgetGoogleAccount } from '@/lib/socialSignIn';
import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  display_name: string;
  nickname: string | null;
  home_region_id: string;
  account_privacy: 'private' | 'public';
  runner_level: 'casual' | 'club_runner' | 'competitive' | null;
  avatar_path: string | null;
  show_attendance_to_clubs: boolean;
}

export type SessionStatus = 'loading' | 'signedOut' | 'needsProfile' | 'ready';

interface SessionContextValue {
  status: SessionStatus;
  session: Session | null;
  profile: Profile | null;
  /** DOB that passed the on-device age gate in this app session (memory only). */
  passedDob: string | null;
  setPassedDob: (dob: string | null) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [passedDob, setPassedDob] = useState<string | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setStatus('signedOut');
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, nickname, home_region_id, account_privacy, runner_level, avatar_path, show_attendance_to_clubs')
      .maybeSingle();
    if (error) {
      // Offline or server error: keep the session, retry on next refresh.
      setStatus((prev) => (prev === 'loading' ? 'needsProfile' : prev));
      return;
    }
    setProfile(data as Profile | null);
    setStatus(data ? 'ready' : 'needsProfile');
  }, []);

  useEffect(() => {
    // A phone removal that failed at the last sign-out is retried at every start.
    void retryPendingUnregister();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadProfile(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Photo links were signed for the previous account: never reuse them for the next one.
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') forgetPhotoUrls();
      setSession(s);
      void loadProfile(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      profile,
      passedDob,
      setPassedDob,
      refreshProfile: () => loadProfile(session),
      signOut: async () => {
        setPassedDob(null);
        // This phone stops getting the account's push notifications (retried later if offline), and the next
        // Google sign-in shows the account chooser. Neither may block signing out.
        await disablePushForThisPhone();
        // Runs on this phone belong to this account: upload any still waiting, then clear them (and the phone-only
        // weight and tracker settings) so the next account never sees them.
        await syncRuns().catch(() => undefined);
        try {
          wipeLocalRuns();
        } catch {
          // no local run store yet
        }
        await clearRunPrefs().catch(() => undefined);
        await forgetGoogleAccount();
        await supabase.auth.signOut();
        forgetPhotoUrls();
      },
    }),
    [status, session, profile, passedDob, loadProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
