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

export default function ActionModal({ recommendation, transactions, accounts, onClose, onApprove }: ActionModalProps) {
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
      setDraft('Failed to generate draft. Please try again.');
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0E1225] p-6 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-400 uppercase">
                {recommendation.severity}
              </span>
              <span className="text-[10px] text-slate-500">{recommendation.type.replace(/_/g, ' ')}</span>
            </div>
            <h3 className="text-base font-semibold text-white">{recommendation.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-400">{recommendation.description}</p>

        {/* Draft area */}
        <div className="mb-4 flex-1 overflow-hidden flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">AI-Generated Draft</span>
            <div className="flex items-center gap-2">
              <button
                onClick={generateDraft}
                disabled={isGenerating}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
              >
                Regenerate
              </button>
              <button
                onClick={handleCopy}
                disabled={isGenerating || !draft}
                className="flex items-center gap-1 rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-50"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-[200px]">
            {isGenerating ? (
              <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 p-4">
                <svg className="h-4 w-4 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-xs text-slate-400">Generating action draft with GPT-4o...</span>
              </div>
            ) : (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-full min-h-[200px] w-full resize-none rounded-lg border border-white/5 bg-black/20 p-4 text-xs leading-relaxed text-slate-300 outline-none focus:border-indigo-500/30"
              />
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2">
          <button
            onClick={() => { onApprove(recommendation.type); onClose(); }}
            className="flex-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30 py-2 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
          >
            Mark as Completed
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-white/5 border border-white/10 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
