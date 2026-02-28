'use client';

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Transaction } from '@/lib/types';
import { BudgetThreshold } from '@/lib/alerts';

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc', '#d946ef',
  '#ec4899', '#f43f5e', '#fb923c', '#facc15', '#34d399',
  '#22d3ee', '#60a5fa',
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
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
      if (tx.amount <= 0) continue; // only spending
      const cat = tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other';
      map[cat] = (map[cat] ?? 0) + tx.amount;
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total: Math.round(total), monthly: Math.round(total / 3) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [transactions]);

  const totalSpend = data.reduce((s, d) => s + d.total, 0);

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
    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Spending by Category</h2>
        <button
          onClick={() => setShowBudgets((v) => !v)}
          className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors ${
            showBudgets
              ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
              : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
          }`}
        >
          {showBudgets ? 'Hide Budgets' : 'Set Budgets'}
        </button>
      </div>
      <p className="mb-5 text-xs text-slate-500">Top categories over the last 90 days</p>

      <ResponsiveContainer width="100%" height={data.length * 36 + 10}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            type="number"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { name: string; total: number; monthly: number };
              const pct = totalSpend > 0 ? ((d.total / totalSpend) * 100).toFixed(1) : '0';
              const budget = budgetMap[d.name];
              return (
                <div className="rounded-lg border border-white/10 bg-slate-900 p-3 text-xs shadow-xl">
                  <div className="font-medium text-white">{d.name}</div>
                  <div className="mt-1 text-slate-400">{formatCurrency(d.total)} total ({pct}%)</div>
                  <div className="text-slate-400">{formatCurrency(d.monthly)}/mo avg</div>
                  {budget !== undefined && (
                    <div className={`mt-1 font-medium ${d.monthly > budget ? 'text-red-400' : 'text-emerald-400'}`}>
                      Budget: {formatCurrency(budget)}/mo {d.monthly > budget ? '— OVER' : '— OK'}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Budget management panel */}
      {showBudgets && (
        <div className="mt-4 rounded-lg border border-white/5 bg-black/20 p-4">
          <div className="mb-3 text-xs font-medium text-slate-300">Monthly Budget Limits</div>
          <div className="space-y-2">
            {data.map((d) => {
              const budget = budgetMap[d.name];
              const isOver = budget !== undefined && d.monthly > budget;
              const isEditing = editingCat === d.name;

              return (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-28 truncate text-slate-400">{d.name}</span>
                  <span className="text-slate-500">{formatCurrency(d.monthly)}/mo</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-slate-500">$</span>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetBudget(d.name)}
                        className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500/50"
                        placeholder="limit"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSetBudget(d.name)}
                        className="rounded bg-indigo-600/20 border border-indigo-500/30 px-2 py-1 text-[10px] text-indigo-400 hover:bg-indigo-600/30"
                      >
                        Set
                      </button>
                      <button
                        onClick={() => { setEditingCat(null); setEditValue(''); }}
                        className="rounded bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-slate-500 hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 ml-auto">
                      {budget !== undefined ? (
                        <>
                          <span className={`font-medium ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>
                            {formatCurrency(budget)}/mo
                          </span>
                          <button
                            onClick={() => { setEditingCat(d.name); setEditValue(String(budget)); }}
                            className="text-slate-500 hover:text-slate-300 px-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemoveBudget(d.name)}
                            className="text-slate-600 hover:text-red-400 px-1"
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setEditingCat(d.name); setEditValue(String(d.monthly)); }}
                          className="text-indigo-400 hover:text-indigo-300"
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

      <div className="mt-4 flex flex-wrap gap-2">
        {data.map((d, i) => {
          const pct = totalSpend > 0 ? ((d.total / totalSpend) * 100).toFixed(0) : '0';
          return (
            <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {d.name} ({pct}%)
            </div>
          );
        })}
      </div>
    </div>
  );
}
