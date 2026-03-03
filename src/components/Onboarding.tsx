'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BusinessType, BusinessStage, Priority, BusinessProfile } from '@/lib/types';
import PlaidMockModal from './PlaidMockModal';

// ── Constants ──────────────────────────────────────────────────────

const BUSINESS_TYPES: BusinessType[] = ['Restaurant', 'Retail', 'Service', 'E-commerce', 'Other'];

const STAGES: { value: BusinessStage; label: string }[] = [
  { value: 'Just Starting', label: 'Just Starting' },
  { value: 'Surviving', label: 'Surviving' },
  { value: 'Stabilizing', label: 'Stabilizing' },
  { value: 'Growing', label: 'Growing' },
  { value: 'Scaling', label: 'Scaling' },
];

const PRIORITIES: { value: Priority; icon: string }[] = [
  { value: 'Understand my cash flow', icon: '📊' },
  { value: 'Reduce expenses', icon: '✂️' },
  { value: 'Hire or expand', icon: '👥' },
  { value: 'Get a loan', icon: '🏦' },
  { value: 'Forecast growth', icon: '📈' },
  { value: 'Track recurring costs', icon: '🔄' },
];

interface Feature {
  name: string;
  description: string;
  alwaysOn: boolean;
  unlockedBy: Priority[];
}

const FEATURES: Feature[] = [
  { name: 'Cash Flow Forecast', description: '60-day history + 90-day projection', alwaysOn: true, unlockedBy: [] },
  { name: 'AI Insights', description: 'Personalized recommendations for your business', alwaysOn: true, unlockedBy: [] },
  { name: 'Spending Analysis', description: 'Category breakdown and recurring charges', alwaysOn: true, unlockedBy: [] },
  { name: 'Growth Projection', description: '24-month revenue trajectory with milestones', alwaysOn: false, unlockedBy: ['Forecast growth', 'Hire or expand'] },
  { name: 'Loan Readiness', description: 'Score and report for lender conversations', alwaysOn: false, unlockedBy: ['Get a loan'] },
];

// ── Props ──────────────────────────────────────────────────────────

interface OnboardingProps {
  onComplete: (profile: BusinessProfile) => void;
}

