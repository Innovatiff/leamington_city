import { useEffect, useState } from 'react';
import { addDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import {
  formatDate,
  pick,
  type Business,
  type Offer,
  type PublishStatus,
} from '@leamington/shared';
import { refs } from '../lib/firebase';
import { useSession } from '../lib/session';

interface Props {
  business: Business;
}

/** Owner's deals: list, publish/hide, and a deliberately short create form. */
export default function OffersPanel({ business }: Props) {
  const { t, locale } = useSession();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getDocs(query(refs.offers(), where('businessId', '==', business.id)))
      .then((snapshot) => {
        if (cancelled) return;
        setOffers(
          snapshot.docs
            .map((entry) => entry.data())
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        );
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [business.id]);

  async function setStatus(offer: Offer, status: PublishStatus): Promise<void> {
    setOffers((current) =>
      current.map((entry) => (entry.id === offer.id ? { ...entry, status } : entry)),
    );
    try {
      await updateDoc(refs.offer(offer.id), { status, updatedAt: new Date() });
    } catch {
      setError(true);
    }
  }

  async function createDraft(): Promise<void> {
    setCreating(true);
    const now = new Date();
    const endsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    try {
      const created = await addDoc(refs.offers(), {
        businessId: business.id,
        // The denormalized snapshot is written here and kept fresh by the
        // onBusinessWritten trigger thereafter.
        business: {
          id: business.id,
          slug: business.slug,
          name: business.name,
          category: business.category,
          logoUrl: business.logoUrl,
          websiteUrl: business.websiteUrl,
        },
        title: { en: '', es: '' },
        description: { en: '', es: '' },
        terms: { en: '', es: '' },
        kind: 'other',
        percentOff: null,
        amountOff: null,
        channel: 'in_store',
        code: null,
        imageUrl: null,
        startsAt: now,
        endsAt,
        daysOfWeek: [],
        status: 'draft',
        redemptionLimit: null,
        // Rules require this to start at zero; only functions move it.
        redemptionCount: 0,
        perUserLimit: 1,
        featured: false,
        createdAt: now,
        updatedAt: now,
      } satisfies Omit<Offer, 'id'>);

      const snapshot = await getDocs(
        query(refs.offers(), where('businessId', '==', business.id)),
      );
      setOffers(
        snapshot.docs
          .map((entry) => entry.data())
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      );
      void created;
    } catch {
      setError(true);
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className="panel">{t('common.loading')}</p>;

  return (
    <section className="panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t('portal.myOffers')}</h2>
        <button type="button" className="btn-primary" onClick={createDraft} disabled={creating}>
          {t('portal.newOffer')}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{t('portal.saveFailed')}</p>}

      {offers.length === 0 ? (
        <p className="mt-4 text-neutral-600">{t('common.empty')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100">
          {offers.map((offer) => (
            <li key={offer.id} className="flex items-start justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="font-semibold">
                  {pick(offer.title, locale) || t('portal.draftNotice')}
                </p>
                <p className="text-sm text-neutral-600">
                  {formatDate(offer.startsAt, locale)} – {formatDate(offer.endsAt, locale)}
                </p>
                {offer.status === 'draft' && (
                  <p className="hint">{t('portal.draftNotice')}</p>
                )}
              </div>
              <button
                type="button"
                className="btn-secondary shrink-0"
                onClick={() =>
                  setStatus(offer, offer.status === 'published' ? 'draft' : 'published')
                }
              >
                {offer.status === 'published' ? t('portal.unpublish') : t('portal.publish')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
