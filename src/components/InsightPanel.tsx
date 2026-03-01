'use client';

import { useEffect, useState, useRef } from 'react';
import { ChevronRight, ChevronDown, Clock, ArrowLeft, CheckCircle2, Copy, X, Pencil, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Recommendation, Transaction, Account } from '@/lib/types';

export type ChatContext = { section: string; question: string } | null;
export type ChatMessage = { role: 'user' | 'ai'; text: string; isSeeded?: boolean };
export type ChatHistories = Record<string, ChatMessage[]>;

// ── severity / type helpers ──────────────────────────────────────────────────

const SEVERITY_STYLES = {
  critical: { dot: 'bg-[#D94F4F]', badge: 'bg-red-50 text-red-700 border border-red-200',   label: 'CRITICAL' },
  warning:  { dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border border-amber-200', label: 'WARNING' },
  info:     { dot: 'bg-[#0D7C66]',  badge: 'bg-[#E8F5F0] text-[#0D7C66] border border-[#0D7C66]/20', label: 'INFO' },
};

const TYPE_CATEGORIES: Record<string, string> = {
  cash_flow_forecast: 'Cash Flow',
  overdue_invoices:   'Overdue Invoices',
  anomalies:          'Anomaly Detection',
  subscription_audit: 'Subscriptions',
  payment_timing:     'Payment Timing',
  loan_readiness:     'Loan Readiness',
};

// ── thinking indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex items-start gap-3 p-3 rounded-lg bg-[#F5F5F3] max-w-[85%]"
    >
      <span className="text-[#0D7C66] text-sm mt-0.5 shrink-0 animate-shimmer">✦</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-[#9B9B9B]">Reviewing your financials</span>
        <span className="flex gap-0.5 items-center">
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '300ms' }} />
        </span>
      </div>
    </motion.div>
  );
}

// ── insight card ─────────────────────────────────────────────────────────────

