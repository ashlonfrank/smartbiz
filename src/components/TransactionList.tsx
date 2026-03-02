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

const categoryStyles: Record<string, string> = {
  INCOME:              'bg-emerald-50 text-emerald-700 border-emerald-200',
  FOOD_AND_DRINK:      'bg-teal-50 text-teal-700 border-teal-200',
  PAYROLL:             'bg-amber-50 text-amber-700 border-amber-200',
  RENT_AND_UTILITIES:  'bg-purple-50 text-purple-700 border-purple-200',
  GENERAL_SERVICES:    'bg-gray-100 text-gray-600 border-gray-200',
  INSURANCE:           'bg-indigo-50 text-indigo-700 border-indigo-200',
  GENERAL_MERCHANDISE: 'bg-orange-50 text-orange-700 border-orange-200',
};
const defaultBadge = 'bg-[#F5F5F3] text-[#6B6B6B] border-[#E8E8E6]';

function humanizeCategory(cat: string) {
  return cat.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

const merchantLabels: Record<string, string> = {
  'ADP': 'Payroll',
  'Gusto': 'Payroll Software',
  'Square': 'POS Sales',
  'Toast': 'POS Sales',
  'UberEats': 'Delivery Revenue',
  'DoorDash': 'Delivery Revenue',
  'Sysco': 'Food & Supplies',
  'US Foods': 'Food & Supplies',
  'Restaurant Depot': 'Food & Supplies',
  'Costco': 'Bulk Supplies',
  'Oakwood Properties': 'Rent',
  'PG&E': 'Utilities',
  'City Water': 'Utilities',
  'QuickBooks': 'Accounting',
  'Yelp': 'Advertising',
  'OpenTable': 'Reservations',
  'StateFarm': 'Insurance',
  'Hobart Equipment': 'Equipment Lease',
  'Amazon Business': 'Supplies',
  'HD Supply': 'Cleaning Supplies',
  'Home Depot': 'Maintenance',
  'Catering Event': 'Catering Revenue',
};

function getDescription(tx: Transaction): string {
  const merchant = tx.merchant_name ?? tx.name;
  return merchantLabels[merchant]
    ?? humanizeCategory(tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other');
}

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
          getDescription(tx).toLowerCase().includes(q) ||
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

  const sortIcon = (key: SortKey) =>
    sortKey !== key ? '' : sortDir === 'desc' ? ' ↓' : ' ↑';

  return (
    <div className="rounded-xl border border-[#E8E8E6] bg-white p-4 md:p-6 shadow-sm">

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[#9B9B9B]">{filtered.length} transactions</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="rounded-md border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-1.5 text-xs text-[#1A1A1A] placeholder-[#9B9B9B] outline-none focus:border-[#0D7C66]/50 w-40"
          />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            className="rounded-md border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-1.5 text-xs text-[#6B6B6B] outline-none focus:border-[#0D7C66]/50"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{humanizeCategory(c)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#E8E8E6] text-left text-[#9B9B9B]">
              <th
                className="cursor-pointer px-3 py-2 font-medium hover:text-[#6B6B6B] transition-colors"
                onClick={() => toggleSort('date')}
              >
                Date{sortIcon('date')}
              </th>
              <th
                className="cursor-pointer px-3 py-2 font-medium hover:text-[#6B6B6B] transition-colors"
                onClick={() => toggleSort('name')}
              >
                Description{sortIcon('name')}
              </th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th
                className="cursor-pointer px-3 py-2 text-right font-medium hover:text-[#6B6B6B] transition-colors"
                onClick={() => toggleSort('amount')}
              >
                Amount{sortIcon('amount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((tx) => {
              const cat = tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other';
              const badgeStyle = categoryStyles[cat] ?? defaultBadge;
              return (
                <tr
                  key={tx.transaction_id}
                  className="border-b border-[#F5F5F3] hover:bg-[#FAFAF8] transition-colors"
                >
                  <td className="px-3 py-2.5 text-[#9B9B9B] tabular-nums whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[#1A1A1A] font-medium">{getDescription(tx)}</div>
                    <div className="text-[10px] text-[#9B9B9B]">{tx.merchant_name ?? tx.name}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${badgeStyle}`}>
                      {humanizeCategory(cat)}
                    </span>
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right tabular-nums font-medium whitespace-nowrap ${
                      tx.amount > 0 ? 'text-[#D94F4F]' : 'text-[#2D8A56]'
                    }`}
                  >
                    {tx.amount > 0 ? '−' : '+'}{formatCurrency(Math.abs(tx.amount))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-1 text-xs text-[#6B6B6B] transition-colors hover:bg-[#F0F0EE] disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-[#9B9B9B]">
            Page {page + 1} of {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            className="rounded-md border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-1 text-xs text-[#6B6B6B] transition-colors hover:bg-[#F0F0EE] disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
