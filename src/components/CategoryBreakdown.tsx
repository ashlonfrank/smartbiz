'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Transaction } from '@/lib/types';
import { BudgetThreshold } from '@/lib/alerts';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// Light-mode category palette
const CATEGORY_COLORS: Record<string, string> = {
  FOOD_AND_DRINK:      '#0D7C66',
  PAYROLL:             '#4A7FC1',
  RENT_AND_UTILITIES:  '#D97706',
  GENERAL_SERVICES:    '#9B9B9B',
  INSURANCE:           '#8B7EC8',
  GENERAL_MERCHANDISE: '#E07B54',
  INCOME:              '#2D8A56',
};
const DEFAULT_COLOR = '#C4C4C2';

function getCategoryColor(name: string): string {
  return CATEGORY_COLORS[name] ?? DEFAULT_COLOR;
}

function humanize(cat: string) {
  return cat.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

interface CategoryBreakdownProps {
  transactions: Transaction[];
  budgets: BudgetThreshold[];
  onUpdateBudgets: (budgets: BudgetThreshold[]) => void;
}

export default function CategoryBreakdown({ transactions, budgets, onUpdateBudgets }: CategoryBreakdownProps) {
  const [showBudgets, setShowBudgets] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.amount <= 0) continue; // spending only
      const cat = tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other';
      map[cat] = (map[cat] ?? 0) + tx.amount;
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total: Math.round(total), monthly: Math.round(total / 3) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [transactions]);

  const totalSpend = data.reduce((s, d) => s + d.total, 0);
  const maxTotal = data[0]?.total ?? 1;

  const budgetMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of budgets) map[b.category] = b.limit;
    return map;
  }, [budgets]);

  const handleSetBudget = (category: string) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0) return;
    const existing = budgets.filter((b) => b.category !== category);
    onUpdateBudgets([...existing, { category, limit: Math.round(val) }]);
    setEditingCat(null);
    setEditValue('');
  };

  const handleRemoveBudget = (category: string) => {
    onUpdateBudgets(budgets.filter((b) => b.category !== category));
  };

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#E8E8E6] bg-white p-4 md:p-6 shadow-sm">

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs text-[#9B9B9B]">Top categories · 90 days</p>
        <button
          onClick={() => setShowBudgets((v) => !v)}
          className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-colors ${
            showBudgets
              ? 'border-[#0D7C66]/20 bg-[#E8F5F0] text-[#0D7C66]'
              : 'border-[#E8E8E6] bg-[#F5F5F3] text-[#6B6B6B] hover:bg-[#F0F0EE]'
          }`}
        >
          {showBudgets ? 'Hide Budgets' : 'Set Budgets'}
        </button>
      </div>

      {/* Horizontal bar rows */}
      <div className="space-y-4">
        {data.map((d, i) => {
          const pct = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0;
          const labelPct = totalSpend > 0 ? ((d.total / totalSpend) * 100).toFixed(0) : '0';
          const color = getCategoryColor(d.name);
          const budget = budgetMap[d.name];
          const isOver = budget !== undefined && d.monthly > budget;

          return (
            <div key={d.name}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs text-[#6B6B6B] truncate">{humanize(d.name)}</span>
                  {budget !== undefined && (
                    <span className={`text-[10px] font-medium shrink-0 ${isOver ? 'text-[#D94F4F]' : 'text-[#2D8A56]'}`}>
                      {isOver ? '↑ over' : '✓ ok'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-[#9B9B9B]">{labelPct}%</span>
                  <span className="text-xs font-semibold text-[#1A1A1A] tabular-nums w-20 text-right">
                    {formatCurrency(d.total)}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#F5F5F3]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.05 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Budget management panel */}
      {showBudgets && (
        <div className="mt-6 rounded-lg border border-[#E8E8E6] bg-[#F5F5F3] p-4">
          <div className="mb-3 text-xs font-medium text-[#1A1A1A]">Monthly Budget Limits</div>
          <div className="space-y-2.5">
            {data.map((d) => {
              const budget = budgetMap[d.name];
              const isOver = budget !== undefined && d.monthly > budget;
              const isEditing = editingCat === d.name;

              return (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-32 truncate text-[#6B6B6B]">{humanize(d.name)}</span>
                  <span className="text-[#9B9B9B] shrink-0">{formatCurrency(d.monthly)}/mo</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-[#9B9B9B]">$</span>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetBudget(d.name)}
                        className="w-20 rounded border border-[#E8E8E6] bg-white px-2 py-1 text-xs text-[#1A1A1A] outline-none focus:border-[#0D7C66]/50"
                        placeholder="limit"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSetBudget(d.name)}
                        className="rounded bg-[#E8F5F0] border border-[#0D7C66]/20 px-2 py-1 text-[10px] text-[#0D7C66] hover:bg-[#0D7C66]/15"
                      >
                        Set
                      </button>
                      <button
                        onClick={() => { setEditingCat(null); setEditValue(''); }}
                        className="rounded bg-white border border-[#E8E8E6] px-2 py-1 text-[10px] text-[#9B9B9B] hover:bg-[#F5F5F3]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 ml-auto">
                      {budget !== undefined ? (
                        <>
                          <span className={`font-medium ${isOver ? 'text-[#D94F4F]' : 'text-[#2D8A56]'}`}>
                            {formatCurrency(budget)}/mo
                          </span>
                          <button
                            onClick={() => { setEditingCat(d.name); setEditValue(String(budget)); }}
                            className="text-[#9B9B9B] hover:text-[#1A1A1A] px-1 text-[10px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemoveBudget(d.name)}
                            className="text-[#9B9B9B] hover:text-[#D94F4F] px-1 text-[10px]"
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setEditingCat(d.name); setEditValue(String(d.monthly)); }}
                          className="text-[#0D7C66] hover:text-[#0A6B58] text-[10px]"
                        >
                          + Set budget
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend dots */}
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5">
        {data.map((d) => {
          const pct = totalSpend > 0 ? ((d.total / totalSpend) * 100).toFixed(0) : '0';
          return (
            <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-[#9B9B9B]">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(d.name) }} />
              {humanize(d.name)} ({pct}%)
            </div>
          );
        })}
      </div>
    </div>
  );
}
