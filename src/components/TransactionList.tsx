'use client';

import { useState, useMemo } from 'react';
import { Transaction } from '@/lib/types';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

interface TransactionListProps {
  transactions: Transaction[];
}

type SortKey = 'date' | 'amount' | 'name';
type SortDir = 'asc' | 'desc';

export default function TransactionList({ transactions }: TransactionListProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const perPage = 20;

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const tx of transactions) {
      cats.add(tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other');
    }
    return Array.from(cats).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    let list = transactions;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (tx) =>
          (tx.merchant_name ?? tx.name).toLowerCase().includes(q) ||
          tx.date.includes(q),
      );
    }

    if (categoryFilter !== 'all') {
      list = list.filter(
        (tx) => (tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other') === categoryFilter,
      );
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortKey === 'amount') cmp = Math.abs(a.amount) - Math.abs(b.amount);
      else cmp = (a.merchant_name ?? a.name).localeCompare(b.merchant_name ?? b.name);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [transactions, search, sortKey, sortDir, categoryFilter]);

  const pageCount = Math.ceil(filtered.length / perPage);
  const pageData = filtered.slice(page * perPage, (page + 1) * perPage);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'desc' ? ' \u2193' : ' \u2191';
  };

  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Transactions</h2>
          <p className="mt-0.5 text-xs text-slate-500">{filtered.length} transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search merchant..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 w-44"
          />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500/50"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5 text-left text-slate-500">
              <th className="cursor-pointer px-3 py-2 font-medium hover:text-slate-300" onClick={() => toggleSort('date')}>
                Date{sortIcon('date')}
              </th>
              <th className="cursor-pointer px-3 py-2 font-medium hover:text-slate-300" onClick={() => toggleSort('name')}>
                Merchant{sortIcon('name')}
              </th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="cursor-pointer px-3 py-2 text-right font-medium hover:text-slate-300" onClick={() => toggleSort('amount')}>
                Amount{sortIcon('amount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((tx) => (
              <tr key={tx.transaction_id} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                <td className="px-3 py-2.5 text-slate-400 tabular-nums">
                  {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td className="px-3 py-2.5 text-white">
                  {tx.merchant_name ?? tx.name}
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                    {tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other'}
                  </span>
                </td>
                <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${tx.amount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {tx.amount > 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {page + 1} of {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