function InsightCard({
  rec,
  onAskAI,
  onDismiss,
  onApprove,
  isDone,
}: {
  rec: Recommendation;
  onAskAI: (rec: Recommendation) => void;
  onDismiss: (type: string) => void;
  onApprove: (type: string) => void;
  isDone: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const styles = SEVERITY_STYLES[rec.severity];

  return (
    <div className="group relative bg-white border border-[#E8E8E6] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Dismiss X */}
      <button
        onClick={() => onDismiss(rec.type)}
        className="absolute top-3 right-3 p-1 rounded-md text-[#9B9B9B] opacity-0 group-hover:opacity-100 hover:bg-[#F5F5F3] hover:text-[#1A1A1A] transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${styles.dot} ${isDone ? 'bg-[#0D7C66]' : ''}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDone ? 'bg-[#E8F5F0] text-[#0D7C66] border border-[#0D7C66]/20' : styles.badge}`}>
              {isDone ? '✓ DONE' : styles.label}
            </span>
            <span className="text-[10px] text-[#9B9B9B]">{TYPE_CATEGORIES[rec.type] ?? rec.type}</span>
          </div>
          <h3 className="text-sm font-semibold text-[#1A1A1A] leading-snug">{rec.title}</h3>
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-[#6B6B6B]">{rec.description}</p>

      {/* Expandable reasoning */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex items-center gap-1 text-[10px] text-[#9B9B9B] hover:text-[#6B6B6B] transition-colors"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        {expanded ? 'Hide' : 'Show'} reasoning
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden"
          >
            <div className="mt-2 rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] p-3 text-xs leading-relaxed text-[#6B6B6B]">
              <span className="font-medium text-[#1A1A1A]">Reasoning: </span>{rec.reasoning}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] p-3 text-xs text-[#6B6B6B]">
        <span className="font-medium text-[#1A1A1A]">Suggested: </span>{rec.suggested_action}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onAskAI(rec)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#E8F5F0] border border-[#0D7C66]/20 py-1.5 text-xs font-medium text-[#0D7C66] hover:bg-[#D4EDE7] transition-colors"
        >
          <span>✦</span> Ask AI
        </button>
        <button
          onClick={() => onApprove(rec.type)}
          className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${isDone ? 'bg-[#E8F5F0] border-[#0D7C66]/20 text-[#0D7C66]' : 'bg-[#F5F5F3] border-[#E8E8E6] text-[#6B6B6B] hover:bg-[#F0F0EE]'}`}
        >
          {isDone ? '✓ Done' : 'Mark Done'}
        </button>
      </div>
    </div>
  );
}

// ── main InsightPanel ─────────────────────────────────────────────────────────

interface InsightPanelProps {
  recommendations?: Recommendation[];
  analyzeStatus?: 'idle' | 'loading' | 'done' | 'error';
  activeChat: ChatContext;
  onCloseChat: () => void;
  onOpenChat: (ctx: { section: string; question: string }) => void;
  chatHistories: ChatHistories;
  onUpdateHistory: (section: string, messages: ChatMessage[]) => void;
  onOpenReport: () => void;
  transactions?: Transaction[];
  accounts?: Account[];
  dismissed?: Set<string>;
  approved?: Set<string>;
  onDismiss?: (type: string) => void;
  onApprove?: (type: string) => void;
}

export function InsightPanel({
  recommendations = [],
  analyzeStatus = 'idle',
  activeChat,
  onCloseChat,
  onOpenChat,
  chatHistories,
  onUpdateHistory,
  onOpenReport,
  transactions = [],
  accounts = [],
  dismissed = new Set(),
  approved = new Set(),
  onDismiss,
  onApprove,
}: InsightPanelProps) {
  const [inputVal, setInputVal] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentMessages: ChatMessage[] = activeChat ? (chatHistories[activeChat.section] ?? []) : [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length]);

  const callChat = async (section: string, question: string) => {
    const existing = chatHistories[section] ?? [];
    const withUser: ChatMessage[] = [...existing, { role: 'user', text: question }];
    onUpdateHistory(section, withUser);

    setIsStreaming(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          transactions: transactions.slice(0, 50),
          accounts,
          history: existing.slice(-10).map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        }),
      });
      const data = await res.json();
      const reply = data.reply ?? data.message ?? 'Sorry, I couldn\'t generate a response.';
      onUpdateHistory(section, [...withUser, { role: 'ai', text: reply }]);
    } catch {
      onUpdateHistory(section, [...withUser, { role: 'ai', text: 'Something went wrong. Please try again.' }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleAskAI = (rec: Recommendation) => {
    const section = `insight_${rec.type}`;
    const question = `Tell me more about: ${rec.title}. ${rec.description} What specific details can you see in my transaction data?`;
    onOpenChat({ section, question });
    callChat(section, question);
  };

  const handleSend = () => {
    const val = inputVal.trim();
    if (!val || !activeChat || isStreaming) return;
    setInputVal('');
    callChat(activeChat.section, val);
  };

  const visibleRecs = recommendations.filter((r) => !dismissed.has(r.type));

  return (
    <div className="h-full flex flex-col">
      <AnimatePresence mode="wait">
        {activeChat ? (
          /* ── Chat View ──────────────────────────────────────────────── */
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center gap-3 mb-6">
              <button onClick={onCloseChat} className="p-1.5 rounded-lg hover:bg-[#F0F0EE] transition-colors text-[#9B9B9B] hover:text-[#1A1A1A]">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <p className="text-xs font-semibold text-[#1A1A1A] uppercase tracking-widest font-mono">{activeChat.section}</p>
                <p className="text-[10px] text-[#9B9B9B] mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> AI Financial Advisor
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 pr-1 pb-4">
              {currentMessages.map((msg, idx) =>
                msg.role === 'user' ? (
                  <motion.div key={idx} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="flex justify-end">
                    <div className="bg-[#E8F5F0] border border-[#0D7C66]/20 rounded-xl rounded-tr-sm px-4 py-3 max-w-[85%]">
                      <p className="text-sm text-[#1A1A1A] leading-relaxed">{msg.text}</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F5F3] max-w-[90%]">
                    <span className="text-[#0D7C66] text-sm mt-0.5 shrink-0">✦</span>
                    <p className="text-sm text-[#1A1A1A] leading-relaxed">{msg.text}</p>
                  </motion.div>
                )
              )}
              <AnimatePresence>
                {isStreaming && currentMessages[currentMessages.length - 1]?.role === 'user' && <ThinkingIndicator />}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            <div className="pt-4 border-t border-[#E8E8E6]">
              <div className="flex items-center gap-2 bg-[#F5F5F3] rounded-xl px-3 py-2.5 border border-[#E8E8E6] focus-within:border-[#0D7C66]/50 transition-colors focus-glow">
                <span className="text-[#0D7C66] text-xs shrink-0">✦</span>
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="Ask a follow-up..."
                  className="w-full bg-transparent text-xs text-[#1A1A1A] placeholder:text-[#9B9B9B] focus:outline-none"
                  disabled={isStreaming}
                />
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── Insights List View ─────────────────────────────────────── */
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="mb-6">
              <span className="text-[10px] uppercase tracking-widest text-[#0D7C66]/70 font-semibold flex items-center gap-1.5 mb-1">
                <span>✦</span> AI Insights
              </span>
              <p className="text-xs text-[#9B9B9B]">
                {analyzeStatus === 'loading' && 'Analysing your transactions…'}
                {analyzeStatus === 'done' && `${visibleRecs.length} active recommendation${visibleRecs.length !== 1 ? 's' : ''}`}
                {analyzeStatus === 'idle' && 'Powered by GPT-4o'}
                {analyzeStatus === 'error' && 'Analysis failed — retry below'}
              </p>
            </div>

            {/* Loan Readiness CTA */}
            <button
              onClick={onOpenReport}
              className="w-full mb-4 flex items-center justify-between px-4 py-3 rounded-xl border border-[#0D7C66]/20 bg-[#E8F5F0] hover:bg-[#D4EDE7] transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="text-[#0D7C66] text-sm">✦</span>
                <div className="text-left">
                  <p className="text-xs font-semibold text-[#0D7C66]">Lending Readiness Report</p>
                  <p className="text-[10px] text-[#0D7C66]/70">View your full financial report</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#0D7C66] group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Recommendation cards */}
            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 pr-1">
              {analyzeStatus === 'loading' && (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-xl border border-[#E8E8E6] bg-[#F5F5F3]" />
                ))
              )}

              {analyzeStatus === 'done' && visibleRecs.map((rec) => (
                <InsightCard
                  key={rec.type}
                  rec={rec}
                  onAskAI={handleAskAI}
                  onDismiss={onDismiss ?? (() => {})}
                  onApprove={onApprove ?? (() => {})}
                  isDone={approved.has(rec.type)}
                />
              ))}

              {analyzeStatus === 'done' && visibleRecs.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[#0D7C66]/40" />
                  <p className="text-sm text-[#9B9B9B]">All insights addressed.</p>
                </div>
              )}

              {/* General chat prompt */}
              <button
                onClick={() => onOpenChat({ section: 'General', question: '' })}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E8E8E6] bg-white hover:bg-[#F5F5F3] transition-colors text-left mt-2"
              >
                <span className="text-[#0D7C66] text-sm shrink-0">✦</span>
                <div>
                  <p className="text-xs font-medium text-[#1A1A1A]">Ask about your finances</p>
                  <p className="text-[10px] text-[#9B9B9B]">Chat with your AI advisor</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#9B9B9B] ml-auto" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
