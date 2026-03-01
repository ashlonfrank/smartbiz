'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Recommendation, RecommendationType, Transaction, Account } from '@/lib/types';
import { Alert } from '@/lib/alerts';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface InsightsPanelProps {
  recommendations: Recommendation[];
  transactions: Transaction[];
  accounts: Account[];
  alerts: Alert[];
  approved: Set<string>;
  dismissed: Set<string>;
  analyzeStatus: 'idle' | 'loading' | 'done' | 'error';
  onApprove: (type: string) => void;
  onDismiss: (type: string) => void;
  onTakeAction: (rec: Recommendation) => void;
}

// ─── Category label map ───────────────────────────────────────────────────

const typeLabels: Record<RecommendationType, string> = {
  cash_flow_forecast: 'Cash Flow',
  overdue_invoices:   'Overdue Invoices',
  anomalies:          'Anomaly',
  subscription_audit: 'Subscription Audit',
  payment_timing:     'Payment Timing',
  loan_readiness:     'Loan Readiness',
};

// ─── Suggested prompts per rec type ──────────────────────────────────────

const PROMPTS: Record<RecommendationType, string[]> = {
  overdue_invoices:   ['Show Square payment history', 'Compare expected vs received', 'Draft a follow-up email'],
  anomalies:          ['Which transaction is the anomaly?', 'Is this a duplicate charge?', 'Show similar past charges'],
  subscription_audit: ['List all recurring charges', 'Which can I cancel?', 'Total subscription spend?'],
  cash_flow_forecast: ['When will I hit my lowest balance?', "What's driving my burn rate?", 'How do I extend my runway?'],
  payment_timing:     ['When should I pay my vendors?', "What's my best payment timing?", 'Show upcoming obligations'],
  loan_readiness:     ["What's my loan readiness score?", 'What would improve my score?', 'Download my Cash Flow report'],
};

// ─── Severity dot ─────────────────────────────────────────────────────────

