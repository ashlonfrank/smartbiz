'use client';

import { useEffect, useState, useRef } from 'react';
import { ChevronRight, ChevronDown, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Transaction } from '@/lib/types';
import { ContextualQuestions } from './ContextualQuestions';

const CATEGORY_OPTIONS = [
  { value: 'All categories',      label: 'All categories' },
  { value: 'INCOME',              label: 'Income' },
  { value: 'FOOD_AND_DRINK',      label: 'Food & Drink' },
  { value: 'PAYROLL',             label: 'Payroll' },
  { value: 'RENT_AND_UTILITIES',  label: 'Rent & Utilities' },
  { value: 'GENERAL_SERVICES',    label: 'General Services' },
  { value: 'GENERAL_MERCHANDISE', label: 'General Merchandise' },
];

function CategoryDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 bg-[#F5F5F3] border border-[#E8E8E6] rounded-md py-1.5 pl-3 pr-2.5 text-xs text-[#1A1A1A] w-36 hover:bg-[#F0F0EE]"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[#9B9B9B] shrink-0" />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#E8E8E6] rounded-lg shadow-xl overflow-hidden z-50 py-1"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${value === opt.value ? 'text-[#0D7C66] bg-[#E8F5F0]' : 'text-[#1A1A1A] hover:bg-[#F5F5F3]'}`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
        <span className="text-sm text-[#9B9B9B]">Going through your transactions</span>
        <span className="flex gap-0.5 items-center">
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 rounded-full bg-[#9B9B9B] animate-pulse" style={{ animationDelay: '300ms' }} />
        </span>
      </div>
    </motion.div>
  );
}

type ChatMessage = { role: 'user' | 'ai'; text: string };

function getCategory(tx: Transaction): string {
  if (tx.amount < 0) return 'INCOME';
  return (tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'OTHER').toUpperCase().replace(/ /g, '_');
}

function getCategoryBadge(category: string) {
  switch (category) {
    case 'INCOME':             return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'FOOD_AND_DRINK':     return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'PAYROLL':            return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'RENT_AND_UTILITIES': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'GENERAL_SERVICES':   return 'bg-gray-100 text-gray-600 border-gray-200';
    default:                   return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function formatDisplayDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface TransactionListProps {
  transactions?: Transaction[];
  onAsk?: (question: string) => void;
  chatMessages?: ChatMessage[];
  expanded?: boolean;
}

export function TransactionList({ transactions = [], onAsk, chatMessages = [], expanded = false }: TransactionListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatMessages.length > 0) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const displayTxs = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((tx) => ({
      id: tx.transaction_id,
      date: formatDisplayDate(tx.date),
      merchant: tx.merchant_name ?? tx.name,
      uiAmount: tx.amount < 0 ? Math.abs(tx.amount) : -tx.amount, // positive = income in UI
      category: getCategory(tx),
    }));

  const filtered = displayTxs.filter((tx) => {
    const matchSearch = tx.merchant.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter === 'All categories' || tx.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const suggestedQuestions = ['Break down my COGS for this month', 'Show all recurring vendor payments'];
  const asked = chatMessages.filter((m) => m.role === 'user').map((m) => m.text);
  const remaining = suggestedQuestions.filter((q) => !asked.includes(q));
  const lastDate = transactions.length ? formatDisplayDate(transactions.slice().sort((a, b) => b.date.localeCompare(a.date))[0].date) : '—';

  const table = (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#9B9B9B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text" placeholder="Search merchant..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F5F5F3] border border-[#E8E8E6] rounded-md py-1.5 pl-8 pr-3 text-xs text-[#1A1A1A] placeholder:text-[#9B9B9B] focus:outline-none focus:border-[#0D7C66]/50 transition-colors"
          />
        </div>
        <CategoryDropdown value={categoryFilter} onChange={setCategoryFilter} />
      </div>

      <div className="flex items-center justify-between py-2 border-b border-[#E8E8E6] text-xs text-[#9B9B9B] mb-2 px-2">
        <div className="flex items-center gap-3 w-1/2"><span className="w-12">Date ↓</span><span>Merchant</span></div>
        <div className="flex items-center justify-between w-1/2"><span>Category</span><span>Amount</span></div>
      </div>

      <div className={`space-y-1 ${expanded ? 'flex-1 overflow-y-auto pr-2 scrollbar-hide' : 'max-h-[400px] overflow-y-auto pr-2 scrollbar-hide'}`}>
        {filtered.map((tx, i) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.15 }}
            className="w-full flex items-center justify-between py-2.5 hover:bg-[#FAFAF8] transition-colors px-2 rounded"
          >
            <div className="flex items-center gap-3 w-1/2">
              <span className="text-xs text-[#9B9B9B] w-12 shrink-0">{tx.date}</span>
              <span className="text-sm text-[#1A1A1A] font-medium truncate">{tx.merchant}</span>
            </div>
            <div className="flex items-center justify-between w-1/2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getCategoryBadge(tx.category)}`}>{tx.category}</span>
              <span className={`text-sm font-medium text-right tabular-nums ${tx.uiAmount < 0 ? 'text-[#D94F4F]' : 'text-[#2D8A56]'}`}>
                {tx.uiAmount > 0 ? '+' : ''}{tx.uiAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </span>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && <div className="py-8 text-center text-sm text-[#9B9B9B]">No transactions match your filters.</div>}
      </div>
    </>
  );

  if (expanded) return <div className="h-full flex flex-col">{table}</div>;

  return (
    <section>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-3 px-4 -mx-4 rounded-lg hover:bg-[#F0F0EE] transition-all active:opacity-80 group"
      >
        <div className="flex items-center gap-3">
          <ChevronRight className={`w-4 h-4 text-[#9B9B9B] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
          <h2 className="text-sm uppercase tracking-widest text-[#9B9B9B] font-semibold font-mono">Transactions</h2>
          <span className="text-xs text-[#9B9B9B]">·</span>
          <span className="text-xs text-[#9B9B9B]">{transactions.length} transactions</span>
          <span className="text-xs text-[#9B9B9B]">·</span>
          <span className="text-xs text-[#9B9B9B]">Last: {lastDate}</span>
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
              {table}
              <div className="mt-4 pt-4 border-t border-[#E8E8E6]">
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
                      type="text" placeholder="Ask about transactions..."
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

export default TransactionList;
