'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Transaction, Account, BusinessProfile } from '@/lib/types';

// ─── types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GrowthChartModalProps {
  growthProjectionData: { month: string; historical?: number; projected?: number }[];
  growthPrompts: string[];
  transactions: Transaction[];
  accounts: Account[];
  businessProfile: BusinessProfile | null;
  initialPrompt?: string;
  onClose: () => void;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

// ─── chart tooltip ────────────────────────────────────────────────────────────

function GrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload.find((p) => p.value != null);
  if (!entry) return null;
  return (
    <div className="rounded-lg border border-[#E8E8E6] bg-white px-4 py-3 text-xs shadow-xl">
      <div className="mb-1 font-semibold text-[#1A1A1A]">{label}</div>
      <div className="text-[#6B6B6B]">
        Revenue: <span className="font-bold text-[#1A1A1A]">{formatCurrency(entry.value)}</span>
      </div>
    </div>
  );
}

// ─── thinking dots ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-[#F5F5F3] px-3.5 py-2.5 w-fit">
      <span className="text-[10px] text-[#9B9B9B]">✦</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[#9B9B9B] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function GrowthChartModal({
  growthProjectionData,
  growthPrompts,
  transactions,
  accounts,
  businessProfile,
  initialPrompt,
  onClose,
}: GrowthChartModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentInitialRef = useRef(false);

  const nowLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const userMsg = text.trim();
      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
      setIsLoading(true);
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `[About the growth projection] ${userMsg}`,
            transactions,
            accounts,
            history: messages.slice(-8),
            businessProfile,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed');
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Something went wrong. Please try again.' },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, transactions, accounts, businessProfile],
  );

  // Auto-send initialPrompt once on mount
  useEffect(() => {
    if (initialPrompt && !sentInitialRef.current) {
      sentInitialRef.current = true;
      sendMessage(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/40 backdrop-blur-sm">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-[#E8E8E6] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#E8E8E6] shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-sm font-semibold text-[#1A1A1A] uppercase tracking-widest font-mono">
                Growth Projection
              </h2>
              <div className="flex items-center gap-3 text-[10px] text-[#9B9B9B]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-px w-4 bg-[#0D7C66]" />
                  Historical
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-px w-4 border-t border-dashed border-[#6BB5A5]" />
                  Projected
                </span>
              </div>
            </div>
            <p className="text-xs text-[#9B9B9B]">24-month revenue trajectory · based on your current trend</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[#9B9B9B] transition-colors hover:bg-[#F5F5F3] hover:text-[#1A1A1A]"
            title="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Chart ───────────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4 shrink-0">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={growthProjectionData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="gmGradHistorical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0D7C66" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0D7C66" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gmGradProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6BB5A5" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#6BB5A5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#9B9B9B', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={5}
              />
              <YAxis
                tick={{ fill: '#9B9B9B', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip content={<GrowthTooltip />} />
              <ReferenceLine
                x={nowLabel}
                stroke="rgba(0,0,0,0.15)"
                strokeDasharray="4 4"
                label={{ value: 'Now', fill: '#9B9B9B', fontSize: 10, position: 'insideTopRight' }}
              />
              <Area
                type="monotone"
                dataKey="historical"
                stroke="#0D7C66"
                strokeWidth={2}
                fill="url(#gmGradHistorical)"
                dot={false}
                activeDot={{ r: 4, fill: '#0D7C66' }}
                connectNulls
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="projected"
                stroke="#6BB5A5"
                strokeWidth={2}
                strokeDasharray="5 4"
                fill="url(#gmGradProjected)"
                dot={false}
                activeDot={{ r: 4, fill: '#6BB5A5' }}
                connectNulls
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Divider ──────────────────────────────────────────────────── */}
        <div className="border-t border-[#E8E8E6] shrink-0" />

        {/* ── Chat area ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0 scrollbar-hide">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-xs text-[#9B9B9B]">Ask a question about your growth trajectory</p>
              <div className="flex flex-wrap gap-2">
                {growthPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="flex items-center gap-1.5 rounded-full border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-1.5 text-xs text-[#6B6B6B] hover:bg-[#EBEBEA] transition-colors"
                  >
                    <span className="text-[#0D7C66] text-[10px]">✦</span>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <span className="mr-2 mt-2.5 shrink-0 text-[10px] text-[#0D7C66]">✦</span>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#1A1A1A] text-white rounded-br-sm'
                    : 'bg-[#F5F5F3] text-[#1A1A1A] rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-2">
              <span className="mt-2.5 shrink-0 text-[10px] text-[#0D7C66]">✦</span>
              <ThinkingDots />
            </div>
          )}

          {/* Follow-up prompt pills (shown after first reply) */}
          {messages.length >= 2 && !isLoading && (
            <div className="flex flex-wrap gap-2 pt-1">
              {growthPrompts
                .filter((p) => !messages.some((m) => m.role === 'user' && m.content.includes(p.substring(0, 20))))
                .slice(0, 2)
                .map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="flex items-center gap-1.5 rounded-full border border-[#E8E8E6] bg-white px-3 py-1 text-[10px] text-[#6B6B6B] hover:bg-[#F5F5F3] transition-colors shadow-sm"
                  >
                    <span className="text-[#0D7C66]">✦</span>
                    {prompt}
                  </button>
                ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input bar ───────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-[#E8E8E6] px-4 py-3">
          <div className="flex items-end gap-2 rounded-xl border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-2 focus-within:border-[#0D7C66]/40 transition-colors">
            <span className="mb-1 shrink-0 text-[10px] text-[#0D7C66]">✦</span>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up…"
              rows={1}
              className="flex-1 resize-none bg-transparent text-xs text-[#1A1A1A] placeholder-[#9B9B9B] outline-none leading-relaxed"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="mb-0.5 shrink-0 rounded-lg bg-[#0D7C66] p-1.5 text-white transition-colors hover:bg-[#0A6B58] disabled:opacity-30"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-[#C4C4C2]">
            Shift + Enter for new line · Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}
