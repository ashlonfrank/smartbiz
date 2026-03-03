'use client';

import { useMemo, useEffect, useCallback, useState } from 'react';
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

// ── Props ─────────────────────────────────────────────────────────

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────

export default function LoanReadinessModal({ transactions, accounts, onClose }: Props) {
  const [downloading, setDownloading] = useState(false);

  const score = useMemo(() => calculateLoanScore(transactions, accounts), [transactions, accounts]);

  // ── Derived financial stats ─────────────────────────────────────
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

    // Top revenue sources
    const revenueByMerchant: Record<string, number> = {};
    for (const t of incomeTx) {
      const name = t.merchant_name ?? t.name;
      revenueByMerchant[name] = (revenueByMerchant[name] ?? 0) + Math.abs(t.amount);
    }
    const topRevenueSources = Object.entries(revenueByMerchant)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Top expense categories
    const expenseByCategory: Record<string, number> = {};
    for (const t of spendTx) {
      const cat = t.personal_finance_category?.primary ?? t.category?.[0] ?? 'Other';
      expenseByCategory[cat] = (expenseByCategory[cat] ?? 0) + t.amount;
    }
    const topExpenseCategories = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const totalExpenseForPct = Object.values(expenseByCategory).reduce((s, v) => s + v, 0);

    // Expense-to-revenue ratio
    const expenseRatio = totalIncome > 0 ? (totalSpend / totalIncome) * 100 : 0;

    return {
      totalBalance, monthlyRevenue, monthlyBurn, runway, netFlow, growthPct,
      revenueChannels, topRevenueSources, topExpenseCategories, totalExpenseForPct,
      expenseRatio, totalIncome, totalSpend,
    };
  }, [transactions, accounts]);

  // ── Escape key handler ──────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // ── Export PDF ──────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setDownloading(true);
    try {
      await exportLoanReadinessReport(transactions, accounts);
    } finally {
      setDownloading(false);
    }
  }, [transactions, accounts]);

  // ── SVG score ring ──────────────────────────────────────────────
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score.overall / 100) * circumference;

  // ── Narrative helpers ───────────────────────────────────────────
  const consistencyScore = score.components.revenueConsistency.score;
  const topSource = stats.topRevenueSources[0];
  const topExpense = stats.topExpenseCategories[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-[#E8E8E6] bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-[#E8E8E6] px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[#0D7C66] text-lg">✦</span>
            <div>
              <h2 className="text-sm font-semibold text-[#1A1A1A]">Lending Readiness Report</h2>
              <p className="text-[10px] text-[#9B9B9B]">RunwayAI · Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg bg-[#0D7C66] px-3.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#0A6B58] disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Exporting…
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Export PDF
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-[#9B9B9B] transition-colors hover:bg-[#F5F5F3] hover:text-[#1A1A1A]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

          {/* ── Executive Summary ───────────────────────────────── */}
          <section>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono mb-4">
              Executive Summary
            </div>

            {/* Score + grade + one-liner */}
            <div className="flex items-center gap-5 mb-5">
              <div className="relative flex-shrink-0">
                <svg width="104" height="104" viewBox="0 0 104 104">
                  <circle cx="52" cy="52" r={radius} fill="none" stroke="#E8E8E6" strokeWidth="6" />
                  <circle
                    cx="52" cy="52" r={radius}
                    fill="none" stroke="#0D7C66" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    transform="rotate(-90 52 52)"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-[#1A1A1A]">{score.overall}</span>
                  <span className="text-[9px] text-[#9B9B9B]">/100</span>
                </div>
              </div>
              <div>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${GRADE_COLORS[score.grade]}`}>
                  {score.grade}
                </span>
                <p className="mt-2 text-sm text-[#1A1A1A] font-medium leading-relaxed max-w-[400px]">
                  {score.summary}
                </p>
              </div>
            </div>

            {/* Key figures row */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="rounded-xl bg-[#FAFAF8] border border-[#E8E8E6] px-4 py-3">
                <div className="text-[9px] text-[#9B9B9B] uppercase tracking-wider mb-0.5">Monthly Revenue</div>
                <div className="text-base font-bold text-[#1A1A1A]">{fmt(stats.monthlyRevenue)}</div>
              </div>
              <div className="rounded-xl bg-[#FAFAF8] border border-[#E8E8E6] px-4 py-3">
                <div className="text-[9px] text-[#9B9B9B] uppercase tracking-wider mb-0.5">Monthly Expenses</div>
                <div className="text-base font-bold text-[#1A1A1A]">{fmt(stats.monthlyBurn)}</div>
              </div>
              <div className="rounded-xl bg-[#FAFAF8] border border-[#E8E8E6] px-4 py-3">
                <div className="text-[9px] text-[#9B9B9B] uppercase tracking-wider mb-0.5">Cash Runway</div>
                <div className="text-base font-bold text-[#1A1A1A]">{stats.runway.toFixed(1)} <span className="text-xs font-normal text-[#9B9B9B]">mo</span></div>
              </div>
              <div className="rounded-xl bg-[#FAFAF8] border border-[#E8E8E6] px-4 py-3">
                <div className="text-[9px] text-[#9B9B9B] uppercase tracking-wider mb-0.5">Net Cash Flow</div>
                <div className={`text-base font-bold ${stats.netFlow >= 0 ? 'text-[#0D7C66]' : 'text-[#D94F4F]'}`}>
                  {stats.netFlow >= 0 ? '+' : '-'}{fmt(stats.netFlow)}
                </div>
              </div>
            </div>

            {/* Main narrative */}
            <div className="rounded-xl bg-[#FAFAF8] border border-[#E8E8E6] p-5">
              <p className="text-[13px] text-[#1A1A1A] leading-[1.8]">
                This report summarizes the financial position of the applicant based on {transactions.length} verified
                bank transactions across {accounts.length} connected account{accounts.length !== 1 ? 's' : ''} over the
                past 90 days. The business generates an average of <strong>{fmt(stats.monthlyRevenue)}</strong> in
                monthly revenue from <strong>{stats.revenueChannels} distinct revenue source{stats.revenueChannels !== 1 ? 's' : ''}</strong>,
                demonstrating {stats.revenueChannels >= 3 ? 'a diversified income base that reduces dependency on any single client or platform' : 'a focused revenue stream'}.
              </p>
              <p className="text-[13px] text-[#1A1A1A] leading-[1.8] mt-3">
                {stats.growthPct > 10
                  ? `Revenue has grown ${stats.growthPct.toFixed(0)}% over the analysis period, indicating strong business momentum and an expanding customer base. This upward trajectory suggests increasing capacity to service debt obligations.`
                  : stats.growthPct > 0
                    ? `Revenue shows modest growth of ${stats.growthPct.toFixed(0)}% over the analysis period, reflecting stable business operations with potential for further expansion.`
                    : stats.growthPct > -5
                      ? 'Revenue has remained relatively stable over the analysis period, demonstrating consistent business operations and predictable cash flows.'
                      : `Revenue has declined ${Math.abs(stats.growthPct).toFixed(0)}% over the analysis period. This trend warrants attention, though it may reflect seasonal factors or a transitional period.`
                }
              </p>
            </div>
          </section>

          {/* ── Cash Flow Assessment ────────────────────────────── */}
          <section>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono mb-4">
              Cash Flow Assessment
            </div>

            <div className="rounded-xl bg-[#FAFAF8] border border-[#E8E8E6] p-5">
              <p className="text-[13px] text-[#1A1A1A] leading-[1.8]">
                The business maintains a current cash position of <strong>{fmt(stats.totalBalance)}</strong> across
                all connected accounts, providing approximately <strong>{stats.runway.toFixed(1)} months</strong> of
                operating runway at the current burn rate of {fmt(stats.monthlyBurn)}/month.
                {stats.runway >= 6
                  ? ' This represents a strong liquidity position — well above the 3-month minimum typically required by lenders — indicating the business can comfortably absorb short-term disruptions while servicing loan payments.'
                  : stats.runway >= 3
                    ? ' This meets the standard 3-month minimum threshold lenders typically look for, indicating the business has adequate reserves to manage operational fluctuations alongside debt service.'
                    : ' This is below the 3-month threshold most lenders prefer. Building additional reserves or reducing monthly expenses would strengthen the application. However, this should be weighed against the revenue growth trajectory.'
                }
              </p>
              <p className="text-[13px] text-[#1A1A1A] leading-[1.8] mt-3">
                {stats.netFlow >= 0
                  ? `Over the 90-day period, the business generated a net positive cash flow of ${fmt(stats.netFlow)}, meaning more money came in than went out. This is a strong signal of operational health and suggests the business has the capacity to take on and service additional debt.`
                  : `Over the 90-day period, net cash flow was negative by ${fmt(stats.netFlow)}. This means expenses exceeded income during the analysis window. While this may reflect seasonal patterns, one-time investments, or growth-phase spending, lenders will want to understand the underlying cause and the plan to return to positive cash flow.`
                }
              </p>
            </div>
          </section>

          {/* ── Income Stability ────────────────────────────────── */}
          <section>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono mb-4">
              Income Stability
            </div>

            <div className="rounded-xl bg-[#FAFAF8] border border-[#E8E8E6] p-5">
              <p className="text-[13px] text-[#1A1A1A] leading-[1.8]">
                Revenue consistency scores <strong>{consistencyScore}/100</strong>,
                rated as{' '}
                <strong>
                  {consistencyScore >= 70 ? 'highly consistent' : consistencyScore >= 40 ? 'moderately consistent' : 'variable'}
                </strong>.
                {consistencyScore >= 70
                  ? ' The business demonstrates predictable monthly income with low month-to-month variation, which is a key factor lenders evaluate for repayment reliability.'
                  : consistencyScore >= 40
                    ? ' Monthly income shows some variability, which is common for businesses in growth phases or those with seasonal patterns. Lenders may request additional context on revenue cycles.'
                    : ' Monthly income shows significant variability. Providing context around seasonal patterns or growth initiatives would help strengthen the application.'
                }
              </p>
              {topSource && (
                <p className="text-[13px] text-[#1A1A1A] leading-[1.8] mt-3">
                  The primary revenue source is <strong>{topSource[0]}</strong>, contributing {fmt(topSource[1])} over
                  the 90-day period.
                  {stats.topRevenueSources.length >= 3
                    ? ` Income is distributed across ${stats.revenueChannels} channels including ${stats.topRevenueSources.slice(1, 3).map(s => s[0]).join(' and ')}, providing diversification that reduces single-source risk.`
                    : ' Expanding to additional revenue channels could further strengthen the financial profile.'
                  }
                </p>
              )}
            </div>

            {/* Compact source list */}
            {stats.topRevenueSources.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {stats.topRevenueSources.map(([name, amount], i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white border border-[#E8E8E6] px-3 py-2">
                    <span className="text-[11px] text-[#4A4A4A]">{name}</span>
                    <span className="text-[11px] font-semibold text-[#0D7C66]">{fmt(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Expense Analysis ────────────────────────────────── */}
          <section>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono mb-4">
              Expense Analysis
            </div>

            <div className="rounded-xl bg-[#FAFAF8] border border-[#E8E8E6] p-5">
              <p className="text-[13px] text-[#1A1A1A] leading-[1.8]">
                The expense-to-revenue ratio is <strong>{stats.expenseRatio.toFixed(0)}%</strong>,
                {stats.expenseRatio <= 70
                  ? ' which is well within healthy parameters. The business retains a meaningful margin between revenue and operating costs, providing comfort that loan payments can be absorbed without straining operations.'
                  : stats.expenseRatio <= 100
                    ? ' indicating that operating costs consume a significant portion of revenue. While the business remains solvent, the margin for debt service is tighter. Cost optimization or revenue growth would improve this metric.'
                    : ' meaning expenses currently exceed revenue. This requires careful evaluation — the business may be in an investment or growth phase, but lenders will want to see a clear path back to profitability before extending credit.'
                }
              </p>
              {topExpense && (
                <p className="text-[13px] text-[#1A1A1A] leading-[1.8] mt-3">
                  The largest expense category is <strong>{topExpense[0].replace(/_/g, ' ')}</strong> at {fmt(topExpense[1])}{' '}
                  ({stats.totalExpenseForPct > 0 ? ((topExpense[1] / stats.totalExpenseForPct) * 100).toFixed(0) : 0}% of total spend),
                  followed by {stats.topExpenseCategories.slice(1, 3).map(([cat, amt]) =>
                    `${cat.replace(/_/g, ' ')} (${fmt(amt)})`
                  ).join(' and ')}.
                  {' '}These expenses appear consistent with standard business operations for this type of business.
                </p>
              )}
            </div>
          </section>

          {/* ── Risk Assessment ─────────────────────────────────── */}
          <section>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono mb-4">
              Risk Assessment
            </div>

            {stats.netFlow >= 0 && stats.runway >= 3 && stats.expenseRatio <= 100 && stats.growthPct >= -5 ? (
              <div className="rounded-xl bg-[#E8F5F0] border border-[#0D7C66]/20 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="h-4 w-4 text-[#0D7C66] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span className="text-xs font-semibold text-[#0D7C66]">Low Risk Profile</span>
                </div>
                <p className="text-[13px] text-[#0D7C66]/80 leading-[1.8]">
                  No significant risk flags were identified. The business demonstrates positive cash flow, adequate reserves,
                  and stable operations — all of which support a favorable lending decision.
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-[#FAFAF8] border border-[#E8E8E6] p-5 space-y-4">
                <p className="text-[13px] text-[#1A1A1A] leading-[1.8]">
                  The following items have been flagged for lender consideration. These do not necessarily disqualify
                  the application, but may require supporting documentation or explanation:
                </p>
                <div className="space-y-3">
                  {stats.netFlow < 0 && (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FDF0E8] text-[10px]">!</span>
                      <div>
                        <div className="text-xs font-semibold text-[#1A1A1A]">Negative Net Cash Flow</div>
                        <p className="text-[12px] text-[#6B6B6B] leading-relaxed mt-0.5">
                          The business spent {fmt(stats.netFlow)} more than it earned over the 90-day period. If this is due to
                          seasonal factors or a one-time investment, providing context will help the application.
                        </p>
                      </div>
                    </div>
                  )}
                  {stats.runway < 3 && (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FDF0E8] text-[10px]">!</span>
                      <div>
                        <div className="text-xs font-semibold text-[#1A1A1A]">Limited Cash Reserves</div>
                        <p className="text-[12px] text-[#6B6B6B] leading-relaxed mt-0.5">
                          Current runway is {stats.runway.toFixed(1)} months, below the standard 3-month benchmark. Increasing
                          reserves before applying, or demonstrating a clear plan for cash management, would strengthen the case.
                        </p>
                      </div>
                    </div>
                  )}
                  {stats.expenseRatio > 100 && (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FDE8E8] text-[10px]">!</span>
                      <div>
                        <div className="text-xs font-semibold text-[#1A1A1A]">Expenses Exceed Revenue</div>
                        <p className="text-[12px] text-[#6B6B6B] leading-relaxed mt-0.5">
                          Operating expenses are at {stats.expenseRatio.toFixed(0)}% of revenue. Demonstrating a path to
                          profitability — through cost reduction or revenue growth — will be important for the application.
                        </p>
                      </div>
                    </div>
                  )}
                  {stats.growthPct < -10 && (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FDF0E8] text-[10px]">!</span>
                      <div>
                        <div className="text-xs font-semibold text-[#1A1A1A]">Revenue Decline</div>
                        <p className="text-[12px] text-[#6B6B6B] leading-relaxed mt-0.5">
                          Revenue has decreased by {Math.abs(stats.growthPct).toFixed(0)}% over the past 90 days. Explaining
                          whether this reflects seasonality, a pivot, or a temporary dip will be helpful.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── Recommendation ──────────────────────────────────── */}
          <section>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono mb-4">
              Assessment
            </div>

            <div className="rounded-xl bg-[#FAFAF8] border border-[#E8E8E6] p-5">
              <p className="text-[13px] text-[#1A1A1A] leading-[1.8]">
                {score.overall >= 70
                  ? `With an overall readiness score of ${score.overall}/100, this business presents a strong case for lending consideration. The combination of consistent revenue, healthy cash reserves, and demonstrated growth provides confidence in the applicant's ability to service debt obligations. We recommend proceeding with the loan application.`
                  : score.overall >= 50
                    ? `With an overall readiness score of ${score.overall}/100, this business shows a solid foundation for lending consideration. While there are areas for improvement, the underlying financial health — including revenue consistency and transaction activity — supports a favorable evaluation. Addressing the flagged items would further strengthen the application.`
                    : score.overall >= 35
                      ? `With an overall readiness score of ${score.overall}/100, the business shows potential but has areas that may give lenders pause. We recommend addressing the flagged risk items before submitting a formal application. Building additional cash reserves and improving the expense-to-revenue ratio would meaningfully improve the readiness score.`
                      : `With an overall readiness score of ${score.overall}/100, the business may face challenges in the current lending environment. We recommend focusing on improving cash flow fundamentals — building reserves, reducing expenses, and stabilizing revenue — before approaching lenders. A follow-up assessment in 60–90 days would help track progress.`
                }
              </p>
            </div>
          </section>

          {/* ── Score Reference (compact) ──────────────────────── */}
          <section>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[#9B9B9B] font-mono mb-3">
              Score Components
            </div>

            <div className="grid grid-cols-5 gap-2">
              {(Object.entries(score.components) as [string, { score: number; label: string }][]).map(
                ([key, comp]) => {
                  const color = comp.score >= 70 ? 'text-[#0D7C66]' : comp.score >= 40 ? 'text-amber-600' : 'text-[#D94F4F]';
                  const meta: Record<string, string> = {
                    cashRunway: 'Cash Runway',
                    revenueConsistency: 'Consistency',
                    expenseRatio: 'Expense Ratio',
                    growthTrend: 'Growth',
                    transactionVolume: 'Volume',
                  };
                  return (
                    <div key={key} className="rounded-lg bg-white border border-[#E8E8E6] px-3 py-2.5 text-center">
                      <div className={`text-lg font-bold tabular-nums ${color}`}>{comp.score}</div>
                      <div className="text-[8px] text-[#9B9B9B] uppercase tracking-wider mt-0.5">{meta[key]}</div>
                    </div>
                  );
                },
              )}
            </div>
          </section>

          {/* ── Footer ─────────────────────────────────────────── */}
          <div className="border-t border-[#E8E8E6] pt-4 text-center">
            <p className="text-[9px] text-[#9B9B9B]">
              Prepared with RunwayAI · Data verified via Plaid · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-[8px] text-[#9B9B9B] mt-1">
              This report is generated from read-only bank data and does not constitute financial advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
