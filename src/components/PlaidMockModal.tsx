'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────

type Phase = 'bank-select' | 'login' | 'connecting' | 'accounts' | 'success';

interface Bank {
  id: string;
  name: string;
  color: string;
  letter: string;
}

interface MockAccount {
  id: string;
  name: string;
  type: 'Business' | 'Merchant' | 'Personal' | 'Credit Card';
  balance: number;
}

interface PlaidMockModalProps {
  onComplete: () => void;
  onBack: () => void;
  onProgress: (phase: number) => void;
}

// ── Data ──────────────────────────────────────────────────────────

const BANKS: Bank[] = [
  { id: 'chase', name: 'Chase', color: '#117ACA', letter: 'C' },
  { id: 'bofa', name: 'Bank of America', color: '#012169', letter: 'B' },
  { id: 'wells', name: 'Wells Fargo', color: '#D71E28', letter: 'W' },
  { id: 'capital-one', name: 'Capital One', color: '#004977', letter: 'C' },
  { id: 'us-bank', name: 'US Bank', color: '#0C2074', letter: 'U' },
];

const CHASE_ACCOUNTS: MockAccount[] = [
  { id: 'biz-checking', name: 'Chase Business Complete Checking', type: 'Business', balance: 47250.0 },
  { id: 'merchant', name: 'Chase Merchant Services', type: 'Merchant', balance: 8420.35 },
  { id: 'savings', name: 'Chase Total Savings', type: 'Personal', balance: 12800.0 },
  { id: 'credit', name: 'Chase Sapphire Reserve', type: 'Credit Card', balance: -2341.18 },
  { id: 'biz-checking-2', name: 'Chase Performance Business Checking', type: 'Business', balance: 3105.6 },
];

const TYPE_COLORS: Record<string, string> = {
  Business: 'bg-[#E8F5F0] text-[#0D7C66]',
  Merchant: 'bg-[#E8F0FA] text-[#117ACA]',
  Personal: 'bg-[#F0F0EE] text-[#6B6B6B]',
  'Credit Card': 'bg-[#FDF0E8] text-[#C4702B]',
};

const STATUS_LINES = [
  { text: 'Verifying credentials...', delay: 0 },
  { text: 'Finding accounts...', delay: 800 },
  { text: 'Retrieving balances...', delay: 1600 },
];

