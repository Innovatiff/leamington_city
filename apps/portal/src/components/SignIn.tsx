import { useState, type FormEvent } from 'react';
import { useSession } from '../lib/session';
import { sendSignInLink } from '../lib/firebase';

/** One field, one button. No passwords to forget. */
export default function SignIn() {
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
      <h1 className="text-2xl font-bold">{t('portal.title')}</h1>

      {state === 'sent' ? (
        <p className="panel mt-6 text-base">{t('auth.linkSent')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="panel mt-6">
          <label htmlFor="email">{t('auth.emailLabel')}</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            type="submit"
            className="btn-primary mt-4 w-full"
            disabled={state === 'sending'}
          >
            {state === 'sending' ? t('common.loading') : t('auth.sendLink')}
          </button>
          {state === 'error' && (
            <p className="mt-3 text-sm text-red-700">{t('common.error')}</p>
          )}
        </form>
      )}
    </main>
  );
}
