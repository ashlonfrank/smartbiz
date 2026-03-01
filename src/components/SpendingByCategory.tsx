'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Transaction } from '@/lib/types';
import { ContextualQuestions } from './ContextualQuestions';

type ChatMessage = { role: 'user' | 'ai'; text: string };

const CATEGORY_COLORS: Record<string, string> = {
  FOOD_AND_DRINK:      'bg-[#0D7C66]',
  PAYROLL:             'bg-[#4A7FC1]',
  RENT_AND_UTILITIES:  'bg-[#D97706]',
  GENERAL_SERVICES:    'bg-[#9B9B9B]',
  GENERAL_MERCHANDISE: 'bg-[#E8917A]',
  INSURANCE:           'bg-[#8B7EC8]',
  OTHER:               'bg-[#C0B9A8]',
};

function normalizeCategory(raw: string): string {
  return raw.toUpperCase().replace(/ /g, '_');
}

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex items-start gap-3 p-3 rounded-lg bg-[#F5F5F3]"
    >
      <span className="text-[#0D7C66] text-sm mt-0.5 shrink-0 animate-shimmer">✦</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-[#9B9B9B]">Reviewing your spending patterns</span>
        <span className="flex gap-0.5 items-center">
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '300ms' }} />
        </span>
      </div>
    </motion.div>
  );
}

interface SpendingByCategoryProps {
  transactions?: Transaction[];
  onAsk?: (question: string) => void;
  chatMessages?: ChatMessage[];
  expanded?: boolean;
}

export function SpendingByCategory({ transactions = [], onAsk, chatMessages = [], expanded = false }: SpendingByCategoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBudgets, setShowBudgets] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatMessages.length > 0) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const spendingData = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.amount <= 0) continue; // skip income (Plaid: positive = expense)
      const cat = normalizeCategory(tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'OTHER');
      totals[cat] = (totals[cat] ?? 0) + tx.amount;
    }
    const total = Object.values(totals).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat, amount]) => ({
        id: cat,
        label: cat,
        amount,
        percent: Math.round((amount / total) * 100),
        color: CATEGORY_COLORS[cat] ?? 'bg-[#C0B9A8]',
      }));
  }, [transactions]);

  const maxAmount = spendingData[0]?.amount || 1;

  const suggestedQuestions = ['Which category grew most?', 'Am I over budget anywhere?'];
  const asked = chatMessages.filter((m) => m.role === 'user').map((m) => m.text);
  const remaining = suggestedQuestions.filter((q) => !asked.includes(q));

  const chartContent = (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-[#6B6B6B]">Top categories over the last 90 days</p>
        <button
          onClick={(e) => { e.stopPropagation(); setShowBudgets(!showBudgets); }}
          className="px-3 py-1.5 text-xs font-medium text-[#1A1A1A] bg-[#F5F5F3] hover:bg-[#F0F0EE] border border-[#E8E8E6] rounded-md transition-colors"
        >
          {showBudgets ? 'Hide Budgets' : 'Set Budgets'}
        </button>
      </div>

      <div className="space-y-4 mb-6">
        {spendingData.map((item) => (
          <div key={item.id} className="flex items-center gap-4">
            <div className="w-36 shrink-0 text-right">
              <span className="text-xs text-[#6B6B6B]">{item.label}</span>
            </div>
            <div className="flex-1 h-6 bg-[#F5F5F3] rounded-r-sm overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(item.amount / maxAmount) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full ${item.color}`}
              />
            </div>
            <span className="text-xs text-[#6B6B6B] w-16 text-right tabular-nums">
              ${(item.amount / 1000).toFixed(1)}k
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2 pl-40">
        {spendingData.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-[10px] text-[#6B6B6B]">{item.label} ({item.percent}%)</span>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showBudgets && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#F5F5F3] border border-[#E8E8E6] rounded-lg p-4 mt-4">
              <h3 className="text-sm font-medium text-[#1A1A1A] mb-3">Monthly Spending (avg)</h3>
              <div className="space-y-3">
                {spendingData.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div className="w-40 text-xs text-[#6B6B6B]">{item.label}</div>
                    <div className="text-xs text-[#9B9B9B]">${(item.amount / 3).toFixed(0)}/mo</div>
                    <div className="text-xs text-[#D94F4F] font-medium">${((item.amount / 3) * 0.8).toFixed(0)}/mo limit</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (expanded) return <div className="h-full flex flex-col">{chartContent}</div>;

  return (
    <section>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-3 px-4 -mx-4 rounded-lg hover:bg-[#F0F0EE] transition-all active:opacity-80 group"
      >
        <div className="flex items-center gap-3">
          <ChevronRight className={`w-4 h-4 text-[#9B9B9B] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
          <h2 className="text-sm uppercase tracking-widest text-[#9B9B9B] font-semibold font-mono">Spending by Category</h2>
          <span className="text-xs text-[#9B9B9B]">·</span>
          <span className="text-xs text-[#9B9B9B]">{spendingData.length} categories</span>
          <span className="text-xs text-[#9B9B9B]">·</span>
          <span className="text-xs text-[#9B9B9B]">90 days</span>
          {chatMessages.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#0D7C66] shrink-0" />}
        </div>
        <span className="text-[10px] text-[#9B9B9B]">{isExpanded ? 'Close' : 'Show'}</span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }} className="overflow-hidden"
          >
            <div className="bg-white border border-[#E8E8E6] rounded-xl p-4 md:p-6 mt-2 shadow-sm">
              {chartContent}

              <div className="pt-4 border-t border-[#E8E8E6] mt-4">
                {chatMessages.length > 0 && (
                  <div className="space-y-3 mb-4 max-h-[250px] overflow-y-auto scrollbar-hide">
                    {chatMessages.map((msg, idx) =>
                      msg.role === 'user' ? (
                        <motion.div key={idx} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="flex justify-end">
                          <div className="bg-[#E8F5F0] border border-[#0D7C66]/20 rounded-lg rounded-tr-sm p-3 max-w-[80%]">
                            <p className="text-sm text-[#1A1A1A]">{msg.text}</p>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="flex items-start gap-3 p-3 rounded-lg bg-[#F5F5F3]">
                          <span className="text-[#0D7C66] text-sm mt-0.5 shrink-0">✦</span>
                          <p className="text-sm text-[#1A1A1A] leading-relaxed">{msg.text}</p>
                        </motion.div>
                      )
                    )}
                    <AnimatePresence>
                      {chatMessages[chatMessages.length - 1]?.role === 'user' && <ThinkingIndicator />}
                    </AnimatePresence>
                    <div ref={chatEndRef} />
                  </div>
                )}
                {onAsk && remaining.length > 0 && <ContextualQuestions questions={remaining} onAsk={onAsk} />}
                {onAsk && (
                  <div className="mt-3 flex items-center gap-2 bg-[#F5F5F3] rounded-lg px-3 py-2.5 border border-[#E8E8E6] focus-within:border-[#0D7C66]/50 transition-colors">
                    <span className="text-[#0D7C66] text-xs shrink-0">✦</span>
                    <input
                      type="text" placeholder="Ask about spending..."
                      className="w-full bg-transparent text-xs text-[#1A1A1A] placeholder:text-[#9B9B9B] focus:outline-none"
                      onKeyDown={(e) => {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (e.key === 'Enter' && val) { onAsk(val); (e.target as HTMLInputElement).value = ''; }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default SpendingByCategory;