const fmt = (n: number) =>
  n < 0
    ? `-$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

// ── Fade variants (matches Onboarding) ────────────────────────────

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

// ── Component ─────────────────────────────────────────────────────

export default function PlaidMockModal({ onComplete, onBack, onProgress }: PlaidMockModalProps) {
  const [phase, setPhase] = useState<Phase>('bank-select');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(
    new Set(['biz-checking', 'merchant']),
  );
  const [connectingDone, setConnectingDone] = useState([false, false, false]);

  // Map phase → progress number for dot tracking
  const phaseToProgress = useCallback((p: Phase) => {
    switch (p) {
      case 'bank-select': return 0;
      case 'login': return 1;
      case 'connecting': return 2;
      case 'accounts': return 3;
      case 'success': return 4;
    }
  }, []);

  useEffect(() => {
    onProgress(phaseToProgress(phase));
  }, [phase, onProgress, phaseToProgress]);

  // Auto-advance login → connecting after 1.5s
  useEffect(() => {
    if (phase !== 'login') return;
    const t = setTimeout(() => setPhase('connecting'), 1500);
    return () => clearTimeout(t);
  }, [phase]);

  // Auto-advance connecting → accounts after 2.5s
  useEffect(() => {
    if (phase !== 'connecting') return;

    const timers = STATUS_LINES.map((s, i) =>
      setTimeout(() => {
        setConnectingDone((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, s.delay + 600),
    );

    const advance = setTimeout(() => setPhase('accounts'), 2500);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(advance);
    };
  }, [phase]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = selectedAccounts.size;
  const selectedAccountData = CHASE_ACCOUNTS.filter((a) => selectedAccounts.has(a.id));

  const handleBankClick = (bank: Bank) => {
    setSelectedBank(bank);
    setPhase('login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />

      {/* Modal card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
      >
        {/* Plaid-style header bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-[#0D7C66] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">R</span>
            </div>
            <span className="text-[11px] text-[#9B9B9B]">RunwayAI</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="h-3 w-3 text-[#0D7C66]" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a3.5 3.5 0 00-3.5 3.5V7H3.75A1.75 1.75 0 002 8.75v5.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 14.25v-5.5A1.75 1.75 0 0012.25 7H11.5V4.5A3.5 3.5 0 008 1z" />
            </svg>
            <span className="text-[10px] text-[#9B9B9B]">Secured by Plaid</span>
          </div>
        </div>

        <div className="px-6 pb-6">
          <AnimatePresence mode="wait">
            {/* ── Phase 1: Bank Selection ──────────────────────────── */}
            {phase === 'bank-select' && (
              <motion.div key="bank-select" variants={fade} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                <h3 className="text-lg font-semibold text-[#1A1A1A] mt-2">Select your bank</h3>
                <p className="text-xs text-[#9B9B9B] mt-1">RunwayAI uses Plaid to securely connect your accounts</p>

                {/* Decorative search bar */}
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-2">
                  <svg className="h-3.5 w-3.5 text-[#9B9B9B]" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="7" cy="7" r="5" />
                    <path d="M11 11l3.5 3.5" />
                  </svg>
                  <span className="text-xs text-[#9B9B9B]">Search banks...</span>
                </div>

                {/* Bank grid */}
                <div className="mt-4 space-y-2">
                  {BANKS.map((bank) => (
                    <button
                      key={bank.id}
                      onClick={() => handleBankClick(bank)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[#E8E8E6] px-4 py-3 text-left transition-colors hover:border-[#0D7C66] hover:bg-[#FAFAF8]"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
                        style={{ backgroundColor: bank.color }}
                      >
                        {bank.letter}
                      </div>
                      <span className="text-sm font-medium text-[#1A1A1A]">{bank.name}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={onBack}
                  className="mt-5 text-xs text-[#9B9B9B] hover:text-[#6B6B6B] transition-colors"
                >
                  Back
                </button>
              </motion.div>
            )}

            {/* ── Phase 2: Login ───────────────────────────────────── */}
            {phase === 'login' && selectedBank && (
              <motion.div key="login" variants={fade} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                {/* Bank header */}
                <div className="flex items-center gap-3 mt-2 mb-5">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-bold"
                    style={{ backgroundColor: selectedBank.color }}
                  >
                    {selectedBank.letter}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#1A1A1A]">{selectedBank.name}</h3>
                    <p className="text-[11px] text-[#9B9B9B]">Enter your credentials</p>
                  </div>
                </div>

                {/* Username */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-[#6B6B6B] uppercase tracking-wider">Username</label>
                    <div className="mt-1 rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-2.5 text-sm text-[#1A1A1A]">
                      demo_user
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#6B6B6B] uppercase tracking-wider">Password</label>
                    <div className="mt-1 rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-2.5 text-sm text-[#1A1A1A] tracking-widest">
                      ••••••••
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setPhase('connecting')}
                  className="mt-5 w-full rounded-lg bg-[#0D7C66] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0A6B58]"
                >
                  Connect
                </button>
              </motion.div>
            )}

            {/* ── Phase 3: Connecting ──────────────────────────────── */}
            {phase === 'connecting' && selectedBank && (
              <motion.div key="connecting" variants={fade} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                <div className="py-6 text-center">
                  {/* Spinner */}
                  <div className="mx-auto mb-4">
                    <motion.div
                      className="h-10 w-10 mx-auto rounded-full border-2 border-[#E8E8E6] border-t-[#0D7C66]"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>

                  <h3 className="text-base font-semibold text-[#1A1A1A]">
                    Connecting to {selectedBank.name}...
                  </h3>

                  {/* Progress bar */}
                  <div className="mt-4 mx-auto max-w-xs h-1.5 rounded-full bg-[#E8E8E6] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[#0D7C66]"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2.5, ease: 'easeInOut' }}
                    />
                  </div>

                  {/* Status lines */}
                  <div className="mt-5 space-y-2 text-left max-w-xs mx-auto">
                    {STATUS_LINES.map((line, i) => (
                      <motion.div
                        key={line.text}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: line.delay / 1000 }}
                        className="flex items-center gap-2 text-xs"
                      >
                        {connectingDone[i] ? (
                          <svg className="h-3.5 w-3.5 text-[#0D7C66] shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3,8 6.5,11.5 13,5" />
                          </svg>
                        ) : (
                          <div className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                            <motion.div
                              className="h-2 w-2 rounded-full bg-[#0D7C66]"
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            />
                          </div>
                        )}
                        <span className={connectingDone[i] ? 'text-[#1A1A1A]' : 'text-[#9B9B9B]'}>
                          {line.text}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Phase 4: Account Selection ───────────────────────── */}
            {phase === 'accounts' && (
              <motion.div key="accounts" variants={fade} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                <h3 className="text-lg font-semibold text-[#1A1A1A] mt-2">Select accounts to connect</h3>
                <p className="text-xs text-[#9B9B9B] mt-1">We found {CHASE_ACCOUNTS.length} accounts at Chase</p>

                <div className="mt-4 space-y-2">
                  {CHASE_ACCOUNTS.map((acct) => {
                    const checked = selectedAccounts.has(acct.id);
                    return (
                      <button
                        key={acct.id}
                        onClick={() => toggleAccount(acct.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                          checked
                            ? 'border-[#0D7C66] bg-[#FAFAF8]'
                            : 'border-[#E8E8E6] hover:bg-[#FAFAF8]'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors ${
                          checked ? 'border-[#0D7C66] bg-[#0D7C66]' : 'border-[#D8D8D6]'
                        }`}>
                          {checked && (
                            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <polyline points="2,6 5,9 10,3" />
                            </svg>
                          )}
                        </div>

                        {/* Account details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#1A1A1A] truncate">{acct.name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[acct.type]}`}>
                              {acct.type}
                            </span>
                          </div>
                        </div>

                        {/* Balance */}
                        <span className={`text-sm font-medium tabular-nums shrink-0 ${
                          acct.balance < 0 ? 'text-[#D94F4F]' : 'text-[#1A1A1A]'
                        }`}>
                          {fmt(acct.balance)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPhase('success')}
                  disabled={selectedCount === 0}
                  className="mt-5 w-full rounded-lg bg-[#0D7C66] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0A6B58] disabled:opacity-40"
                >
                  Connect {selectedCount} account{selectedCount !== 1 ? 's' : ''}
                </button>
              </motion.div>
            )}

            {/* ── Phase 5: Success ─────────────────────────────────── */}
            {phase === 'success' && (
              <motion.div key="success" variants={fade} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                <div className="py-4 text-center">
                  {/* Animated checkmark */}
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5F0]">
                    <motion.svg
                      className="h-7 w-7 text-[#0D7C66]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <motion.polyline
                        points="4,12 9,17 20,6"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                      />
                    </motion.svg>
                  </div>

                  <h3 className="text-lg font-semibold text-[#1A1A1A]">Connected!</h3>
                  <p className="text-xs text-[#9B9B9B] mt-1">
                    {selectedCount} account{selectedCount !== 1 ? 's' : ''} linked successfully
                  </p>
                </div>

                {/* Connected accounts summary */}
                <div className="mt-2 space-y-2">
                  {selectedAccountData.map((acct, i) => (
                    <motion.div
                      key={acct.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="flex items-center justify-between rounded-xl border border-[#E8E8E6] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#1A1A1A] truncate">{acct.name}</div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium mt-0.5 ${TYPE_COLORS[acct.type]}`}>
                          {acct.type}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-[#1A1A1A] tabular-nums shrink-0 ml-3">
                        {fmt(acct.balance)}
                      </span>
                    </motion.div>
                  ))}
                </div>

                <button
                  onClick={onComplete}
                  className="mt-5 w-full rounded-lg bg-[#0D7C66] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0A6B58]"
                >
                  Continue
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