function SeverityDot({ severity }: { severity: string }) {
  const cls =
    severity === 'critical' ? 'bg-red-500 animate-pulse-glow' :
    severity === 'warning'  ? 'bg-amber-500' : 'bg-[#9B9B9B]';
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

// ─── Thinking dots ────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[#0D7C66] text-[10px] leading-none mt-2 shrink-0">✦</span>
      <div className="bg-[#F5F5F3] rounded-lg rounded-tl-sm px-3 py-2.5">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((d) => (
            <span
              key={d}
              className="h-1.5 w-1.5 rounded-full bg-[#9B9B9B] animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function InsightsPanel({
  recommendations,
  transactions,
  accounts,
  alerts,
  approved,
  dismissed,
  analyzeStatus,
  onApprove,
  onDismiss,
  onTakeAction,
}: InsightsPanelProps) {
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  // Per-rec chat history (keyed by rec.type), pre-seeded with AI analysis
  const [allMessages, setAllMessages] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Visible recs: not dismissed, not approved
  const visibleRecs = useMemo(
    () => recommendations.filter((r) => !dismissed.has(r.type) && !approved.has(r.type)),
    [recommendations, dismissed, approved],
  );

  const actionableCount = visibleRecs.filter((r) => r.severity !== 'info').length;
  const informationalCount = visibleRecs.filter((r) => r.severity === 'info').length;

  const displayedRecs = showAll ? visibleRecs : visibleRecs.slice(0, 4);
  const hiddenCount = visibleRecs.length - 4;

  // When a rec is selected, pre-seed the chat with its AI analysis if not already done
  useEffect(() => {
    if (!selectedRec) return;
    setAllMessages((prev) => {
      if (prev[selectedRec.type]) return prev; // already seeded
      return {
        ...prev,
        [selectedRec.type]: [{
          role: 'assistant',
          content: `${selectedRec.description}\n\n${selectedRec.reasoning}`,
        }],
      };
    });
  }, [selectedRec]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, isLoading]);

  useEffect(() => {
    if (selectedRec) inputRef.current?.focus();
  }, [selectedRec]);

  const currentMessages: ChatMessage[] = selectedRec ? (allMessages[selectedRec.type] ?? []) : [];

  const sendMessage = useCallback(async (messageText?: string) => {
    if (!selectedRec) return;
    const text = (messageText ?? input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const recType = selectedRec.type;

    setAllMessages((prev) => ({
      ...prev,
      [recType]: [...(prev[recType] ?? []), userMsg],
    }));
    setInput('');
    setIsLoading(true);

    try {
      const history = [...currentMessages, userMsg];
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[Regarding: ${selectedRec.title}] ${text}`,
          transactions,
          accounts,
          history: history.slice(-8),
          alerts: alerts.map((a) => ({ title: a.title, description: a.description, type: a.type })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setAllMessages((prev) => ({
        ...prev,
        [recType]: [...(prev[recType] ?? []), { role: 'assistant', content: data.reply }],
      }));
    } catch {
      setAllMessages((prev) => ({
        ...prev,
        [recType]: [...(prev[recType] ?? []), { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }],
      }));
    } finally {
      setIsLoading(false);
    }
  }, [selectedRec, input, isLoading, currentMessages, transactions, accounts, alerts]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // ── LIST VIEW ──────────────────────────────────────────────────────────

  const ListView = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-[#E8E8E6] shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[#0D7C66] text-sm font-bold leading-none">✦</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono">
            Insights
          </span>
        </div>
        {analyzeStatus === 'loading' ? (
          <p className="flex items-center gap-1.5 text-[10px] text-[#9B9B9B]">
            <svg className="h-3 w-3 animate-spin text-[#0D7C66]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Analysing your data…
          </p>
        ) : visibleRecs.length > 0 ? (
          <p className="text-[10px] text-[#9B9B9B]">
            <span className="text-[#1A1A1A] font-medium">{actionableCount} actionable</span>
            {' · '}
            {informationalCount} informational
          </p>
        ) : (
          <p className="text-[10px] text-[#9B9B9B]">No active insights</p>
        )}
      </div>

      {/* Rec list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
        {visibleRecs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 pt-12 px-5 text-center">
            <span className="text-2xl">✓</span>
            <p className="text-sm text-[#6B6B6B]">All clear — no active insights.</p>
          </div>
        ) : (
          <>
            {displayedRecs.map((rec) => (
              <button
                key={rec.type}
                onClick={() => setSelectedRec(rec)}
                className="w-full text-left px-5 py-3.5 border-b border-[#F5F5F3] hover:bg-[#FAFAF8] transition-colors group"
              >
                <div className="flex items-start gap-2.5">
                  <SeverityDot severity={rec.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-wider text-[#9B9B9B] mb-0.5">
                      {typeLabels[rec.type]}
                    </div>
                    <div className="text-sm font-medium text-[#1A1A1A] leading-snug mb-1">
                      {rec.title}
                    </div>
                    <p className="text-xs text-[#9B9B9B] leading-relaxed line-clamp-2">
                      {rec.description}
                    </p>
                  </div>
                  <svg
                    className="h-3.5 w-3.5 text-[#9B9B9B] shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </button>
            ))}

            {!showAll && hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full px-5 py-3 text-xs text-[#9B9B9B] hover:text-[#6B6B6B] transition-colors text-center"
              >
                Show {hiddenCount} more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── DETAIL VIEW ────────────────────────────────────────────────────────

  const DetailView = selectedRec && (
    <div className="flex flex-col h-full">
      {/* Back nav */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#E8E8E6] shrink-0">
        <button
          onClick={() => setSelectedRec(null)}
          className="flex items-center gap-1.5 text-xs text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          All Insights
        </button>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            selectedRec.severity !== 'info'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-[#F5F5F3] text-[#6B6B6B]'
          }`}
        >
          {selectedRec.severity !== 'info' ? 'Actionable' : 'Informational'}
        </span>
      </div>

      {/* Meta + title */}
      <div className="px-5 pt-4 pb-4 border-b border-[#E8E8E6] shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <SeverityDot severity={selectedRec.severity} />
          <span className="text-[10px] uppercase tracking-wider text-[#9B9B9B]">
            {typeLabels[selectedRec.type]}
          </span>
        </div>
        <h2 className="text-sm font-semibold text-[#1A1A1A] leading-snug mb-4">
          {selectedRec.title}
        </h2>

        {/* CTAs */}
        <div className="flex gap-2">
          <button
            onClick={() => onTakeAction(selectedRec)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#0D7C66] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0A6B58]"
          >
            <span className="text-xs leading-none">✦</span> Take Action
          </button>
          <button
            onClick={() => { onApprove(selectedRec.type); setSelectedRec(null); }}
            className="flex-1 rounded-lg border border-[#2D8A56]/20 bg-[#2D8A56]/10 px-3 py-2 text-xs font-medium text-[#2D8A56] transition-colors hover:bg-[#2D8A56]/20"
          >
            Mark as Done
          </button>
          <button
            onClick={() => { onDismiss(selectedRec.type); setSelectedRec(null); }}
            className="rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-2 text-xs font-medium text-[#9B9B9B] transition-colors hover:bg-[#F0F0EE] hover:text-[#6B6B6B]"
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-4 space-y-3">
        {currentMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-start gap-2'}`}
          >
            {msg.role === 'assistant' && (
              <span className="text-[#0D7C66] text-[10px] leading-none mt-2.5 shrink-0">✦</span>
            )}
            <div
              className={`max-w-[90%] text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#E8F5F0] border border-[#0D7C66]/20 rounded-lg rounded-tr-sm px-3 py-2.5 text-[#1A1A1A]'
                  : 'bg-[#F5F5F3] rounded-lg rounded-tl-sm px-3 py-2.5 text-[#1A1A1A]'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {isLoading && <ThinkingDots />}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts (only if ≤ 1 message — i.e. only the pre-seeded one) */}
      {currentMessages.length <= 1 && !isLoading && (
        <div className="px-5 pb-3 flex flex-col gap-1.5 shrink-0">
          {PROMPTS[selectedRec.type].map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="flex items-center gap-2 rounded-full border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-2 text-left text-xs text-[#6B6B6B] hover:bg-[#F0F0EE] hover:text-[#1A1A1A] transition-colors"
            >
              <span className="text-[#0D7C66] text-[10px] shrink-0">✦</span>
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-[#E8E8E6] px-4 py-3">
        <div className="focus-glow flex items-end gap-2 rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-2.5 transition-colors focus-within:border-[#0D7C66]/40">
          <span className="text-[#0D7C66] text-[10px] mb-0.5 shrink-0 leading-none">✦</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs text-[#1A1A1A] placeholder-[#9B9B9B] outline-none"
            style={{ maxHeight: '80px' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 80)}px`;
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0D7C66] text-white transition-colors hover:bg-[#0A6B58] disabled:opacity-40"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-[#9B9B9B]">
          GPT-4o · your transaction data
        </p>
      </div>
    </div>
  );

  return selectedRec ? DetailView : ListView;
}
