'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Share, Download, CheckCircle2, AlertTriangle, TrendingDown, FileText } from 'lucide-react';
import { StabilityChart } from './StabilityChart';
import { GrowthChart } from './GrowthChart';
import { Transaction, Account, DailyFlow } from '@/lib/types';
import { exportLoanReadinessReport } from '@/lib/export';

interface LendingReportProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  accounts?: Account[];
  chartData?: DailyFlow[];
  totalBalance?: number;
  totalSpend?: number;
  totalIncome?: number;
  netFlow?: number;
  monthlyBurn?: number;
  runwayMonths?: number;
}

export function LendingReport({
  isOpen, onClose,
  transactions = [], accounts = [], chartData = [],
  totalBalance = 0, totalSpend = 0, totalIncome = 0,
  netFlow = 0, monthlyBurn = 0, runwayMonths = 0,
}: LendingReportProps) {
  const totalTx = transactions.length;
  const accountCount = accounts.length;
  const avgMonthlyIncome = totalIncome / 3;
  const avgMonthlyExpenses = totalSpend / 3;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Top income sources
  const incomeSources: Record<string, number> = {};
  for (const tx of transactions.filter((t) => t.amount < 0)) {
    const name = tx.merchant_name ?? tx.name;
    incomeSources[name] = (incomeSources[name] ?? 0) + Math.abs(tx.amount);
  }
  const topIncome = Object.entries(incomeSources).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const totalIncomeSum = topIncome.reduce((s, [, v]) => s + v, 0) || 1;

  // Top expense categories
  const expCats: Record<string, number> = {};
  for (const tx of transactions.filter((t) => t.amount > 0)) {
    const cat = (tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'OTHER').toUpperCase();
    expCats[cat] = (expCats[cat] ?? 0) + tx.amount;
  }
  const topExp = Object.entries(expCats).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const totalExpSum = topExp.reduce((s, [, v]) => s + v, 0) || 1;

  const rentToRevenue = avgMonthlyIncome > 0 ? (expCats['RENT_AND_UTILITIES'] ?? 0) / 3 / avgMonthlyIncome : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 pt-16 pb-6 sm:px-6 sm:pt-20 sm:pb-8 md:px-10 md:pt-20 md:pb-10">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm cursor-pointer"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-5xl max-h-[80vh] bg-[#F5F5F3] rounded-xl shadow-2xl border border-[#E8E8E6] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#E8E8E6] px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <button onClick={onClose} className="p-2 hover:bg-[#F0F0EE] rounded-full transition-colors text-[#9B9B9B] hover:text-[#1A1A1A]">
                  <X className="w-5 h-5" />
                </button>
                <div className="h-6 w-px bg-[#E8E8E6] hidden sm:block" />
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-[#1A1A1A]">RunwayAI</span>
                  <span className="text-[#9B9B9B] text-sm hidden sm:inline">/</span>
                  <span className="text-[#1A1A1A] text-sm font-medium hidden sm:inline">Lending Readiness Report</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#1A1A1A] bg-[#F5F5F3] hover:bg-[#F0F0EE] border border-[#E8E8E6] rounded-md transition-colors">
                  <Share className="w-4 h-4" /> Share
                </button>
                <button
                  onClick={() => exportLoanReadinessReport(transactions, accounts)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-[#0D7C66] hover:bg-[#0A6B58] border border-[#0A6B58] rounded-md transition-colors shadow-[0_0_15px_rgba(13,124,102,0.3)]"
                >
                  <Download className="w-4 h-4" /> Export PDF
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto bg-[#F0F0EE] bg-noise p-4 md:p-8">
              <div className="bg-white rounded-lg shadow-[0_0_40px_rgba(0,0,0,0.15)] max-w-3xl mx-auto w-full overflow-hidden border border-slate-200/50">
                <div className="p-8 md:p-12 space-y-12 text-slate-900 font-sans">

                  {/* Document Header */}
                  <div className="border-b border-slate-200 pb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Lending Readiness Report</h1>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                      <p>Generated: {today}</p>
                      <p>Period: Last 90 days</p>
                      <p>Accounts: {accountCount} connected via Plaid</p>
                      <p>Transactions: {totalTx}</p>
                    </div>
                  </div>

                  {/* Executive Summary */}
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-5 h-5 text-[#0D7C66]" />
                      <h2 className="text-lg font-semibold text-slate-900">Executive Summary</h2>
                    </div>
                    <div className="bg-[#E8F5F0]/50 rounded-xl p-6 border border-[#0D7C66]/20">
                      <p className="text-slate-700 leading-relaxed">
                        This business shows{' '}
                        <strong className="text-slate-900">{totalTx} transactions</strong> across{' '}
                        <strong className="text-slate-900">{accountCount} account{accountCount !== 1 ? 's' : ''}</strong> over the last 90 days.
                        Average monthly income of{' '}
                        <strong className="text-slate-900">${avgMonthlyIncome.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong> against
                        expenses of{' '}
                        <strong className="text-slate-900">${avgMonthlyExpenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong> per month.
                        Current balance of{' '}
                        <strong className="text-slate-900">${totalBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong> provides{' '}
                        <strong className={runwayMonths < 3 ? 'text-red-600' : 'text-slate-900'}>
                          {runwayMonths === Infinity ? 'unlimited' : `${runwayMonths.toFixed(1)} months`}
                        </strong>{' '}
                        of runway at current burn.
                      </p>
                    </div>
                  </section>

                  {/* Cash Flow Overview */}
                  <section>
                    <h2 className="text-lg font-semibold text-slate-900 mb-6 border-b border-slate-200 pb-2">Cash Flow Overview</h2>
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Avg Monthly Income</p>
                        <p className="text-xl font-bold text-slate-900">${avgMonthlyIncome.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Avg Monthly Expenses</p>
                        <p className="text-xl font-bold text-slate-900">${avgMonthlyExpenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className={`rounded-lg p-4 border ${netFlow >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <p className={`text-xs uppercase tracking-wider mb-1 ${netFlow >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Net Trend</p>
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xl font-bold ${netFlow >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {netFlow >= 0 ? 'Positive' : 'Negative'}
                          </p>
                          {netFlow < 0 && <TrendingDown className="w-5 h-5 text-red-600" />}
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-6 shadow-inner">
                      <div className="h-[260px]">
                        <StabilityChart chartData={chartData} />
                      </div>
                    </div>
                  </section>

                  {/* Growth Projection */}
                  <section>
                    <h2 className="text-lg font-semibold text-slate-900 mb-6 border-b border-slate-200 pb-2">Growth Projection (24-Month)</h2>
                    <div className="bg-slate-900 rounded-xl p-6 shadow-inner">
                      <div className="h-[260px]">
                        <GrowthChart />
                      </div>
                    </div>
                  </section>

                  {/* Income & Expenses */}
                  <div className="grid md:grid-cols-2 gap-8">
                    <section>
                      <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-200 pb-2">Income Stability</h2>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <p className="text-sm font-medium text-slate-900 mb-3">Top Sources</p>
                        <div className="space-y-3">
                          {topIncome.map(([name, amount]) => (
                            <div key={name}>
                              <div className="flex justify-between items-center text-sm mb-1">
                                <span className="text-slate-600 truncate">{name}</span>
                                <span className="font-medium text-slate-900">{Math.round((amount / totalIncomeSum) * 100)}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5">
                                <div className="bg-[#0D7C66] h-1.5 rounded-full" style={{ width: `${(amount / totalIncomeSum) * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section>
                      <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-200 pb-2">Expense Analysis</h2>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <p className="text-sm font-medium text-slate-900 mb-3">Category Breakdown</p>
                        <div className="space-y-3">
                          {topExp.map(([cat, amount]) => (
                            <div key={cat}>
                              <div className="flex justify-between items-center text-sm mb-1">
                                <span className="text-slate-600">{cat}</span>
                                <span className="font-medium text-slate-900">{Math.round((amount / totalExpSum) * 100)}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5">
                                <div className="bg-[#0D7C66] h-1.5 rounded-full" style={{ width: `${(amount / totalExpSum) * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Account Health */}
                  <section>
                    <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-200 pb-2">Account Health</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 border border-slate-200 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Current Balance</p>
                        <p className="text-lg font-semibold text-slate-900">${totalBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="p-4 border border-slate-200 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Cash Runway</p>
                        <p className={`text-lg font-semibold ${runwayMonths < 3 ? 'text-red-600' : 'text-slate-900'}`}>
                          {runwayMonths === Infinity ? 'N/A' : `${runwayMonths.toFixed(1)} mo`}
                        </p>
                      </div>
                      <div className="p-4 border border-slate-200 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Monthly Burn</p>
                        <p className="text-lg font-semibold text-slate-900">${monthlyBurn.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="p-4 border border-slate-200 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Accounts</p>
                        <p className="text-lg font-semibold text-slate-900">{accountCount}</p>
                      </div>
                    </div>
                  </section>

                  {/* Risk Flags */}
                  <section>
                    <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-200 pb-2">Risk Flags</h2>
                    <div className="space-y-3">
                      {runwayMonths < 3 && (
                        <div className="bg-red-50 rounded-lg p-4 border border-red-200 flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-900">Low Cash Runway</p>
                            <p className="text-sm text-red-700 mt-1">
                              Only {runwayMonths.toFixed(1)} months of runway at current burn rate of ${monthlyBurn.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo.
                            </p>
                          </div>
                        </div>
                      )}
                      {rentToRevenue > 0.3 && (
                        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-amber-900">High Rent-to-Revenue Ratio</p>
                            <p className="text-sm text-amber-700 mt-1">
                              Rent represents {Math.round(rentToRevenue * 100)}% of avg monthly revenue, above the 25-30% benchmark.
                            </p>
                          </div>
                        </div>
                      )}
                      {netFlow >= 0 && (
                        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200 flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-emerald-900">Positive Cash Flow</p>
                            <p className="text-sm text-emerald-700 mt-1">Net positive over the last 90 days — a strong lending indicator.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Confidence Note */}
                  <section className="pt-8 border-t border-slate-200">
                    <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-500 flex items-start gap-3">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <p>
                        This report was generated by RunwayAI using read-only transaction data secured by Plaid. Based on {totalTx} transactions across {accountCount} connected account{accountCount !== 1 ? 's' : ''}.
                        <span className="block mt-2 font-medium text-slate-700">Data Confidence: High · Generated: {today}</span>
                      </p>
                    </div>
                  </section>

                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
