'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePlaidLink } from 'react-plaid-link';
import { Transaction, Account } from '@/lib/types';

type Status = 'idle' | 'loading-token' | 'ready' | 'exchanging' | 'fetching' | 'error';

export default function PlaidConnect() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const fetchLinkToken = useCallback(async () => {
    setStatus('loading-token');
    setError(null);
    try {
      const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create link token');
      setLinkToken(data.link_token);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  }, []);

  const onSuccess = useCallback(async (publicToken: string) => {
    setStatus('exchanging');
    setError(null);
    try {
      const exchangeRes = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken }),
      });
      const exchangeData = await exchangeRes.json();
      if (!exchangeRes.ok) throw new Error(exchangeData.error ?? 'Failed to exchange token');

      setStatus('fetching');
      const txRes = await fetch('/api/plaid/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: exchangeData.access_token }),
      });
      const txData = await txRes.json();
      if (!txRes.ok) throw new Error(txData.error ?? 'Failed to fetch transactions');

      localStorage.setItem(
        'smartbiz_data',
        JSON.stringify({
          transactions: txData.transactions as Transaction[],
          accounts: txData.accounts as Account[],
        }),
      );

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  }, [router]);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  // Auto-open Plaid Link as soon as the token is ready
  if (status === 'ready' && ready && linkToken && !hasAutoOpened) {
    setHasAutoOpened(true);
    open();
  }

  const handleButtonClick = useCallback(async () => {
    if (linkToken && ready) {
      open();
    } else {
      await fetchLinkToken();
    }
  }, [linkToken, ready, open, fetchLinkToken]);

  const isLoading = status === 'loading-token' || status === 'exchanging' || status === 'fetching';

  const loadingLabel: Record<string, string> = {
    'loading-token': 'Initializing…',
    exchanging: 'Connecting account…',
    fetching: 'Loading transactions…',
  };

  return (
    <div className="flex flex-col items-center text-center px-6 py-24 md:py-36">
      {/* Badge */}
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium tracking-widest text-indigo-400 uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
        AI-Powered Finance
      </div>

      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
        SmartBiz{' '}
        <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
          Your AI Cash Flow Agent
        </span>
      </h1>

      <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
        Connect your bank account and let AI manage your cash flow operations.
        Real-time insights, automated categorization, and intelligent forecasting.
      </p>

      <div className="mt-10 flex flex-col items-center gap-4">
        <button
          onClick={handleButtonClick}
          disabled={isLoading}
          className="inline-flex h-14 items-center justify-center gap-3 rounded-xl bg-indigo-600 px-8 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/40 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0"
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {loadingLabel[status] ?? 'Loading…'}
            </>
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
              Connect Bank Account
            </>
          )}
        </button>

        <p className="text-xs text-slate-500">
          Secured by <span className="font-medium text-slate-400">Plaid</span>
          {' '}· Bank-level encryption · Read-only access
        </p>
      </div>

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          {error}
        </div>
      )}

      {/* Feature grid */}
      <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-3 w-full max-w-2xl">
        {[
          { icon: '⚡', title: 'Real-Time Sync', desc: 'Transactions update automatically every time you check.' },
          { icon: '🧠', title: 'AI Categorization', desc: 'Every transaction labeled and sorted intelligently.' },
          { icon: '📈', title: 'Cash Flow Forecast', desc: 'Know your runway before the month ends.' },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-white/5 bg-white/3 p-5 text-left backdrop-blur-sm">
            <div className="mb-3 text-2xl">{f.icon}</div>
            <div className="mb-1 text-sm font-semibold text-white">{f.title}</div>
            <div className="text-xs leading-relaxed text-slate-500">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
