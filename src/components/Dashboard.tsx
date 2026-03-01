'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Transaction, Account, Recommendation, DailyFlow } from '@/lib/types';
import { exportTransactionsCSV, exportDashboardPDF, exportLoanReadinessReport } from '@/lib/export';
import { mockTransactions, mockAccounts } from '@/lib/mock-data';
import {
  Alert,
  BudgetThreshold,
  detectAnomalies,
  checkBudgetThresholds,
  loadBudgets,
  saveBudgets,
  loadDismissedAlerts,
  saveDismissedAlerts,
  suggestThresholds,
} from '@/lib/alerts';
import ChatSidebar from './ChatSidebar';
import TransactionList from './TransactionList';
import CategoryBreakdown from './CategoryBreakdown';
import ActionModal from './ActionModal';
import AlertBanner from './AlertBanner';

// ─── helpers ────────────────────────────────────────────────────────────────

function buildChartData(transactions: Transaction[]): DailyFlow[] {
  const now = new Date();
  const days: DailyFlow[] = [];

  // Historical: last 60 days
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

  // 7-day avg daily net for forecast
  const lastSevenNet = days.slice(-7).map((d) => d.income - d.spend);
  const avgNet = lastSevenNet.reduce((s, v) => s + v, 0) / lastSevenNet.length;

  let cumulative = 0;
  for (const d of days) {
    d.net = d.income - d.spend;
    cumulative += d.net;
    d.cumulative = cumulative;
  }

  // Forecast: next 30 days
  let forecastCumulative = cumulative;
  for (let i = 1; i <= 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    forecastCumulative += avgNet;
    days.push({
      date: d.toISOString().split('T')[0],
      spend: 0,
      income: 0,
      net: avgNet,
      cumulative,
      forecast: forecastCumulative,
    });
  }

  return days;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── severity config ─────────────────────────────────────────────────────────

const severityConfig = {
  critical: { border: 'border-red-500/40', bg: 'bg-red-500/10', badge: 'bg-red-500/20 text-red-400', dot: 'bg-red-400' },
  warning:  { border: 'border-amber-500/40', bg: 'bg-amber-500/10', badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-400' },
  info:     { border: 'border-indigo-500/40', bg: 'bg-indigo-500/10', badge: 'bg-indigo-500/20 text-indigo-400', dot: 'bg-indigo-400' },
};

const typeLabels: Record<string, string> = {
  cash_flow_forecast: 'Cash Flow Forecast',
  overdue_invoices:   'Overdue Invoices',
  anomalies:          'Anomaly Detection',
  subscription_audit: 'Subscription Audit',
  payment_timing:     'Payment Timing',
  loan_readiness:     'Loan Readiness',
};

const typeIcons: Record<string, string> = {
  cash_flow_forecast: '📈',
  overdue_invoices:   '🧾',
  anomalies:          '⚠️',
  subscription_audit: '🔄',
  payment_timing:     '⏰',
  loan_readiness:     '🏦',
};

// ─── custom tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900 p-3 text-xs shadow-xl">
      <div className="mb-2 font-medium text-slate-300">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-slate-400">
          <span className="capitalize">{p.name}:</span>
          <span className="font-semibold text-white">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── recommendation card ─────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  onAction,
}: {
  rec: Recommendation;
  onAction: (type: string, action: 'approve' | 'edit' | 'dismiss' | 'ask_ai') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = severityConfig[rec.severity];

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-5 transition-all relative group`}>
      {/* Dismiss X in corner */}
      <button
        onClick={() => onAction(rec.type, 'dismiss')}
        className="absolute top-3 right-3 rounded-lg p-1 text-slate-600 opacity-0 group-hover:opacity-100 transition-all hover:bg-white/5 hover:text-slate-300"
        title="Dismiss"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-start gap-3 min-w-0 pr-6">
        <span className="text-xl shrink-0 mt-0.5">{typeIcons[rec.type]}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
              {rec.severity.toUpperCase()}
            </span>
            <span className="text-xs text-slate-500">{typeLabels[rec.type]}</span>
          </div>
          <h3 className="text-sm font-semibold text-white leading-snug">{rec.title}</h3>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-400">{rec.description}</p>

      {/* Expandable reasoning */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        {expanded ? 'Hide' : 'Show'} reasoning
      </button>

      {expanded && (
        <div className="mt-3 rounded-lg border border-white/5 bg-black/20 p-3 text-xs leading-relaxed text-slate-400">
          <span className="font-medium text-slate-300">Reasoning: </span>
          {rec.reasoning}
        </div>
      )}

      {/* Suggested action */}
      <div className="mt-4 rounded-lg border border-white/5 bg-black/20 p-3 text-xs text-slate-300">
        <span className="font-medium text-white">Suggested action: </span>
        {rec.suggested_action}
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onAction(rec.type, 'edit')}
          className="flex-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 py-1.5 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-600/30"
        >
          ✎ Edit
        </button>
        <button
          onClick={() => onAction(rec.type, 'ask_ai')}
          className="flex-1 rounded-lg bg-violet-600/20 border border-violet-500/30 py-1.5 text-xs font-medium text-violet-400 transition-colors hover:bg-violet-600/30"
        >
          💬 Ask AI
        </button>
        <button
          onClick={() => onAction(rec.type, 'approve')}
          className="flex-1 rounded-lg bg-emerald-600/10 border border-emerald-500/20 py-1.5 text-xs font-medium text-emerald-400/80 transition-colors hover:bg-emerald-600/20"
        >
          ✓ Mark as Done
        </button>
      </div>
    </div>
  );
}

// ─── main dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('runwayai_approvals');
      return stored ? new Set(JSON.parse(stored).dismissed ?? []) : new Set();
    } catch { return new Set(); }
  });
  const [approved, setApproved] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('runwayai_approvals');
      return stored ? new Set(JSON.parse(stored).approved ?? []) : new Set();
    } catch { return new Set(); }
  });
  const [chartData, setChartData] = useState<DailyFlow[]>([]);
  const [analyzeStatus, setAnalyzeStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [editingRec, setEditingRec] = useState<Recommendation | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [chatInitialQuery, setChatInitialQuery] = useState<string | undefined>();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(loadDismissedAlerts);
  const [budgets, setBudgets] = useState<BudgetThreshold[]>(loadBudgets);

  // Load data from localStorage — fall back to mock data for development
  useEffect(() => {
    const raw = localStorage.getItem('runwayai_data');
    let tx: Transaction[];
    let accts: Account[];
    if (raw) {
      const parsed = JSON.parse(raw) as { transactions: Transaction[]; accounts: Account[] };
      tx = parsed.transactions;
      accts = parsed.accounts;
    } else {
      // No Plaid data — seed with mock restaurant data for development
      tx = mockTransactions;
      accts = mockAccounts;
      localStorage.setItem('runwayai_data', JSON.stringify({ transactions: tx, accounts: accts }));
    }
    setTransactions(tx);
    setAccounts(accts);
    setChartData(buildChartData(tx));
    setLoaded(true);
  }, [router]);

  const runAnalysis = useCallback(async (tx: Transaction[], accts: Account[]) => {
    setAnalyzeStatus('loading');
    setAnalyzeError(null);
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
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Something went wrong');
      setAnalyzeStatus('error');
    }
  }, []);

  useEffect(() => {
    if (loaded && transactions.length > 0 && analyzeStatus === 'idle') {
      runAnalysis(transactions, accounts);
    }
  }, [loaded, transactions, accounts, analyzeStatus, runAnalysis]);

  // Run alert detection when data is available
  useEffect(() => {
    if (!loaded || transactions.length === 0) return;
    // Auto-suggest budgets if none set
    if (budgets.length === 0) {
      const suggested = suggestThresholds(transactions);
      if (suggested.length > 0) {
        setBudgets(suggested);
        saveBudgets(suggested);
      }
    }
    const anomalies = detectAnomalies(transactions);
    const budgetAlerts = checkBudgetThresholds(transactions, budgets);
    const allAlerts = [...anomalies, ...budgetAlerts].filter((a) => !dismissedAlerts.has(a.id));
    setAlerts(allAlerts);
  }, [loaded, transactions, budgets, dismissedAlerts]);

  const handleDismissAlert = useCallback((id: string) => {
    setDismissedAlerts((prev) => {
      const next = new Set([...prev, id]);
      saveDismissedAlerts(next);
      return next;
    });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleUpdateBudgets = useCallback((newBudgets: BudgetThreshold[]) => {
    setBudgets(newBudgets);
    saveBudgets(newBudgets);
  }, []);

  // Persist approval state to localStorage
  useEffect(() => {
    localStorage.setItem('runwayai_approvals', JSON.stringify({
      approved: [...approved],
      dismissed: [...dismissed],
    }));
  }, [approved, dismissed]);

  const handleAction = useCallback((type: string, action: 'approve' | 'edit' | 'dismiss' | 'ask_ai') => {
    if (action === 'dismiss') {
      setDismissed((prev) => new Set([...prev, type]));
    } else if (action === 'approve') {
      setApproved((prev) => new Set([...prev, type]));
    } else if (action === 'edit') {
      const rec = recommendations.find((r) => r.type === type);
      if (rec) setEditingRec(rec);
    } else if (action === 'ask_ai') {
      const rec = recommendations.find((r) => r.type === type);
      if (rec) {
        setChatInitialQuery(`Tell me more about: ${rec.title}. ${rec.description} What specific details can you share from my transaction data?`);
        setChatOpen(true);
      }
    }
  }, [recommendations]);

  // ── stats ────────────────────────────────────────────────────────────────
  const totalBalance = accounts.reduce((s, a) => s + (a.balances.current ?? 0), 0);
  const totalSpend = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalIncome = Math.abs(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const netFlow = totalIncome - totalSpend;

  // Cash runway: months of cash remaining at current burn rate
  const monthlyBurn = totalSpend / 3; // 90 days = 3 months
  const runwayMonths = monthlyBurn > 0 ? totalBalance / monthlyBurn : Infinity;
  const runwayLabel = runwayMonths === Infinity ? 'N/A' : runwayMonths < 1 ? '< 1 mo' : `${runwayMonths.toFixed(1)} mo`;
  const runwayColor = runwayMonths < 3 ? 'text-red-400' : runwayMonths < 6 ? 'text-amber-400' : 'text-emerald-400';

  const visibleRecs = recommendations.filter((r) => !dismissed.has(r.type));
  const criticalCount = visibleRecs.filter((r) => r.severity === 'critical').length;

  // Chart: last 60 days + 30 day forecast
  const chartDisplayData = chartData.map((d) => ({
    ...d,
    date: formatDate(d.date),
  }));
  const historicalEnd = 59; // index where history ends
  const todayDate = formatDate(new Date().toISOString().split('T')[0]);

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080B14]">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading your dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080B14] font-sans">
      {/* Gradient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-indigo-600/8 blur-[120px]" />
        <div className="absolute top-20 right-0 h-[300px] w-[400px] rounded-full bg-violet-600/6 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between border-b border-white/5 px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-lg shadow-indigo-500/30">
            R
          </div>
          <span className="text-sm font-semibold text-white">RunwayAI</span>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-400">Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              {criticalCount} critical
            </div>
          )}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/10"
            >
              Export
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-white/10 bg-slate-900 py-1 shadow-xl z-20">
                <button
                  onClick={() => { exportTransactionsCSV(transactions); setShowExportMenu(false); }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5"
                >
                  Download CSV
                </button>
                <button
                  onClick={() => { exportDashboardPDF(transactions, accounts); setShowExportMenu(false); }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5"
                >
                  Download PDF Report
                </button>
                <button
                  onClick={() => { exportLoanReadinessReport(transactions, accounts); setShowExportMenu(false); }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5"
                >
                  🏦 Loan Readiness Report
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('runwayai_data');
              router.push('/');
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/10"
          >
            Disconnect
          </button>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-8">

        {/* ── Alert Banner ─────────────────────────────────────────────── */}
        <AlertBanner alerts={alerts} onDismiss={handleDismissAlert} />

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            { label: 'Total Balance', value: formatCurrency(totalBalance), sub: `${accounts.length} accounts`, color: 'text-white' },
            { label: '90-Day Spend', value: formatCurrency(totalSpend), sub: `${transactions.filter((t) => t.amount > 0).length} transactions`, color: 'text-red-400' },
            { label: '90-Day Income', value: formatCurrency(totalIncome), sub: `${transactions.filter((t) => t.amount < 0).length} credits`, color: 'text-emerald-400' },
            {
              label: 'Net Cash Flow',
              value: `${netFlow >= 0 ? '+' : ''}${formatCurrency(netFlow)}`,
              sub: 'last 90 days',
              color: netFlow >= 0 ? 'text-emerald-400' : 'text-red-400',
            },
            {
              label: 'Cash Runway',
              value: runwayLabel,
              sub: monthlyBurn > 0 ? `${formatCurrency(monthlyBurn)}/mo burn` : 'no expenses',
              color: runwayColor,
            },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border ${s.label === 'Cash Runway' && runwayMonths < 3 ? 'border-red-500/30 bg-red-500/5' : 'border-white/5 bg-slate-900/60'} p-5`}>
              <div className="text-xs font-medium uppercase tracking-widest text-slate-500">{s.label}</div>
              <div className={`mt-2 text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="mt-1 text-xs text-slate-600">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Cash flow chart ─────────────────────────────────────────────── */}
        <div data-pdf-chart className="mb-8 rounded-xl border border-white/5 bg-slate-900/60 p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Cash Flow Timeline</h2>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded bg-indigo-500/60" />
                Historical
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded border border-dashed border-violet-400/60" />
                Forecast
              </span>
            </div>
          </div>
          <p className="mb-6 text-xs text-slate-500">60-day history + 30-day projection (based on avg daily net)</p>

          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartDisplayData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="gradHistorical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={14}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine
                x={todayDate}
                stroke="rgba(255,255,255,0.15)"
                strokeDasharray="4 4"
                label={{ value: 'Today', fill: '#64748b', fontSize: 10, position: 'insideTopRight' }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                name="cumulative net"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#gradHistorical)"
                dot={false}
                activeDot={{ r: 4, fill: '#6366f1' }}
              />
              <Area
                type="monotone"
                dataKey="forecast"
                name="forecast"
                stroke="#a78bfa"
                strokeWidth={2}
                strokeDasharray="5 4"
                fill="url(#gradForecast)"
                dot={false}
                activeDot={{ r: 4, fill: '#a78bfa' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Category Breakdown + Transaction List ──────────────────────── */}
        <div className="mb-8 grid gap-8 lg:grid-cols-2">
          <CategoryBreakdown transactions={transactions} budgets={budgets} onUpdateBudgets={handleUpdateBudgets} />
          <TransactionList transactions={transactions} />
        </div>

        {/* ── AI Recommendations ──────────────────────────────────────────── */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">AI Recommendations</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {analyzeStatus === 'loading' && 'Analysing your transactions with GPT-4o…'}
                {analyzeStatus === 'done' && `${visibleRecs.length} active recommendations`}
                {analyzeStatus === 'error' && analyzeError}
              </p>
            </div>
            {analyzeStatus === 'error' && (
              <button
                onClick={() => { setAnalyzeStatus('idle'); }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
              >
                Retry
              </button>
            )}
          </div>

          {analyzeStatus === 'loading' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 animate-pulse rounded-xl border border-white/5 bg-slate-900/60"
                />
              ))}
            </div>
          )}

          {analyzeStatus === 'done' && visibleRecs.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleRecs.map((rec) => (
                <RecommendationCard
                  key={rec.type}
                  rec={approved.has(rec.type) ? { ...rec, severity: 'info' } : rec}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}

          {analyzeStatus === 'done' && dismissed.size > 0 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setDismissed(new Set())}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                Restore {dismissed.size} dismissed recommendation{dismissed.size > 1 ? 's' : ''}
              </button>
            </div>
          )}

          {analyzeStatus === 'done' && visibleRecs.length === 0 && dismissed.size > 0 && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-white/5 bg-slate-900/60 py-16 text-center">
              <span className="text-3xl">✓</span>
              <p className="text-sm text-slate-400">All recommendations dismissed.</p>
              <button
                onClick={() => setDismissed(new Set())}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Restore all
              </button>
            </div>
          )}
        </div>
      </main>

      {editingRec && (
        <ActionModal
          recommendation={editingRec}
          transactions={transactions}
          accounts={accounts}
          onClose={() => setEditingRec(null)}
          onApprove={(type) => setApproved((prev) => new Set([...prev, type]))}
        />
      )}

      <ChatSidebar
        transactions={transactions}
        accounts={accounts}
        isOpen={chatOpen}
        onToggle={() => setChatOpen((v) => !v)}
        alerts={alerts}
        initialQuery={chatInitialQuery}
        onQueryConsumed={() => setChatInitialQuery(undefined)}
      />
    </div>
  );
}
