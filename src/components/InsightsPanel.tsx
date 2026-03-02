'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Recommendation, RecommendationType, Transaction, Account, BusinessProfile, InsightFeedback } from '@/lib/types';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
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
  businessProfile?: BusinessProfile | null;
  onApprove: (type: string) => void;
  onDismiss: (type: string) => void;
  onTakeAction: (rec: Recommendation) => void;
  externalPrompt?: string;
  onExternalPromptConsumed?: () => void;
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

// ─── Feedback row ─────────────────────────────────────────────────────────

function FeedbackRow({
  recType,
  current,
  onVote,
}: {
  recType: string;
  current?: InsightFeedback;
  onVote: (vote: 'up' | 'down', comment?: string) => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const [comment, setComment] = useState('');

  const handleVote = (vote: 'up' | 'down') => {
    onVote(vote);
    if (vote === 'down' && !current?.comment) {
      setShowInput(true);
    } else {
      setShowInput(false);
    }
  };

  const submitComment = () => {
    if (comment.trim()) {
      onVote('down', comment.trim());
    }
    setShowInput(false);
  };

  return (
    <div className="ml-5 mt-1 mb-1">
      <div className="flex items-center gap-2 text-[10px] text-[#9B9B9B]">
        <span>Was this helpful?</span>
        <button
          onClick={() => handleVote('up')}
          className={`p-1 rounded transition-colors ${
            current?.vote === 'up'
              ? 'text-[#0D7C66] bg-[#E8F5F0]'
              : 'hover:text-[#0D7C66] hover:bg-[#F5F5F3]'
          }`}
        >
          <ThumbsUp className="h-3 w-3" />
        </button>
        <button
          onClick={() => handleVote('down')}
          className={`p-1 rounded transition-colors ${
            current?.vote === 'down'
              ? 'text-[#D94F4F] bg-red-50'
              : 'hover:text-[#D94F4F] hover:bg-red-50'
          }`}
        >
          <ThumbsDown className="h-3 w-3" />
        </button>
        {current?.comment && (
          <span className="italic text-[#9B9B9B]">Thanks for your feedback</span>
        )}
      </div>
      {showInput && !current?.comment && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What would be more helpful?"
            className="flex-1 rounded border border-[#E8E8E6] bg-[#F5F5F3] px-2 py-1 text-[10px] text-[#1A1A1A] placeholder-[#9B9B9B] outline-none focus:border-[#0D7C66]/40"
            onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
          />
          <button
            onClick={submitComment}
            className="text-[10px] text-[#0D7C66] hover:underline"
          >
            Send
          </button>
        </div>
      )}
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
  businessProfile,
  onApprove,
  onDismiss,
  onTakeAction,
  externalPrompt,
  onExternalPromptConsumed,
}: InsightsPanelProps) {
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  // Per-rec chat history (keyed by rec.type), pre-seeded with AI analysis
  const [allMessages, setAllMessages] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Free-chat mode (for growth projection prompts)
  const [freeMessages, setFreeMessages] = useState<ChatMessage[]>([]);
  const [freeChatActive, setFreeChatActive] = useState(false);
  const [freeChatLoading, setFreeChatLoading] = useState(false);

  // ── Feedback state ──────────────────────────────────────────────
  const [feedback, setFeedback] = useState<Record<string, InsightFeedback>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('runwayai_feedback');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const saveFeedback = useCallback((next: Record<string, InsightFeedback>) => {
    setFeedback(next);
    localStorage.setItem('runwayai_feedback', JSON.stringify(next));
  }, []);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Free-chat (growth projection prompts) ────────────────────────
  const sendFreeMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || freeChatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    setFreeMessages((prev) => [...prev, userMsg]);
    setInput('');
    setFreeChatLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          transactions,
          accounts,
          history: freeMessages.slice(-8),
          alerts: alerts.map((a) => ({ title: a.title, description: a.description, type: a.type })),
          businessProfile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFreeMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setFreeMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally {
      setFreeChatLoading(false);
    }
  }, [freeMessages, freeChatLoading, transactions, accounts, alerts, businessProfile]);

  useEffect(() => {
    if (!externalPrompt) return;
    setFreeChatActive(true);
    setSelectedRec(null);
    setFreeMessages([]);
    sendFreeMessage(externalPrompt);
    onExternalPromptConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPrompt]);

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
          businessProfile,
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
        [recType]: [...(prev[recType] ?? []), { role: 'assistant', content: '__retry__' }],
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
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <SeverityDot severity={rec.severity} />
                      <span className="text-[10px] uppercase tracking-wider text-[#9B9B9B]">
                        {typeLabels[rec.type]}
                      </span>
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
      <div className="px-5 pt-4 pb-3 border-b border-[#E8E8E6] shrink-0">
        <button
          onClick={() => setSelectedRec(null)}
          className="flex items-center gap-1.5 text-xs text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          All Insights
        </button>
      </div>

      {/* Meta + title */}
      <div className="px-5 pt-4 pb-4 border-b border-[#E8E8E6] shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <SeverityDot severity={selectedRec.severity} />
          <span className="text-[10px] uppercase tracking-wider text-[#9B9B9B]">
            {typeLabels[selectedRec.type]}
          </span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            selectedRec.severity !== 'info'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-[#F5F5F3] text-[#6B6B6B]'
          }`}>
            {selectedRec.severity !== 'info' ? 'Actionable' : 'Informational'}
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
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#2D8A56]/20 bg-[#2D8A56]/10 px-3 py-2 text-xs font-medium text-[#2D8A56] transition-colors hover:bg-[#2D8A56]/20"
          >
            <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2,6 5,9 10,3" />
            </svg>
            Mark as Done
          </button>
          <button
            onClick={() => setSelectedRec(null)}
            className="px-3 py-2 text-xs font-medium text-[#9B9B9B] transition-colors hover:text-[#6B6B6B]"
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-4 space-y-3">
        {currentMessages.map((msg, i) => (
          <div key={i}>
            <div
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-start gap-2'}`}
            >
              {msg.role === 'assistant' && (
                <span className="text-[#0D7C66] text-[10px] leading-none mt-2.5 shrink-0">✦</span>
              )}
              {msg.content === '__retry__' ? (
                <div className="flex items-center gap-2 bg-[#F5F5F3] rounded-lg rounded-tl-sm px-3 py-2.5">
                  <span className="text-xs text-[#9B9B9B]">Something went wrong.</span>
                  <button
                    onClick={() => {
                      setAllMessages((prev) => ({
                        ...prev,
                        [msg.role === 'assistant' ? (selectedRec?.type ?? '') : '']: (prev[selectedRec?.type ?? ''] ?? []).filter((_, idx) => idx !== i),
                      }));
                      const lastUser = [...currentMessages].slice(0, i).reverse().find(m => m.role === 'user');
                      if (lastUser) sendMessage(lastUser.content);
                    }}
                    className="text-xs text-[#0D7C66] hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div
                  className={`max-w-[90%] text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#E8F5F0] border border-[#0D7C66]/20 rounded-lg rounded-tr-sm px-3 py-2.5 text-[#1A1A1A]'
                      : 'bg-[#F5F5F3] rounded-lg rounded-tl-sm px-3 py-2.5 text-[#1A1A1A]'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              )}
            </div>
            {/* Feedback row after the first assistant message */}
            {i === 0 && msg.role === 'assistant' && msg.content !== '__retry__' && (
              <FeedbackRow
                recType={selectedRec.type}
                current={feedback[selectedRec.type]}
                onVote={(vote, comment) => {
                  saveFeedback({
                    ...feedback,
                    [selectedRec.type]: { vote, comment, timestamp: Date.now() },
                  });
                }}
              />
            )}
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
        <div className="focus-glow flex items-end gap-2 rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-1.5 transition-colors focus-within:border-[#0D7C66]/40">
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
            className="shrink-0 text-[#0D7C66] transition-opacity disabled:opacity-30 pb-0.5"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-[#9B9B9B]">
          AI can make mistakes — verify before acting.
        </p>
      </div>
    </div>
  );

  // ── FREE CHAT VIEW ─────────────────────────────────────────────────────
  const FreeChatView = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-[#E8E8E6] shrink-0 flex items-center gap-3">
        <button
          onClick={() => { setFreeChatActive(false); setFreeMessages([]); }}
          className="text-[#9B9B9B] hover:text-[#1A1A1A] transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-xs font-semibold text-[#1A1A1A]">Ask RunwayAI</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-4 space-y-3">
        {freeMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-start gap-2'}`}>
            {msg.role === 'assistant' && (
              <span className="text-[#0D7C66] text-[10px] leading-none mt-2.5 shrink-0">✦</span>
            )}
            <div className={`max-w-[90%] text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[#E8F5F0] border border-[#0D7C66]/20 rounded-lg rounded-tr-sm px-3 py-2.5 text-[#1A1A1A]'
                : 'bg-[#F5F5F3] rounded-lg rounded-tl-sm px-3 py-2.5 text-[#1A1A1A]'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {freeChatLoading && <ThinkingDots />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#E8E8E6] px-4 py-3">
        <div className="focus-glow flex items-end gap-2 rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-1.5 transition-colors focus-within:border-[#0D7C66]/40">
          <span className="text-[#0D7C66] text-[10px] mb-0.5 shrink-0 leading-none">✦</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFreeMessage(input); } }}
            placeholder="Ask a follow-up…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs text-[#1A1A1A] placeholder-[#9B9B9B] outline-none"
            style={{ maxHeight: '80px' }}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 80)}px`; }}
          />
          <button
            onClick={() => sendFreeMessage(input)}
            disabled={!input.trim() || freeChatLoading}
            className="shrink-0 text-[#0D7C66] transition-opacity disabled:opacity-30 pb-0.5"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-[#9B9B9B]">AI can make mistakes — verify before acting.</p>
      </div>
    </div>
  );

  return freeChatActive ? FreeChatView : (selectedRec ? DetailView : ListView);
}
