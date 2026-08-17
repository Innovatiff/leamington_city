import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getDocs, query, where } from 'firebase/firestore';
import { toDayKey, type Business } from '@leamington/shared';
import { useSession } from './lib/session';
import { assignBusinessOwner, rebuildFeed, refs, sendSignInLink } from './lib/firebase';

function SignIn() {
  const { t } = useSession();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setState('sending');
    try {
      await sendSignInLink(email.trim());
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">{t('admin.title')}</h1>
      {state === 'sent' ? (
        <p className="panel mt-6">{t('auth.linkSent')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="panel mt-6">
          <label htmlFor="email">{t('auth.emailLabel')}</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="btn-primary mt-4 w-full" disabled={state === 'sending'}>
            {t('auth.sendLink')}
          </button>
          {state === 'error' && (
            <p className="mt-3 text-sm text-red-700">{t('common.error')}</p>
          )}
        </form>
      )}
    </main>
  );
}

/** Grant or revoke the `businessId` claim that lets an owner edit a listing. */
function ClaimAssigner({ business }: { business: Business }) {
  const { t } = useSession();
  const [uid, setUid] = useState('');
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  async function assign(next: string | null): Promise<void> {
    setState('working');
    try {
      await assignBusinessOwner({ uid: uid.trim(), businessId: next, roles: ['owner'] });
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1">
        <label htmlFor={`uid-${business.id}`} className="text-sm">
          Owner uid
        </label>
        <input
          id={`uid-${business.id}`}
          type="text"
          value={uid}
          onChange={(event) => setUid(event.target.value)}
          placeholder="Firebase Auth uid"
        />
      </div>
      <button
        type="button"
        className="btn-primary"
        disabled={!uid.trim() || state === 'working'}
        onClick={() => assign(business.id)}
      >
        {t('admin.approve')}
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={!uid.trim() || state === 'working'}
        onClick={() => assign(null)}
      >
        {t('admin.reject')}
      </button>
      {state === 'done' && <span className="text-sm text-green-700">{t('portal.saved')}</span>}
      {state === 'error' && <span className="text-sm text-red-700">{t('common.error')}</span>}
    </div>
  );
}

export default function App() {
  const { user, roles, loading, t, signOutNow } = useSession();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedMessage, setFeedMessage] = useState<string | null>(null);
  const isAdmin = roles.includes('admin');

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    void getDocs(query(refs.businesses(), where('status', '==', 'published')))
      .then((snapshot) => {
        if (cancelled) return;
        setBusinesses(
          snapshot.docs
            .map((entry) => entry.data())
            .sort((a, b) => a.sortName.localeCompare(b.sortName)),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return businesses;
    return businesses.filter(
      (business) =>
        business.name.toLowerCase().includes(needle) ||
        business.slug.includes(needle) ||
        business.address.postalCode.toLowerCase().includes(needle),
    );
  }, [businesses, search]);

  if (loading) return <p className="p-6">{t('common.loading')}</p>;
  if (!user) return <SignIn />;
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="panel">{t('auth.notAuthorized')}</p>
        <button type="button" className="btn-secondary mt-4" onClick={signOutNow}>
          {t('auth.signOut')}
        </button>
      </main>
    );
  }

  async function handleRebuild(): Promise<void> {
    setBusy(true);
    setFeedMessage(null);
    try {
      const result = await rebuildFeed(toDayKey());
      setFeedMessage(`${result.data.items} items`);
    } catch {
      setFeedMessage(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.title')}</h1>
          <p className="text-sm text-neutral-600">{user.email}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={signOutNow}>
          {t('auth.signOut')}
        </button>
      </header>

      <section className="panel mt-6">
        <h2 className="text-lg font-bold">{t('admin.feed')}</h2>
        <p className="hint">{toDayKey()}</p>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" className="btn-primary" onClick={handleRebuild} disabled={busy}>
            {t('admin.rebuildFeed')}
          </button>
          {feedMessage && <span className="text-sm text-neutral-700">{feedMessage}</span>}
        </div>
      </section>

      <section className="panel mt-6">
        <h2 className="text-lg font-bold">{t('admin.businesses')}</h2>
        <input
          type="text"
          className="mt-2"
          placeholder={t('common.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <p className="hint">
          {filtered.length} / {businesses.length}
        </p>

        <ul className="mt-3 divide-y divide-neutral-100">
          {filtered.map((business) => (
            <li key={business.id} className="py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold">{business.name}</p>
                <span className="rounded bg-neutral-100 px-2 py-1 text-xs uppercase">
                  {business.tier}
                </span>
              </div>
              <p className="text-sm text-neutral-600">
                /{business.slug} · {business.address.postalCode} · {business.counts.offers}{' '}
                {t('offer.title').toLowerCase()}
              </p>
              <ClaimAssigner business={business} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
