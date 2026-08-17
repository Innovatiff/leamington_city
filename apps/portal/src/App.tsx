import { useEffect, useState } from 'react';
import { getDoc } from 'firebase/firestore';
import { alternateLocale, translate, type Business } from '@leamington/shared';
import { useSession } from './lib/session';
import { refs } from './lib/firebase';
import SignIn from './components/SignIn';
import BusinessForm from './components/BusinessForm';
import OffersPanel from './components/OffersPanel';

export default function App() {
  const { user, businessId, loading, locale, setLocale, t, signOutNow } = useSession();
  const [business, setBusiness] = useState<Business | null>(null);

  useEffect(() => {
    if (!businessId) {
      setBusiness(null);
      return;
    }
    let cancelled = false;
    void getDoc(refs.business(businessId))
      .then((snapshot) => !cancelled && setBusiness(snapshot.data() ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (loading) {
    return <p className="p-6 text-lg">{t('common.loading')}</p>;
  }

  if (!user) return <SignIn />;

  // Signed in, but no businessId claim: the account exists and manages nothing.
  if (!businessId) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p className="panel">{t('auth.notAuthorized')}</p>
        <button type="button" className="btn-secondary mt-4" onClick={signOutNow}>
          {t('auth.signOut')}
        </button>
      </main>
    );
  }

  const other = alternateLocale(locale);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">
            {business?.name ?? t('portal.title')}
          </h1>
          <p className="text-sm text-neutral-600">{user.email}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn-secondary" onClick={() => setLocale(other)}>
            {translate(other, 'common.languageName')}
          </button>
          <button type="button" className="btn-secondary" onClick={signOutNow}>
            {t('auth.signOut')}
          </button>
        </div>
      </header>

      <div className="mt-6 space-y-6">
        <BusinessForm businessId={businessId} />
        {business && <OffersPanel business={business} />}
      </div>
    </div>
  );
}
