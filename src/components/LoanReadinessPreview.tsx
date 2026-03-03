'use client';

import { useMemo } from 'react';
import { calculateLoanScore, exportLoanReadinessReport } from '@/lib/export';
import type { Transaction, Account } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────

const fmt = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const GRADE_COLORS: Record<string, string> = {
  Excellent: 'bg-[#E8F5F0] text-[#0D7C66]',
  Good: 'bg-[#E8F0FA] text-[#117ACA]',
  Fair: 'bg-[#FDF0E8] text-[#C4702B]',
  'Needs Improvement': 'bg-[#FDE8E8] text-[#D94F4F]',
};

const COMPONENT_LABELS: Record<string, { name: string; weight: string }> = {
  cashRunway: { name: 'Cash Runway', weight: '25%' },
  revenueConsistency: { name: 'Revenue Consistency', weight: '25%' },
  expenseRatio: { name: 'Expense Ratio', weight: '20%' },
  growthTrend: { name: 'Growth Trend', weight: '15%' },
  transactionVolume: { name: 'Transaction Volume', weight: '15%' },
};

// ── Props ─────────────────────────────────────────────────────────

interface Props {
  transactions: Transaction[];
  accounts: Account[];
}

// ── Component ─────────────────────────────────────────────────────

export default function LoanReadinessPreview({ transactions, accounts }: Props) {
  const score = useMemo(() => calculateLoanScore(transactions, accounts), [transactions, accounts]);

  // Derive financial values for the letter
  const stats = useMemo(() => {
    const totalBalance = accounts.reduce((s, a) => s + (a.balances.current ?? 0), 0);
    const spendTx = transactions.filter((t) => t.amount > 0);
    const incomeTx = transactions.filter((t) => t.amount < 0);
    const totalSpend = spendTx.reduce((s, t) => s + t.amount, 0);
    const totalIncome = Math.abs(incomeTx.reduce((s, t) => s + t.amount, 0));
    const monthlyBurn = totalSpend / 3;
    const monthlyRevenue = totalIncome / 3;
    const runway = monthlyBurn > 0 ? totalBalance / monthlyBurn : 0;
    const netFlow = totalIncome - totalSpend;

    // Revenue growth — compare newest vs oldest 30-day buckets
    const now = new Date();
    const buckets = [0, 0, 0];
    for (const t of incomeTx) {
      const daysAgo = Math.floor((now.getTime() - new Date(t.date).getTime()) / 86400000);
      if (daysAgo <= 30) buckets[2] += Math.abs(t.amount);
      else if (daysAgo <= 60) buckets[1] += Math.abs(t.amount);
      else buckets[0] += Math.abs(t.amount);
    }
    const growthPct = buckets[0] > 0 ? ((buckets[2] - buckets[0]) / buckets[0]) * 100 : 0;

    // Unique merchants as revenue channels
    const revenueChannels = new Set(incomeTx.map((t) => t.merchant_name ?? t.name)).size;

    return { totalBalance, monthlyRevenue, monthlyBurn, runway, netFlow, growthPct, revenueChannels };
  }, [transactions, accounts]);

  // SVG score ring params
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score.overall / 100) * circumference;

  const handleDownload = () => {
    exportLoanReadinessReport(transactions, accounts);
  };

  return (
    <div className="rounded-2xl border border-[#E8E8E6] bg-white px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[#1A1A1A] font-mono">
          Loan Readiness
        </h3>
        <button
          onClick={handleDownload}
          className="rounded-lg border border-[#E8E8E6] px-3 py-1.5 text-[10px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F3] transition-colors"
        >
          Download Full Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Left: Score + Components ──────────────────────────── */}
        <div>
          {/* Score ring */}
          <div className="flex items-center gap-5 mb-5">
            <div className="relative flex-shrink-0">
              <svg width="96" height="96" viewBox="0 0 96 96">
                {/* Background ring */}
                <circle cx="48" cy="48" r={radius} fill="none" stroke="#E8E8E6" strokeWidth="6" />
                {/* Score arc */}
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  fill="none"
                  stroke="#0D7C66"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  transform="rotate(-90 48 48)"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-[#1A1A1A]">{score.overall}</span>
                <span className="text-[9px] text-[#9B9B9B]">/100</span>
              </div>
            </div>
            <div>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${GRADE_COLORS[score.grade]}`}>
                {score.grade}
              </span>
              <p className="mt-1.5 text-[11px] text-[#6B6B6B] leading-relaxed max-w-[200px]">
                {score.summary}
              </p>
            </div>
          </div>

          {/* Component bars */}
          <div className="space-y-2.5">
            {(Object.entries(score.components) as [string, { score: number; label: string }][]).map(
              ([key, comp]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-[#6B6B6B]">
                      {COMPONENT_LABELS[key]?.name}{' '}
                      <span className="text-[#9B9B9B]">({COMPONENT_LABELS[key]?.weight})</span>
                    </span>
                    <span className="text-[10px] text-[#9B9B9B]">{comp.score}/100</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#E8E8E6] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#0D7C66] transition-all duration-500"
                      style={{ width: `${comp.score}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-[#9B9B9B] mt-0.5">{comp.label}</p>
                </div>
              ),
            )}
          </div>
        </div>

        {/* ── Right: Chase Letter Preview ───────────────────────── */}
        <div className="rounded-xl border border-[#E8E8E6] bg-[#FAFAF8] p-5 font-mono text-[10px] leading-[1.7] text-[#4A4A4A] shadow-sm">
          {/* Chase header */}
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#E8E8E6]">
            <div className="flex h-7 w-7 items-center justify-center rounded-md text-white text-xs font-bold" style={{ backgroundColor: '#117ACA' }}>
              C
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#1A1A1A]">Chase Business Banking</div>
              <div className="text-[9px] text-[#9B9B9B]">Loan Application Summary</div>
            </div>
          </div>

          {/* Document body */}
          <div className="space-y-3">
            <div>
              <div className="text-[9px] text-[#9B9B9B] uppercase tracking-wider mb-1">Prepared for</div>
              <div className="text-[11px] font-semibold text-[#1A1A1A]">Bella&apos;s Kitchen</div>
              <div className="text-[9px] text-[#9B9B9B]">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>

            <div className="border-t border-[#E8E8E6] pt-2.5">
              <div className="text-[9px] text-[#9B9B9B] uppercase tracking-wider mb-2">Financial Overview</div>
              <div className="space-y-1">
                <div className="flex justify-between"><span>Cash Position</span><span className="font-semibold text-[#1A1A1A]">{fmt(stats.totalBalance)}</span></div>
                <div className="flex justify-between"><span>Monthly Revenue</span><span className="font-semibold text-[#1A1A1A]">{fmt(stats.monthlyRevenue)}</span></div>
                <div className="flex justify-between"><span>Monthly Expenses</span><span className="font-semibold text-[#1A1A1A]">{fmt(stats.monthlyBurn)}</span></div>
                <div className="flex justify-between"><span>Cash Runway</span><span className="font-semibold text-[#1A1A1A]">{stats.runway.toFixed(1)} months</span></div>
                <div className="flex justify-between"><span>Revenue Growth (90d)</span><span className="font-semibold text-[#0D7C66]">+{stats.growthPct.toFixed(1)}%</span></div>
              </div>
            </div>

            <div className="border-t border-[#E8E8E6] pt-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-[#9B9B9B] uppercase tracking-wider">Readiness Score</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${GRADE_COLORS[score.grade]}`}>
                  {score.overall}/100 — {score.grade}
                </span>
              </div>
            </div>

            <div className="border-t border-[#E8E8E6] pt-2.5">
              <div className="text-[9px] text-[#9B9B9B] uppercase tracking-wider mb-1.5">Key Strengths</div>
              <ul className="space-y-0.5 text-[#1A1A1A]">
                {stats.growthPct > 10 && <li>• Revenue growing {stats.growthPct.toFixed(0)}% quarter-over-quarter</li>}
                <li>• {transactions.length} verified transactions across {accounts.length} accounts</li>
                <li>• Consistent income from {stats.revenueChannels}+ revenue channels</li>
              </ul>
            </div>

            {(stats.netFlow < 0 || stats.runway < 3) && (
              <div className="border-t border-[#E8E8E6] pt-2.5">
                <div className="text-[9px] text-[#9B9B9B] uppercase tracking-wider mb-1.5">Areas to Strengthen</div>
                <ul className="space-y-0.5 text-[#6B6B6B]">
                  {stats.netFlow < 0 && <li>• Net cash flow {fmt(stats.netFlow)} over 90 days</li>}
                  {stats.runway < 3 && <li>• Cash runway below 3-month threshold</li>}
                </ul>
              </div>
            )}

            <div className="border-t border-[#E8E8E6] pt-2.5 text-[8px] text-[#9B9B9B] text-center">
              Prepared with RunwayAI · Data verified via Plaid
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
