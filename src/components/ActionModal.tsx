'use client';

import { useState, useCallback, useEffect } from 'react';
import { Recommendation, Transaction, Account } from '@/lib/types';

interface ActionModalProps {
  recommendation: Recommendation;
  transactions: Transaction[];
  accounts: Account[];
  onClose: () => void;
  onApprove: (type: string) => void;
}

// ─── Default Action Draft View ──────────────────────────────────────────────

function DefaultActionView({
  recommendation,
  transactions,
  accounts,
  onClose,
  onApprove,
}: ActionModalProps) {
  const [draft, setDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateDraft = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Based on this recommendation, generate a professional action draft I can use immediately. If it involves contacting someone (invoice follow-up, vendor negotiation, etc.), write a complete email. If it's an internal action (cancel subscription, adjust timing), write step-by-step instructions.\n\nRecommendation: ${recommendation.title}\nDetails: ${recommendation.description}\nSuggested action: ${recommendation.suggested_action}\nReasoning: ${recommendation.reasoning}`,
          transactions,
          accounts,
          history: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate');
      setDraft(data.reply);
    } catch {
      setDraft(
        recommendation.suggested_action
          ? `${recommendation.suggested_action}\n\n---\nNote: AI draft unavailable — edit this as needed.`
          : 'Unable to generate a draft right now. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [recommendation, transactions, accounts]);

  useEffect(() => {
    generateDraft();
  }, [generateDraft]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [draft]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-[#E8E8E6] bg-white p-6 shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="mb-4 flex items-start justify-between border-b border-[#E8E8E6] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full bg-[#E8F5F0] px-2 py-0.5 text-[10px] font-medium text-[#0D7C66] uppercase">
                {recommendation.severity}
              </span>
              <span className="text-[10px] text-[#9B9B9B]">{recommendation.type.replace(/_/g, ' ')}</span>
            </div>
            <h3 className="text-base font-semibold text-[#1A1A1A]">{recommendation.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9B9B9B] transition-colors hover:bg-[#F5F5F3] hover:text-[#1A1A1A]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-sm text-[#6B6B6B]">{recommendation.description}</p>

        {/* Draft area */}
        <div className="mb-4 flex-1 overflow-hidden flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[#1A1A1A]">AI-Generated Draft</span>
            <div className="flex items-center gap-2">
              <button
                onClick={generateDraft}
                disabled={isGenerating}
                className="text-[10px] text-[#0D7C66] hover:text-[#0A6B58] disabled:opacity-50 transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={handleCopy}
                disabled={isGenerating || !draft}
                className="flex items-center gap-1 rounded-md bg-[#E8E8E6] hover:bg-[#E0E0DE] px-2 py-1 text-[10px] text-[#1A1A1A] disabled:opacity-50 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-[320px]">
            {isGenerating ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] p-4 min-h-[320px]">
                <svg className="h-4 w-4 animate-spin text-[#0D7C66]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-xs text-[#6B6B6B]">Generating action draft with GPT-4o…</span>
              </div>
            ) : (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-full min-h-[320px] w-full resize-none rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] p-4 text-xs leading-relaxed text-[#1A1A1A] outline-none focus:border-[#0D7C66]/50 transition-colors"
              />
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2">
          <button
            onClick={() => { onApprove(recommendation.type); onClose(); }}
            className="flex-1 rounded-lg bg-[#2D8A56]/10 border border-[#2D8A56]/20 py-2 text-xs font-medium text-[#2D8A56] transition-colors hover:bg-[#2D8A56]/20"
          >
            Mark as Completed
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-[#F5F5F3] border border-[#E8E8E6] py-2 text-xs font-medium text-[#6B6B6B] transition-colors hover:bg-[#F0F0EE]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ActionModal ────────────────────────────────────────────────────────

export default function ActionModal(props: ActionModalProps) {
  return <DefaultActionView {...props} />;
}
