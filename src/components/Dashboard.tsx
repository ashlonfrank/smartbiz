'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Maximize2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Transaction, Account, Recommendation, DailyFlow } from '@/lib/types';
import { exportTransactionsCSV, exportDashboardPDF } from '@/lib/export';
import { mockTransactions, mockAccounts } from '@/lib/mock-data';
import { detectAnomalies, checkBudgetThresholds, loadBudgets, saveBudgets, suggestThresholds } from '@/lib/alerts';
import { TopNav } from './TopNav';
import { StabilityChart } from './StabilityChart';
import { GrowthChart } from './GrowthChart';
import { InsightPanel, ChatContext, ChatMessage, ChatHistories } from './InsightPanel';
import { TransactionList } from './TransactionList';
import { SpendingByCategory } from './SpendingByCategory';
import { LendingReport } from './LendingReport';
import { ChartModal } from './ChartModal';
import { ContextualQuestions } from './ContextualQuestions';

// ── helpers ──────────────────────────────────────────────────────────────────

function buildChartData(transactions: Transaction[]): DailyFlow[] {
  const now = new Date();
  const days: DailyFlow[] = [];

  for (let i = 59; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days.push({ date: key, spend: 0, income: 0, net: 0, cumulative: 0 });
  }

  for (const tx of transactions) {
    const idx = days.findIndex((d) => d.date === tx.date);
    if (idx === -1) continue;
    if (tx.amount > 0) days[idx].spend += tx.amount;
    else days[idx].income += Math.abs(tx.amount);
  }

  const lastSevenNet = days.slice(-7).map((d) => d.income - d.spend);
  const avgNet = lastSevenNet.reduce((s, v) => s + v, 0) / lastSevenNet.length;

  let cumulative = 0;
  for (const d of days) {
    d.net = d.income - d.spend;
    cumulative += d.net;
    d.cumulative = cumulative;
  }

  let forecastCumulative = cumulative;
  for (let i = 1; i <= 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    forecastCumulative += avgNet;
    days.push({
      date: d.toISOString().split('T')[0],
      spend: 0, income: 0, net: avgNet,
      cumulative,
      forecast: forecastCumulative,
    });
  }

  return days;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// ── main dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [chartData, setChartData] = useState<DailyFlow[]>([]);
  const [analyzeStatus, setAnalyzeStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [loaded, setLoaded] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [expandedChart, setExpandedChart] = useState<'stability' | 'growth' | 'transactions' | 'spending' | null>(null);
  const [activeChat, setActiveChat] = useState<ChatContext>(null);
  const [chatHistories, setChatHistories] = useState<ChatHistories>({});
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try { const s = localStorage.getItem('runwayai_approvals'); return s ? new Set(JSON.parse(s).dismissed ?? []) : new Set(); }
    catch { return new Set(); }
  });
  const [approved, setApproved] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try { const s = localStorage.getItem('runwayai_approvals'); return s ? new Set(JSON.parse(s).approved ?? []) : new Set(); }
    catch { return new Set(); }
  });

  // Load data
  useEffect(() => {
    const raw = localStorage.getItem('runwayai_data');
    let tx: Transaction[], accts: Account[];
    if (raw) {
      const parsed = JSON.parse(raw) as { transactions: Transaction[]; accounts: Account[] };
      tx = parsed.transactions; accts = parsed.accounts;
    } else {
      tx = mockTransactions; accts = mockAccounts;
      localStorage.setItem('runwayai_data', JSON.stringify({ transactions: tx, accounts: accts }));
    }
    setTransactions(tx); setAccounts(accts);
    setChartData(buildChartData(tx));
    setLoaded(true);
  }, []);

  // Run /api/analyze
  const runAnalysis = useCallback(async (tx: Transaction[], accts: Account[]) => {
    setAnalyzeStatus('loading');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: tx, accounts: accts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
      setRecommendations(data.recommendations ?? []);
      setAnalyzeStatus('done');
    } catch {
      setAnalyzeStatus('error');
    }
  }, []);

  useEffect(() => {
    if (loaded && transactions.length > 0 && analyzeStatus === 'idle') {
      runAnalysis(transactions, accounts);
    }
  }, [loaded, transactions, accounts, analyzeStatus, runAnalysis]);

  // Persist approval state
  useEffect(() => {
    localStorage.setItem('runwayai_approvals', JSON.stringify({ approved: [...approved], dismissed: [...dismissed] }));
  }, [approved, dismissed]);

  // Chat history helpers
  const handleInsightAsk = useCallback(async (section: string, question: string) => {
    if (!question) { setActiveChat({ section, question }); return; }

    const existing = chatHistories[section] ?? [];
    const withUser: ChatMessage[] = [...existing, { role: 'user', text: question }];
    setChatHistories((prev) => ({ ...prev, [section]: withUser }));
    setActiveChat({ section, question });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          transactions: transactions.slice(0, 50),
          accounts,
          history: existing.slice(-10).map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        }),
      });
      const data = await res.json();
      const reply = data.reply ?? data.message ?? 'Sorry, I couldn\'t generate a response.';
      setChatHistories((prev) => ({ ...prev, [section]: [...(prev[section] ?? []), { role: 'ai', text: reply }] }));
    } catch {
      setChatHistories((prev) => ({ ...prev, [section]: [...(prev[section] ?? []), { role: 'ai', text: 'Something went wrong. Please try again.' }] }));
    }
  }, [chatHistories, transactions, accounts]);

  const handleExpandAsk = useCallback(async (
    chartType: 'stability' | 'growth' | 'transactions' | 'spending',
    section: string,
    question: string,
  ) => {
    setExpandedChart(chartType);
    await handleInsightAsk(section, question);
  }, [handleInsightAsk]);

  const handleModalAsk = useCallback(async (section: string, question: string) => {
    await handleInsightAsk(section, question);
  }, [handleInsightAsk]);

  const handleUpdateHistory = useCallback((section: string, messages: ChatMessage[]) => {
    setChatHistories((prev) => ({ ...prev, [section]: messages }));
  }, []);

  // ── computed stats ─────────────────────────────────────────────────────────
  const totalBalance = accounts.reduce((s, a) => s + (a.balances.current ?? 0), 0);
  const totalSpend   = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalIncome  = Math.abs(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const netFlow      = totalIncome - totalSpend;
  const monthlyBurn  = totalSpend / 3;
  const runwayMonths = monthlyBurn > 0 ? totalBalance / monthlyBurn : Infinity;
  const runwayLabel  = runwayMonths === Infinity ? 'N/A' : runwayMonths < 1 ? '< 1 mo' : `${runwayMonths.toFixed(1)} mo`;
  const isNetNeg     = netFlow < 0;
  const isRunwayLow  = runwayMonths < 3;

  // Cashflow summary blurb
  const cashSummary = transactions.length > 0
    ? `${isNetNeg ? 'Negative' : 'Positive'} net cash flow of ${formatCurrency(Math.abs(netFlow))} over 90 days. Monthly burn rate of ${formatCurrency(monthlyBurn)} with ${runwayLabel} of runway remaining. ${isRunwayLow ? 'Runway is critically low — action needed.' : 'Cash position is stable.'}`
    : 'Connect your bank account to see a personalized cash flow summary.';

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div style={{position:'fixed',top:0,left:0,right:0,background:'red',color:'white',textAlign:'center',padding:'8px',zIndex:9999,fontSize:'14px',fontWeight:'bold'}}>NEW UI v2 — LOADING</div>
        <div className="flex items-center gap-3 text-[#9B9B9B]">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading your dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#FAFAF8] bg-noise text-[#1A1A1A] font-sans relative">
      <TopNav
        accounts={accounts}
        onGenerateReport={() => setIsReportOpen(true)}
        onExportCSV={() => exportTransactionsCSV(transactions)}
        onExportPDF={() => exportDashboardPDF(transactions, accounts)}
        onDisconnect={() => { localStorage.removeItem('runwayai_data'); router.push('/'); }}
      />

      <main className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col lg:flex-row relative">
        {/* Left edge line */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-[#E8E8E6]" />
        <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-px bg-[#E8E8E6]" />

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 lg:pr-8 pb-12">

          {/* Zone 1: Balance Cards */}
          <section className="pt-4 lg:pt-8 pb-8">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:flex lg:items-start lg:gap-0">
              {[
                {
                  label: 'Balance',
                  value: formatCurrency(totalBalance),
                  sub: `${accounts.length} account${accounts.length !== 1 ? 's' : ''}`,
                  color: 'text-[#1A1A1A]',
                  tooltip: 'Current operating balance across connected accounts.',
                },
                {
                  label: '90-Day Spend',
                  value: formatCurrency(totalSpend),
                  sub: `${transactions.filter((t) => t.amount > 0).length} transactions`,
                  color: 'text-[#1A1A1A]',
                },
                {
                  label: '90-Day Income',
                  value: formatCurrency(totalIncome),
                  sub: `${transactions.filter((t) => t.amount < 0).length} credits`,
                  color: 'text-[#1A1A1A]',
                },
                {
                  label: 'Net Cash Flow',
                  value: `${netFlow >= 0 ? '+' : ''}${formatCurrency(netFlow)}`,
                  sub: 'last 90 days',
                  color: isNetNeg ? 'text-[#D94F4F]' : 'text-[#2D8A56]',
                  tooltip: 'Total income minus total expenses over the last 90 days.',
                },
                {
                  label: 'Cash Runway',
                  value: runwayLabel,
                  sub: monthlyBurn > 0 ? `${formatCurrency(monthlyBurn)}/mo burn` : 'no expenses',
                  color: isRunwayLow ? 'text-[#D94F4F]' : 'text-[#1A1A1A]',
                  labelColor: isRunwayLow ? 'text-[#D94F4F]/80' : undefined,
                  tooltip: 'Estimated time until cash depletion at current burn rate.',
                },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3, ease: 'easeOut' }}
                  className="lg:flex-1 min-w-0"
                >
                  {i > 0 && <div className="hidden lg:flex items-center self-stretch px-4"><div className="w-px h-8 bg-[#E8E8E6]" /></div>}
                  <div className="py-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-[10px] uppercase tracking-wider ${stat.labelColor ?? 'text-[#9B9B9B]'}`}>{stat.label}</p>
                      {stat.tooltip && (
                        <div className="relative group">
                          <Info className="w-3 h-3 text-[#9B9B9B]" />
                          <span className="invisible group-hover:visible absolute right-0 bottom-full mb-1 z-[60] w-48 p-2 rounded-lg bg-white border border-[#E8E8E6] text-[10px] text-[#6B6B6B] normal-case tracking-normal shadow-xl">
                            {stat.tooltip}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className={`text-xl font-bold tabular-nums ${stat.color}`}>{stat.value}</span>
                    <p className={`text-[10px] mt-1 ${isRunwayLow && stat.label === 'Cash Runway' ? 'text-[#D94F4F]/60' : 'text-[#9B9B9B]'}`}>{stat.sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <div className="-mx-4 md:-mx-8 border-t border-[#E8E8E6]" />

          {/* Zone 2: Cashflow Summary */}
          <section className="py-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}>
              <div className="mb-2">
                <span className="text-[10px] uppercase tracking-widest text-[#0D7C66]/70 font-semibold flex items-center gap-1.5">
                  <span>✦</span> Cashflow Summary
                </span>
              </div>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">{cashSummary}</p>
              <p className="text-xs text-[#9B9B9B] mt-2">
                Based on {transactions.length} transactions across {accounts.length} account{accounts.length !== 1 ? 's' : ''} · Last synced just now
              </p>
            </motion.div>
          </section>

          <div className="-mx-4 md:-mx-8 border-t border-[#E8E8E6]" />

          {/* Zone 3: Cash Cycle & Quarter Forecast */}
          <section className="py-8">
            <div className="bg-white border border-[#E8E8E6] rounded-xl p-4 md:p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm uppercase tracking-widest text-[#9B9B9B] font-semibold font-mono">Cash Cycle & Quarter Forecast</h2>
                  <p className="text-xs text-[#6B6B6B] mt-1">60-day history + 30-day projection · Cumulative net flow</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1.5 text-[#6B6B6B]"><span className="w-2 h-2 rounded-full bg-[#0D7C66]" />Historical</span>
                    <span className="flex items-center gap-1.5 text-[#6BB5A5]"><span className="w-3 h-0 border-t border-dashed border-[#6BB5A5]" />Forecast</span>
                  </div>
                  <button onClick={() => setExpandedChart('stability')} className="p-1.5 rounded-md hover:bg-[#F0F0EE] transition-colors text-[#9B9B9B] hover:text-[#6B6B6B]">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <StabilityChart chartData={chartData} />
              <div className="mt-4 pt-4 border-t border-[#E8E8E6]">
                <ContextualQuestions
                  questions={['How does my cash flow trend?', 'Will I stay positive next quarter?', 'What is my biggest spending category?']}
                  onAsk={(q) => handleExpandAsk('stability', 'Cash Cycle & Quarter Forecast', q)}
                />
              </div>
            </div>
          </section>

          <div className="-mx-4 md:-mx-8 border-t border-[#E8E8E6]" />

          {/* Zone 4: Transactions */}
          <section className="py-8">
            <TransactionList
              transactions={transactions}
              chatMessages={chatHistories['Transactions'] ?? []}
              onAsk={(q) => handleExpandAsk('transactions', 'Transactions', q)}
            />
          </section>

          <div className="-mx-4 md:-mx-8 border-t border-[#E8E8E6]" />

          {/* Zone 5: Spending by Category */}
          <section className="py-8">
            <SpendingByCategory
              transactions={transactions}
              chatMessages={chatHistories['Spending by Category'] ?? []}
              onAsk={(q) => handleExpandAsk('spending', 'Spending by Category', q)}
            />
          </section>

          <div className="-mx-4 md:-mx-8 border-t border-[#E8E8E6]" />

          {/* Zone 6: Growth Projection */}
          <section className="py-8 pb-12">
            <div className="bg-white border border-[#E8E8E6] rounded-xl p-4 md:p-6 shadow-sm">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm uppercase tracking-widest text-[#9B9B9B] font-semibold font-mono">Growth Projection</h2>
                  <p className="text-xs text-[#6B6B6B] mt-1">24-Month Revenue Trajectory · Current path vs with strategic hires</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1.5 text-[#6B6B6B]"><span className="w-3 h-0 border-t border-dashed border-[#9B9B9B]" />Current</span>
                    <span className="flex items-center gap-1.5 text-[#2D8A56]"><span className="w-3 h-0.5 bg-[#2D8A56]" />With Hires</span>
                  </div>
                  <button onClick={() => setExpandedChart('growth')} className="p-1.5 rounded-md hover:bg-[#F0F0EE] transition-colors text-[#9B9B9B] hover:text-[#6B6B6B]">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <GrowthChart />
              <div className="mt-4 pt-4 border-t border-[#E8E8E6]">
                <ContextualQuestions
                  questions={['What if I hire 2 people?', 'When can I afford to expand?', "What's the ROI on a second location?"]}
                  onAsk={(q) => handleExpandAsk('growth', 'Growth Projection', q)}
                />
              </div>
            </div>
          </section>
        </div>

        {/* ── Vertical Divider ─────────────────────────────────────────────── */}
        <div className="hidden lg:block w-px bg-[#E8E8E6] self-stretch shrink-0" />

        {/* ── RIGHT COLUMN — InsightPanel ──────────────────────────────────── */}
        <div className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:overflow-hidden scrollbar-hide">
          <div className="p-4 lg:pl-8 lg:pr-0 lg:pt-8 lg:pb-8 h-full">
            <InsightPanel
              recommendations={recommendations}
              analyzeStatus={analyzeStatus}
              activeChat={activeChat}
              onCloseChat={() => setActiveChat(null)}
              onOpenChat={(ctx) => {
                if (ctx.question) { handleInsightAsk(ctx.section, ctx.question); }
                else { setActiveChat(ctx); }
              }}
              chatHistories={chatHistories}
              onUpdateHistory={handleUpdateHistory}
              onOpenReport={() => setIsReportOpen(true)}
              transactions={transactions}
              accounts={accounts}
              dismissed={dismissed}
              approved={approved}
              onDismiss={(type) => setDismissed((prev) => new Set([...prev, type]))}
              onApprove={(type) => setApproved((prev) => new Set([...prev, type]))}
            />
          </div>
        </div>
      </main>

      {/* ── Expanded Chart Modals ─────────────────────────────────────────── */}
      <ChartModal
        isOpen={expandedChart === 'stability'}
        onClose={() => setExpandedChart(null)}
        title="Cash Cycle & Quarter Forecast"
        subtitle="60-day history + 30-day projection"
        chatMessages={chatHistories['Cash Cycle & Quarter Forecast'] ?? []}
        onAskInline={(q) => handleModalAsk('Cash Cycle & Quarter Forecast', q)}
        legend={<>
          <span className="flex items-center gap-1.5 text-[#6B6B6B]"><span className="w-2 h-2 rounded-full bg-[#0D7C66]" />Historical</span>
          <span className="flex items-center gap-1.5 text-[#6BB5A5]"><span className="w-3 h-0 border-t border-dashed border-[#6BB5A5]" />Forecast</span>
        </>}
        questions={
          <ContextualQuestions
            questions={['Why did my balance dip?', 'Will I stay positive next quarter?', 'What is my burn rate?']}
            onAsk={(q) => handleModalAsk('Cash Cycle & Quarter Forecast', q)}
          />
        }
      >
        <StabilityChart expanded chartData={chartData} />
      </ChartModal>

      <ChartModal
        isOpen={expandedChart === 'growth'}
        onClose={() => setExpandedChart(null)}
        title="Growth Projection"
        subtitle="24-Month Revenue Trajectory"
        chatMessages={chatHistories['Growth Projection'] ?? []}
        onAskInline={(q) => handleModalAsk('Growth Projection', q)}
        legend={<>
          <span className="flex items-center gap-1.5 text-[#6B6B6B]"><span className="w-3 h-0 border-t border-dashed border-[#9B9B9B]" />Current</span>
          <span className="flex items-center gap-1.5 text-[#2D8A56]"><span className="w-3 h-0.5 bg-[#2D8A56]" />With Hires</span>
        </>}
        questions={
          <ContextualQuestions
            questions={['What if I hire 2 instead of 3?', 'When exactly do I hit the bottleneck?', "What's the cost of each hire?"]}
            onAsk={(q) => handleModalAsk('Growth Projection', q)}
          />
        }
      >
        <GrowthChart expanded />
      </ChartModal>

      <ChartModal
        isOpen={expandedChart === 'transactions'}
        onClose={() => setExpandedChart(null)}
        title="Transactions"
        subtitle={`${transactions.length} transactions`}
        chatMessages={chatHistories['Transactions'] ?? []}
        onAskInline={(q) => handleModalAsk('Transactions', q)}
        legend={<>
          <span className="flex items-center gap-1.5 text-[#2D8A56]"><span className="w-2 h-2 rounded-full bg-[#2D8A56]" />Income</span>
          <span className="flex items-center gap-1.5 text-[#D94F4F]"><span className="w-2 h-2 rounded-full bg-[#D94F4F]" />Expense</span>
        </>}
        questions={
          <ContextualQuestions
            questions={['Break down my COGS', 'Show recurring vendor payments', 'Which vendors cost the most?']}
            onAsk={(q) => handleModalAsk('Transactions', q)}
          />
        }
      >
        <TransactionList expanded transactions={transactions} />
      </ChartModal>

      <ChartModal
        isOpen={expandedChart === 'spending'}
        onClose={() => setExpandedChart(null)}
        title="Spending by Category"
        subtitle="90-day breakdown"
        chatMessages={chatHistories['Spending by Category'] ?? []}
        onAskInline={(q) => handleModalAsk('Spending by Category', q)}
        legend={<>
          <span className="flex items-center gap-1.5 text-[#0D7C66]"><span className="w-2 h-2 rounded-full bg-[#0D7C66]" />Food & Drink</span>
          <span className="flex items-center gap-1.5 text-[#4A7FC1]"><span className="w-2 h-2 rounded-full bg-[#4A7FC1]" />Payroll</span>
          <span className="flex items-center gap-1.5 text-[#D97706]"><span className="w-2 h-2 rounded-full bg-[#D97706]" />Rent</span>
        </>}
        questions={
          <ContextualQuestions
            questions={['Which category grew most?', 'Am I over budget?', 'Compare this quarter to last']}
            onAsk={(q) => handleModalAsk('Spending by Category', q)}
          />
        }
      >
        <SpendingByCategory expanded transactions={transactions} />
      </ChartModal>

      <LendingReport
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        transactions={transactions}
        accounts={accounts}
        chartData={chartData}
        totalBalance={totalBalance}
        totalSpend={totalSpend}
        totalIncome={totalIncome}
        netFlow={netFlow}
        monthlyBurn={monthlyBurn}
        runwayMonths={runwayMonths}
      />
    </div>
  );
}