// ── Component ──────────────────────────────────────────────────────

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);               // 0 = welcome, 1 = business, 2 = priorities, 3 = features
  const [showPlaidModal, setShowPlaidModal] = useState(false);
  const [plaidProgress, setPlaidProgress] = useState(0);

  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [stage, setStage] = useState<BusinessStage | null>(null);
  const [priorities, setPriorities] = useState<Set<Priority>>(new Set());

  const togglePriority = (p: Priority) => {
    setPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const canAdvance = (): boolean => {
    if (step === 1) return businessType !== null && stage !== null;
    if (step === 2) return priorities.size > 0;
    return true;
  };

  const buildProfile = (): BusinessProfile => ({
    businessType: businessType!,
    stage: stage!,
    priorities: [...priorities],
    completedOnboarding: true,
  });

  const isFeatureUnlocked = (f: Feature): boolean => {
    if (f.alwaysOn) return true;
    return f.unlockedBy.some((p) => priorities.has(p));
  };

  // ── Step dot logic (6 dots total) ────────────────────────────────
  // dot 0 = welcome, dot 1-2 = plaid, dot 3 = business, dot 4 = priorities, dot 5 = features
  const currentDotIndex = showPlaidModal
    ? 1 + Math.min(plaidProgress, 1)
    : step === 0
      ? 0
      : step + 2;           // step 1→3, step 2→4, step 3→5

  // ── Plaid modal callbacks ────────────────────────────────────────
  const handlePlaidProgress = useCallback((phase: number) => {
    setPlaidProgress(phase);
  }, []);

  const handlePlaidComplete = useCallback(() => {
    setShowPlaidModal(false);
    setStep(1);
  }, []);

  const handlePlaidBack = useCallback(() => {
    setShowPlaidModal(false);
  }, []);

  const fadeVariants = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -16 },
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-4">
      {/* Step indicator — 6 dots */}
      <div className="flex items-center gap-2 mb-8">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i <= currentDotIndex ? 'bg-[#0D7C66]' : 'bg-[#E8E8E6]'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Step 0: Welcome ─────────────────────────────────────── */}
        {step === 0 && !showPlaidModal && (
          <motion.div
            key="welcome"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="max-w-md w-full text-center"
          >
            <div className="mb-6">
              <span className="text-[#0D7C66] text-lg">✦</span>
            </div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">RunwayAI</h1>
            <p className="mt-2 text-sm text-[#9B9B9B]">Your AI Cash Flow Agent</p>
            <p className="mt-6 text-xs text-[#6B6B6B] leading-relaxed">
              Connect your bank account and tell us about your business
              <br />
              so we can surface the insights that matter most.
            </p>
            <button
              onClick={() => setShowPlaidModal(true)}
              className="mt-8 rounded-lg bg-[#0D7C66] px-8 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0A6B58]"
            >
              Get Started
            </button>
            <div className="mt-4 flex items-center justify-center gap-1.5">
              <svg className="h-3 w-3 text-[#0D7C66]" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a3.5 3.5 0 00-3.5 3.5V7H3.75A1.75 1.75 0 002 8.75v5.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 14.25v-5.5A1.75 1.75 0 0012.25 7H11.5V4.5A3.5 3.5 0 008 1z" />
              </svg>
              <span className="text-[10px] text-[#9B9B9B]">Secured by Plaid · Bank-level encryption · Read-only access</span>
            </div>
          </motion.div>
        )}

        {/* ── Step 1: About Your Business ─────────────────────────── */}
        {step === 1 && (
          <motion.div
            key="about"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="max-w-lg w-full"
          >
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono">
              About Your Business
            </h2>

            <div className="mt-6">
              <p className="text-xs text-[#6B6B6B] mb-3">What type of business do you run?</p>
              <div className="flex flex-wrap gap-2">
                {BUSINESS_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setBusinessType(t)}
                    className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                      businessType === t
                        ? 'border-[#0D7C66] bg-[#E8F5F0] text-[#0D7C66]'
                        : 'border-[#E8E8E6] bg-[#F5F5F3] text-[#6B6B6B] hover:bg-[#F0F0EE]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs text-[#6B6B6B] mb-3">Where are you right now?</p>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStage(s.value)}
                    className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                      stage === s.value
                        ? 'border-[#0D7C66] bg-[#E8F5F0] text-[#0D7C66]'
                        : 'border-[#E8E8E6] bg-[#F5F5F3] text-[#6B6B6B] hover:bg-[#F0F0EE]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10 flex items-center justify-between">
              <button
                onClick={() => setStep(0)}
                className="text-xs text-[#9B9B9B] hover:text-[#6B6B6B] transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canAdvance()}
                className="rounded-lg bg-[#0D7C66] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0A6B58] disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Priorities ──────────────────────────────────── */}
        {step === 2 && (
          <motion.div
            key="priorities"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="max-w-lg w-full"
          >
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono">
              Your Priorities
            </h2>
            <p className="mt-2 text-xs text-[#6B6B6B]">
              What matters most right now? Select all that apply.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => togglePriority(p.value)}
                  className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-left text-xs font-medium transition-colors ${
                    priorities.has(p.value)
                      ? 'border-[#0D7C66] bg-[#E8F5F0] text-[#0D7C66]'
                      : 'border-[#E8E8E6] bg-[#F5F5F3] text-[#6B6B6B] hover:bg-[#F0F0EE]'
                  }`}
                >
                  <span className="text-base">{p.icon}</span>
                  {p.value}
                </button>
              ))}
            </div>

            <div className="mt-10 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-xs text-[#9B9B9B] hover:text-[#6B6B6B] transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canAdvance()}
                className="rounded-lg bg-[#0D7C66] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0A6B58] disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Feature Map ────────────────────────────────── */}
        {step === 3 && (
          <motion.div
            key="features"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="max-w-lg w-full"
          >
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono">
              Your Dashboard
            </h2>
            <p className="mt-2 text-xs text-[#6B6B6B]">
              Based on your priorities, here&apos;s what we&apos;re setting up for you.
            </p>

            <div className="mt-6 space-y-1">
              {FEATURES.map((f) => {
                const unlocked = isFeatureUnlocked(f);
                return (
                  <div
                    key={f.name}
                    className={`flex items-start gap-3 rounded-lg px-4 py-3 ${
                      unlocked ? 'bg-white' : 'bg-[#F5F5F3]/50'
                    }`}
                  >
                    {unlocked ? (
                      <svg className="h-4 w-4 shrink-0 mt-0.5 text-[#0D7C66]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3,8 6.5,11.5 13,5" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 shrink-0 mt-0.5 text-[#9B9B9B]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="7" width="8" height="7" rx="1.5" />
                        <path d="M6 7V5a2 2 0 014 0v2" />
                      </svg>
                    )}
                    <div className="min-w-0">
                      <div className={`text-sm font-medium ${unlocked ? 'text-[#1A1A1A]' : 'text-[#9B9B9B]'}`}>
                        {f.name}
                      </div>
                      <div className={`text-[11px] mt-0.5 ${unlocked ? 'text-[#6B6B6B]' : 'text-[#9B9B9B]'}`}>
                        {unlocked ? f.description : 'Update your priorities to unlock'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                onClick={() => onComplete(buildProfile())}
                className="w-full max-w-xs rounded-lg bg-[#0D7C66] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0A6B58]"
              >
                Continue to Dashboard
              </button>
            </div>

            <div className="mt-6 flex justify-start">
              <button
                onClick={() => setStep(2)}
                className="text-xs text-[#9B9B9B] hover:text-[#6B6B6B] transition-colors"
              >
                Back
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Plaid Mock Modal (overlay) ──────────────────────────── */}
      <AnimatePresence>
        {showPlaidModal && (
          <PlaidMockModal
            onComplete={handlePlaidComplete}
            onBack={handlePlaidBack}
            onProgress={handlePlaidProgress}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
