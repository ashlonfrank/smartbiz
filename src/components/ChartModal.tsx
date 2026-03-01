'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { DailyFlow, Transaction, Account } from '@/lib/types';

// ─── types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChartModalProps {
  chartData: DailyFlow[];
  transactions: Transaction[];
  accounts: Account[];
  initialPrompt?: string;
  safetyFloor: number;
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#E8E8E6] bg-white px-4 py-3 text-xs shadow-xl">
      <div className="mb-2 font-semibold text-[#1A1A1A]">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-[#6B6B6B]">
          <span className="capitalize">{p.name === 'cumulative' ? 'Balance' : 'Forecast'}:</span>
          <span className="font-bold text-[#1A1A1A]">{formatCurrency(p.value)}</span>
        </div>
      ))}
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

export default function ChartModal({
  chartData,
  transactions,
  accounts,
  initialPrompt,
  safetyFloor,
  onClose,
}: ChartModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentInitialRef = useRef(false);

  // Formatted chart data with nice date labels
  const chartDisplayData = useMemo(
    () => chartData.map((d) => ({ ...d, date: formatDate(d.date) })),
    [chartData],
  );

  // Today marker
  const todayDate = formatDate(new Date().toISOString().split('T')[0]);

  // Dynamic prompts computed from real data
  const chartPrompts = useMemo(() => {
    // Biggest dip day (most negative net)
    const historicalDips = chartData.filter((d) => !d.forecast && d.net < 0);
    historicalDips.sort((a, b) => a.net - b.net);
    const dipDate = historicalDips[0] ? formatDate(historicalDips[0].date) : 'recently';

    // Top expense merchant
    const spendTx = transactions.filter((t) => t.amount > 0);
    const merchantTotals: Record<string, number> = {};
    for (const tx of spendTx) {
      const key = tx.merchant_name ?? tx.name;
      merchantTotals[key] = (merchantTotals[key] ?? 0) + tx.amount;
    }
    const topMerchant =
      Object.entries(merchantTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'my top vendor';

    return [
      `Why did my balance dip on ${dipDate}?`,
      `Can I afford a bigger ${topMerchant} order next month?`,
      'Will I stay above my reserve next quarter?',
    ];
  }, [chartData, transactions]);

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
            message: `[About the cash flow chart] ${userMsg}`,
            transactions,
            accounts,
            history: messages.slice(-8),
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
    [isLoading, messages, transactions, accounts],
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

  const handlePromptClick = (prompt: string) => {
    sendMessage(prompt);
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
                Cash Flow Timeline
              </h2>
              <div className="flex items-center gap-3 text-[10px] text-[#9B9B9B]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded" style={{ backgroundColor: '#0D7C66', opacity: 0.7 }} />
                  Historical
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded border border-dashed" style={{ borderColor: '#6BB5A5' }} />
                  Forecast
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded border border-dashed" style={{ borderColor: '#D97706' }} />
                  Safety Floor
                </span>
              </div>
            </div>
            <p className="text-xs text-[#9B9B9B]">60-day history + 30-day projection · Balance vs Safety Floor</p>
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
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartDisplayData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="cmGradHistorical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0D7C66" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0D7C66" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cmGradForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6BB5A5" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#6BB5A5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9B9B9B', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={10}
              />
              <YAxis
                tick={{ fill: '#9B9B9B', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                }
              />
              <Tooltip content={<ChartTooltip />} />
              {/* Today marker */}
              <ReferenceLine
                x={todayDate}
                stroke="rgba(0,0,0,0.15)"
                strokeDasharray="4 4"
                label={{ value: 'Today', fill: '#9B9B9B', fontSize: 10, position: 'insideTopRight' }}
              />
              {/* Safety floor */}
              <ReferenceLine
                y={safetyFloor}
                stroke="#D97706"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{
                  value: `Reserve (${formatCurrency(safetyFloor)})`,
                  fill: '#D97706',
                  fontSize: 9,
                  position: 'insideTopRight',
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                name="cumulative"
                stroke="#0D7C66"
                strokeWidth={2}
                fill="url(#cmGradHistorical)"
                dot={false}
                activeDot={{ r: 4, fill: '#0D7C66' }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="forecast"
                name="forecast"
                stroke="#6BB5A5"
                strokeWidth={2}
                strokeDasharray="5 4"
                fill="url(#cmGradForecast)"
                dot={false}
                activeDot={{ r: 4, fill: '#6BB5A5' }}
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
              <p className="text-xs text-[#9B9B9B]">Ask a question about this chart</p>
              <div className="flex flex-wrap gap-2">
                {chartPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptClick(prompt)}
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
              {chartPrompts
                .filter((p) => !messages.some((m) => m.role === 'user' && m.content.includes(p.substring(0, 20))))
                .slice(0, 2)
                .map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptClick(prompt)}
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
