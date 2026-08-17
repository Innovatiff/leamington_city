import { useEffect, useState, type FormEvent } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  COLLECTIONS,
  businessCodec,
  encodePartial,
  toE164,
  toSortName,
  type Business,
} from '@leamington/shared';
import { db, refs } from '../lib/firebase';
import { useSession } from '../lib/session';

interface Props {
  businessId: string;
}

type Status = 'loading' | 'ready' | 'saving' | 'saved' | 'error';

/**
 * The owner's own details. Only the fields firestore.rules lets an owner move
 * are on this form — tier, rank, counts and slug are not editable here, and
 * attempting them would be rejected by the rules anyway.
 */
export default function BusinessForm({ businessId }: Props) {
  const { t } = useSession();
  const [business, setBusiness] = useState<Business | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    void getDoc(refs.business(businessId))
      .then((snapshot) => {
        if (cancelled) return;
        setBusiness(snapshot.data() ?? null);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!business) return;
    setStatus('saving');

    const form = new FormData(event.currentTarget);
    const read = (name: string): string => String(form.get(name) ?? '').trim();

    const name = read('name') || business.name;
    const patch: Partial<Business> = {
      name,
      sortName: toSortName(name),
      shortDescription: {
        en: read('shortDescription_en'),
        es: read('shortDescription_es'),
      },
      description: { en: read('description_en'), es: read('description_es') },
      phone: toE164(read('phone')),
      email: read('email') || null,
      websiteUrl: read('websiteUrl') || null,
      address: {
        ...business.address,
        line1: read('line1'),
        line2: read('line2') || null,
        postalCode: read('postalCode'),
      },
      updatedAt: new Date(),
    };

    try {
      // A partial encode, so nothing outside these fields is touched.
      await updateDoc(
        doc(db(), COLLECTIONS.businesses, businessId),
        encodePartial(businessCodec, patch),
      );
      setBusiness({ ...business, ...patch } as Business);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'loading') return <p className="panel">{t('common.loading')}</p>;
  if (!business) return <p className="panel">{t('common.error')}</p>;

  return (
    <form onSubmit={handleSubmit} className="panel space-y-5">
      <div>
        <label htmlFor="name">{t('portal.editBusiness')}</label>
        <input id="name" name="name" type="text" defaultValue={business.name} required />
      </div>

      <div>
        <label htmlFor="websiteUrl">{t('business.visitWebsite')}</label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
          defaultValue={business.websiteUrl ?? ''}
        />
        <p className="hint">{t('portal.helpWebsite')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone">{t('business.call')}</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={business.phone ?? ''}
          />
        </div>
        <div>
          <label htmlFor="email">{t('auth.emailLabel')}</label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={business.email ?? ''}
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">{t('nav.directory')}</legend>
        <input
          name="line1"
          type="text"
          aria-label="Street"
          defaultValue={business.address.line1}
        />
        <input
          name="line2"
          type="text"
          aria-label="Unit"
          defaultValue={business.address.line2 ?? ''}
        />
        <input
          name="postalCode"
          type="text"
          aria-label="Postal code"
          defaultValue={business.address.postalCode}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">English</legend>
        <input
          name="shortDescription_en"
          type="text"
          maxLength={160}
          defaultValue={business.shortDescription.en}
        />
        <textarea name="description_en" rows={4} defaultValue={business.description.en} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">Español</legend>
        <input
          name="shortDescription_es"
          type="text"
          maxLength={160}
          defaultValue={business.shortDescription.es}
        />
        <textarea name="description_es" rows={4} defaultValue={business.description.es} />
        <p className="hint">{t('portal.helpBilingual')}</p>
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={status === 'saving'}>
          {status === 'saving' ? t('common.loading') : t('portal.save')}
        </button>
        {status === 'saved' && (
          <span className="text-sm font-semibold text-green-700">{t('portal.saved')}</span>
        )}
        {status === 'error' && (
          <span className="text-sm font-semibold text-red-700">
            {t('portal.saveFailed')}
          </span>
        )}
      </div>
    </form>
  );
}
