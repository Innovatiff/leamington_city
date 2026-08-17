/**
 * Session state for the admin app.
 *
 * `roles` comes from the custom claim, not from a Firestore document — the
 * claim is what security rules and the admin-only callables check, so reading
 * anything else here would let the UI and the server disagree.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  DEFAULT_LOCALE,
  isLocale,
  translate,
  type Locale,
  type MessageKey,
} from '@leamington/shared';
import { auth, completeSignInFromLink } from './firebase';

interface Session {
  user: User | null;
  businessId: string | null;
  roles: string[];
  loading: boolean;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  signOutNow: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);
const LOCALE_KEY = 'lc.admin.locale';

function initialLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY);
  if (isLocale(stored)) return stored;
  const browser = navigator.language.split('-')[0];
  return isLocale(browser) ? browser : DEFAULT_LOCALE;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    let cancelled = false;

    // Finish an email-link sign-in before subscribing, so the first auth state
    // we see is the signed-in one rather than a flash of the login screen.
    void completeSignInFromLink().catch(() => undefined);

    const unsubscribe = onAuthStateChanged(auth(), (next) => {
      if (cancelled) return;
      setUser(next);
      if (!next) {
        setBusinessId(null);
        setRoles([]);
        setLoading(false);
        return;
      }
      // `true` forces a refresh so a just-granted claim is visible without
      // asking the owner to sign out and back in.
      void next
        .getIdTokenResult(true)
        .then((token) => {
          if (cancelled) return;
          const claimBusinessId = token.claims['businessId'];
          const claimRoles = token.claims['roles'];
          setBusinessId(typeof claimBusinessId === 'string' ? claimBusinessId : null);
          setRoles(Array.isArray(claimRoles) ? (claimRoles as string[]) : []);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(LOCALE_KEY, next);
    setLocaleState(next);
  }, []);

  const value = useMemo<Session>(
    () => ({
      user,
      businessId,
      roles,
      loading,
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      signOutNow: () => signOut(auth()),
    }),
    [user, businessId, roles, loading, locale, setLocale],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
