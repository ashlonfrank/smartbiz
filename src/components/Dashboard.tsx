'use client';

import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Download, FileText, FileSpreadsheet } from 'lucide-react';
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
import { Transaction, Account, Recommendation, DailyFlow, BusinessProfile } from '@/lib/types';
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
import InsightsPanel from './InsightsPanel';
import ChartModal from './ChartModal';
import GrowthChartModal from './GrowthChartModal';
import TransactionList from './TransactionList';
import CategoryBreakdown from './CategoryBreakdown';
import ActionModal from './ActionModal';

// ─── helpers ────────────────────────────────────────────────────────────────

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

// ─── chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#E8E8E6] bg-white px-4 py-3 text-xs shadow-xl">
      <div className="mb-2 font-semibold text-[#1A1A1A]">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-[#6B6B6B]">
          <span className="capitalize">{p.name}:</span>
          <span className="font-bold text-[#1A1A1A]">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function GrowthTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const entry = payload.find((p) => p.value != null);
  if (!entry) return null;
  return (
    <div className="rounded-lg border border-[#E8E8E6] bg-white px-3 py-2 text-xs shadow-xl">
      <div className="font-semibold text-[#1A1A1A]">{label}</div>
      <div className="text-[#6B6B6B] mt-0.5">Revenue: <span className="font-bold text-[#1A1A1A]">{formatCurrency(entry.value)}</span></div>
    </div>
  );
}

// ─── main dashboard ───────────────────────────────────────────────────────────

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
  const [editingRec, setEditingRec] = useState<Recommendation | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [chartModalPrompt, setChartModalPrompt] = useState<string | undefined>();
  const [mobileInsightsOpen, setMobileInsightsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(loadDismissedAlerts);
  const [budgets, setBudgets] = useState<BudgetThreshold[]>(loadBudgets);
  const [txOpen, setTxOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [syncedAt] = useState(() => new Date());
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [externalPrompt, setExternalPrompt] = useState<string | undefined>();
  const [growthModalOpen, setGrowthModalOpen] = useState(false);
  const [growthModalPrompt, setGrowthModalPrompt] = useState<string | undefined>();

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
      tx = mockTransactions;
      accts = mockAccounts;
      localStorage.setItem('runwayai_data', JSON.stringify({ transactions: tx, accounts: accts }));
    }
    setTransactions(tx);
    setAccounts(accts);
    setChartData(buildChartData(tx));

    // Load business profile
    try {
      const profileRaw = localStorage.getItem('runwayai_profile');
      if (profileRaw) setBusinessProfile(JSON.parse(profileRaw));
    } catch { /* ignore */ }

    setLoaded(true);
  }, [router]);

  const runAnalysis = useCallback(async (tx: Transaction[], accts: Account[]) => {
    setAnalyzeStatus('loading');
    setAnalyzeError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: tx, accounts: accts, businessProfile }),
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

  useEffect(() => {
    if (!loaded || transactions.length === 0) return;
    if (budgets.length === 0) {
      const suggested = suggestThresholds(transactions);
      if (suggested.length > 0) { setBudgets(suggested); saveBudgets(suggested); }
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

  useEffect(() => {
    localStorage.setItem('runwayai_approvals', JSON.stringify({
      approved: [...approved],
      dismissed: [...dismissed],
    }));
  }, [approved, dismissed]);

  // ── stats ─────────────────────────────────────────────────────────────────
  const totalBalance = accounts.reduce((s, a) => s + (a.balances.current ?? 0), 0);
  const totalSpend = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalIncome = Math.abs(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const netFlow = totalIncome - totalSpend;
  const monthlyBurn = totalSpend / 3;
  const runwayMonths = monthlyBurn > 0 ? totalBalance / monthlyBurn : Infinity;
  const runwayLabel = runwayMonths === Infinity ? 'N/A' : runwayMonths < 1 ? '< 1 mo' : `${runwayMonths.toFixed(1)} mo`;
  const runwayDanger = runwayMonths < 3;

  // Safety floor = 1 week of burn (~1 month / 4)
  const safetyFloor = Math.round(monthlyBurn / 4);

  const visibleRecs = recommendations.filter((r) => !dismissed.has(r.type) && !approved.has(r.type));

  const chartDisplayData = chartData.map((d) => ({ ...d, date: formatDate(d.date) }));
  const todayDate = formatDate(new Date().toISOString().split('T')[0]);

  // Dynamic chart prompt pills from real data
  const chartPrompts = useMemo(() => {
    const spendTx = transactions.filter((t) => t.amount > 0);
    const merchantTotals: Record<string, number> = {};
    for (const tx of spendTx) {
      const key = tx.merchant_name ?? tx.name;
      merchantTotals[key] = (merchantTotals[key] ?? 0) + tx.amount;
    }
    const topMerchant =
      Object.entries(merchantTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'my top vendor';

    const historicalDips = chartData.filter((d) => !d.forecast && d.net < 0);
    historicalDips.sort((a, b) => a.net - b.net);
    const dipDate = historicalDips[0] ? formatDate(historicalDips[0].date) : 'recently';

    return [
      `Why did my balance dip on ${dipDate}?`,
      `Can I afford a bigger ${topMerchant} order next month?`,
      'Will I stay above my reserve next quarter?',
    ];
  }, [transactions, chartData]);

  // ── Growth projection ─────────────────────────────────────────────────────
  const showGrowthProjection = businessProfile?.priorities?.some(
    (p) => p === 'Hire or expand' || p === 'Forecast growth'
  ) ?? false;

  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const buckets = [0, 0, 0]; // [oldest, middle, newest]
    for (const t of transactions.filter((t) => t.amount < 0)) {
      const daysAgo = Math.floor((now.getTime() - new Date(t.date).getTime()) / 86400000);
      if (daysAgo <= 30) buckets[2] += Math.abs(t.amount);
      else if (daysAgo <= 60) buckets[1] += Math.abs(t.amount);
      else buckets[0] += Math.abs(t.amount);
    }
    return buckets;
  }, [transactions]);

  const growthProjectionData = useMemo(() => {
    const [m1, m2, m3] = monthlyRevenue;
    if (!m1 || !m3) return [];
    const rawRate = ((m3 - m1) / m1) / 2;
    const clampedRate = Math.max(-0.15, Math.min(0.15, rawRate));

    const now = new Date();
    const monthLabel = (offset: number) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    };

    const data: { month: string; historical?: number; projected?: number }[] = [
      { month: monthLabel(-2), historical: Math.round(m1) },
      { month: monthLabel(-1), historical: Math.round(m2) },
      { month: monthLabel(0),  historical: Math.round(m3), projected: Math.round(m3) },
    ];
    let current = m3;
    for (let i = 1; i <= 21; i++) {
      current = current * (1 + clampedRate);
      data.push({ month: monthLabel(i), projected: Math.round(current) });
    }
    return data;
  }, [monthlyRevenue]);

  const growthPrompts = useMemo(() => {
    const targetRevenue = monthlyRevenue[2] ? formatCurrency(monthlyRevenue[2] * 2) : '$X';
    const prompts = [`When will I hit ${targetRevenue}/month in revenue?`];
    if (businessProfile?.priorities.includes('Hire or expand')) {
      prompts.push('How many hires can I afford this quarter?');
    }
    return prompts;
  }, [monthlyRevenue, businessProfile]);

  const statCards = [
    { label: 'Total Balance', value: formatCurrency(totalBalance), sub: `${accounts.length} accounts`, danger: false },
    { label: '90-Day Spend', value: formatCurrency(totalSpend), sub: `${transactions.filter((t) => t.amount > 0).length} transactions`, danger: false },
    { label: '90-Day Income', value: formatCurrency(totalIncome), sub: `${transactions.filter((t) => t.amount < 0).length} deposits`, danger: false },
    { label: 'Net Cash Flow', value: `${netFlow >= 0 ? '+' : ''}${formatCurrency(netFlow)}`, sub: 'last 90 days', danger: netFlow < 0, tooltip: 'Total income minus total expenses over the last 90 days' },
    { label: 'Cash Runway', value: runwayLabel, sub: monthlyBurn > 0 ? `${formatCurrency(monthlyBurn)}/mo burn` : 'no expenses', danger: runwayDanger, tooltip: 'How long your current balance will last at your current burn rate' },
  ];

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="flex items-center gap-3 text-[#9B9B9B]">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading your dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] bg-noise font-sans text-[#1A1A1A]">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#FAFAF8] border-b border-[#E8E8E6] px-4 md:px-8 py-3 flex items-center justify-between">
        <span className="font-bold text-[#1A1A1A] text-sm tracking-tight">RunwayAI</span>
        <div className="flex items-center gap-3">
          {/* Account chip + dropdown */}
          {accounts.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => { setShowAccountMenu((v) => !v); setShowExportMenu(false); }}
                  className="flex items-center gap-1.5 rounded-md border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-1.5 text-xs text-[#6B6B6B] hover:bg-[#F0F0EE] transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="max-w-[140px] truncate">{accounts[0].name}</span>
                  <ChevronRight className="h-3 w-3 rotate-90 text-[#9B9B9B]" />
                </button>
                <AnimatePresence>
                  {showAccountMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-1 w-44 rounded-lg border border-[#E8E8E6] bg-white py-1 shadow-xl z-20"
                    >
                      <button
                        onClick={() => setShowAccountMenu(false)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-[#1A1A1A] hover:bg-[#F5F5F3]"
                      >
                        <span className="text-[#9B9B9B]">+</span>
                        Add an account
                      </button>
                      <button
                        onClick={() => { localStorage.removeItem('runwayai_data'); localStorage.removeItem('runwayai_profile'); router.push('/'); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-red-500 hover:bg-red-50"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                        </svg>
                        Remove account
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <span className="text-[10px] text-[#9B9B9B]">
                · Synced {Math.round((Date.now() - syncedAt.getTime()) / 60000) < 1
                  ? 'just now'
                  : `${Math.round((Date.now() - syncedAt.getTime()) / 60000)}m ago`}
              </span>
            </div>
          )}
          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowExportMenu((v) => !v); setShowAccountMenu(false); }}
              className="flex items-center gap-1.5 rounded-md border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-1.5 text-xs font-medium text-[#1A1A1A] transition-colors hover:bg-[#F0F0EE]"
            >
              <Download className="h-3.5 w-3.5" />
              Export
              <ChevronRight className="h-3 w-3 rotate-90 text-[#9B9B9B]" />
            </button>
            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-[#E8E8E6] bg-white py-1 shadow-xl z-20"
                >
                  <button
                    onClick={() => { exportTransactionsCSV(transactions); setShowExportMenu(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-[#1A1A1A] hover:bg-[#F5F5F3]"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-[#9B9B9B]" />
                    Download CSV
                  </button>
                  <button
                    onClick={() => { exportDashboardPDF(transactions, accounts); setShowExportMenu(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-[#1A1A1A] hover:bg-[#F5F5F3]"
                  >
                    <FileText className="h-3.5 w-3.5 text-[#9B9B9B]" />
                    Download PDF Report
                  </button>
                  <button
                    onClick={() => { exportLoanReadinessReport(transactions, accounts); setShowExportMenu(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-[#0D7C66] hover:bg-[#E8F5F0]"
                  >
                    <span className="text-[#0D7C66]">✦</span>
                    Loan Readiness Report
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      {/* ── Main two-column layout ────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col lg:flex-row relative">

        {/* Frame lines */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-[#E8E8E6]" />
        <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-px bg-[#E8E8E6]" />

        {/* ── LEFT COLUMN ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 lg:pr-8 pb-12">


          {/* Zone 1: Stat Cards */}
          <div className="pt-2 lg:pt-6 pb-8">
            {/* Desktop: flat row with dividers */}
            <div className="hidden lg:flex items-start w-full">
              {statCards.map((s, i) => (
                <Fragment key={s.label}>
                  {i > 0 && <div className="self-stretch w-px shrink-0 bg-[#E8E8E6] mx-4" />}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.06, ease: 'easeOut' }}
                    className="flex-1 min-w-0 py-1"
                  >
                    <div className={`flex items-center gap-2 whitespace-nowrap text-[10px] uppercase tracking-wider ${s.danger ? 'text-[#D94F4F]/80' : 'text-[#9B9B9B]'}`}>
                      {s.label}
                      {'tooltip' in s && s.tooltip && (
                        <div className="group relative flex-shrink-0 normal-case tracking-normal">
                          <span className="flex h-[7px] w-[7px] cursor-default select-none items-center justify-center rounded-full border border-[#D8D8D6] text-[#B8B8B8]" style={{ fontSize: '5px', lineHeight: 1 }}>?</span>
                          <div className="pointer-events-none absolute right-0 bottom-full mb-1.5 z-50 w-44 whitespace-normal rounded-lg border border-[#E8E8E6] bg-white px-3 py-2 text-[10px] text-[#6B6B6B] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 leading-relaxed">
                            {s.tooltip}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={`mt-2 text-xl font-bold tabular-nums ${s.danger ? 'text-[#D94F4F]' : 'text-[#1A1A1A]'}`}>
                      {s.value}
                    </div>
                    <div className={`mt-1 text-[10px] ${s.danger ? 'text-[#D94F4F]/60' : 'text-[#9B9B9B]'}`}>
                      {s.sub}
                    </div>
                  </motion.div>
                </Fragment>
              ))}
            </div>
            {/* Mobile: grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:hidden">
              {statCards.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06, ease: 'easeOut' }}
                >
                  <div className={`flex items-center gap-2 whitespace-nowrap text-[10px] uppercase tracking-wider ${s.danger ? 'text-[#D94F4F]/80' : 'text-[#9B9B9B]'}`}>
                    {s.label}
                    {'tooltip' in s && s.tooltip && (
                      <div className="group relative flex-shrink-0 normal-case tracking-normal">
                        <span className="flex h-[7px] w-[7px] cursor-default select-none items-center justify-center rounded-full border border-[#D8D8D6] text-[#B8B8B8]" style={{ fontSize: '5px', lineHeight: 1 }}>?</span>
                        <div className="pointer-events-none absolute right-0 bottom-full mb-1.5 z-50 w-44 whitespace-normal rounded-lg border border-[#E8E8E6] bg-white px-3 py-2 text-[10px] text-[#6B6B6B] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 leading-relaxed">
                          {s.tooltip}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`mt-1.5 text-xl font-bold tabular-nums ${s.danger ? 'text-[#D94F4F]' : 'text-[#1A1A1A]'}`}>
                    {s.value}
                  </div>
                  <div className={`mt-0.5 text-[10px] ${s.danger ? 'text-[#D94F4F]/60' : 'text-[#9B9B9B]'}`}>
                    {s.sub}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="-mx-4 md:-mx-8 border-t border-[#E8E8E6]" />

          {/* Zone 2: Cash Flow Chart */}
          <div data-pdf-chart className="py-8">
            <div className="rounded-2xl border border-[#E8E8E6] bg-white px-6 py-5">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#1A1A1A] font-mono">
                  Cash Flow Timeline
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-[10px] text-[#9B9B9B]">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-px w-4 bg-[#0D7C66]" />
                      Historical
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-px w-4 border-t border-dashed border-[#6BB5A5]" />
                      Forecast
                    </span>
                  </div>
                  {/* Expand button */}
                  <button
                    onClick={() => { setChartModalPrompt(undefined); setChartModalOpen(true); }}
                    className="rounded-lg p-1.5 text-[#9B9B9B] transition-colors hover:bg-[#F5F5F3] hover:text-[#1A1A1A]"
                    title="Expand chart"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="mb-4 text-[10px] text-[#9B9B9B]">60-day history + 30-day projection</p>

              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartDisplayData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradHistorical" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0D7C66" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#0D7C66" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6BB5A5" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#6BB5A5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9B9B9B', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={14}
                  />
                  <YAxis
                    tick={{ fill: '#9B9B9B', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine
                    x={todayDate}
                    stroke="rgba(0,0,0,0.15)"
                    strokeDasharray="4 4"
                    label={{ value: 'Today', fill: '#9B9B9B', fontSize: 10, position: 'insideTopRight' }}
                  />
                  {/* Safety floor */}
                  <ReferenceLine
                    y={safetyFloor}
                    stroke="#D97706"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={{
                      value: `Reserve (${formatCurrency(safetyFloor)})`,
                      fill: '#D97706',
                      fontSize: 9,
                      position: 'insideTopRight',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    name="cumulative net"
                    stroke="#0D7C66"
                    strokeWidth={2}
                    fill="url(#gradHistorical)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#0D7C66' }}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    name="forecast"
                    stroke="#6BB5A5"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    fill="url(#gradForecast)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#6BB5A5' }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Chart AI prompt pills */}
            <div className="mt-3 flex flex-wrap gap-2">
              {chartPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setChartModalPrompt(prompt);
                    setChartModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-2 text-xs text-[#6B6B6B] hover:bg-[#F0F0EE] hover:text-[#1A1A1A] transition-colors"
                >
                  <span className="text-[#0D7C66] text-[10px]">✦</span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="-mx-4 md:-mx-8 border-t border-[#E8E8E6]" />

          {analyzeStatus === 'error' && (
            <div className="py-4 flex items-center justify-between">
              <p className="text-xs text-[#D94F4F]">{analyzeError}</p>
              <button
                onClick={() => setAnalyzeStatus('idle')}
                className="rounded-md border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-1.5 text-xs text-[#1A1A1A] hover:bg-[#F0F0EE]"
              >
                Retry
              </button>
            </div>
          )}

          {/* Zone 3: Transactions (collapsible) */}
          <div className="py-4">
            <button
              onClick={() => setTxOpen((v) => !v)}
              className="w-full flex items-center justify-between py-3 px-4 -mx-4 rounded-lg hover:bg-[#F0F0EE] transition-all active:opacity-80 group"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm uppercase tracking-widest text-[#9B9B9B] font-semibold font-mono">
                  Transactions
                </span>
                {transactions.length > 0 && (
                  <span className="text-[10px] text-[#9B9B9B]">{transactions.length} total</span>
                )}
              </div>
              <ChevronRight
                className={`h-4 w-4 text-[#9B9B9B] transition-transform duration-200 ${txOpen ? 'rotate-90' : ''}`}
              />
            </button>
            <AnimatePresence>
              {txOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-2">
                    <TransactionList transactions={transactions} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="-mx-4 md:-mx-8 border-t border-[#E8E8E6]" />

          {/* Zone 4: Spending by Category (collapsible) */}
          <div className="py-4">
            <button
              onClick={() => setCatOpen((v) => !v)}
              className="w-full flex items-center justify-between py-3 px-4 -mx-4 rounded-lg hover:bg-[#F0F0EE] transition-all active:opacity-80 group"
            >
              <span className="text-sm uppercase tracking-widest text-[#9B9B9B] font-semibold font-mono">
                Spending by Category
              </span>
              <ChevronRight
                className={`h-4 w-4 text-[#9B9B9B] transition-transform duration-200 ${catOpen ? 'rotate-90' : ''}`}
              />
            </button>
            <AnimatePresence>
              {catOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-2">
                    <CategoryBreakdown
                      transactions={transactions}
                      budgets={budgets}
                      onUpdateBudgets={handleUpdateBudgets}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Zone 5: Growth Projection (conditional) ────────────────── */}
          {showGrowthProjection && growthProjectionData.length > 0 && (
            <>
              {/* Divider */}
              <div className="-mx-4 md:-mx-8 border-t border-[#E8E8E6]" />
              <div className="py-8">
                <div className="rounded-2xl border border-[#E8E8E6] bg-white px-6 py-5">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[#1A1A1A] font-mono">
                      Growth Projection
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-3 text-[10px] text-[#9B9B9B]">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-px w-4 bg-[#0D7C66]" />
                          Historical
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-px w-4 border-t border-dashed border-[#6BB5A5]" />
                          Projected
                        </span>
                      </div>
                      <button
                        onClick={() => { setGrowthModalPrompt(undefined); setGrowthModalOpen(true); }}
                        className="rounded-lg p-1.5 text-[#9B9B9B] transition-colors hover:bg-[#F5F5F3] hover:text-[#1A1A1A]"
                        title="Expand chart"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#9B9B9B] mb-4">
                    24-month revenue trajectory · based on your current trend
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={growthProjectionData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradGrowthHistorical" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0D7C66" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#0D7C66" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradGrowthProjected" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6BB5A5" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#6BB5A5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: '#9B9B9B', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval={5}
                      />
                      <YAxis
                        tick={{ fill: '#9B9B9B', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                      />
                      <Tooltip content={<GrowthTooltip />} />
                      <ReferenceLine
                        x={new Date().toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                        stroke="rgba(0,0,0,0.15)"
                        strokeDasharray="4 4"
                        label={{ value: 'Now', fill: '#9B9B9B', fontSize: 10, position: 'insideTopRight' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="historical"
                        stroke="#0D7C66"
                        strokeWidth={2}
                        fill="url(#gradGrowthHistorical)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#0D7C66' }}
                        connectNulls
                        isAnimationActive={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="projected"
                        stroke="#6BB5A5"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        fill="url(#gradGrowthProjected)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#6BB5A5' }}
                        connectNulls
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {/* Growth prompt pills */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {growthPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => { setGrowthModalPrompt(prompt); setGrowthModalOpen(true); }}
                      className="flex items-center gap-1.5 rounded-full border border-[#E8E8E6] bg-[#F5F5F3] px-3 py-2 text-xs text-[#6B6B6B] hover:bg-[#F0F0EE] hover:text-[#1A1A1A] transition-colors"
                    >
                      <span className="text-[#0D7C66] text-[10px]">✦</span>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Column divider ─────────────────────────────────────────────── */}
        <div className="hidden lg:block w-px bg-[#E8E8E6] self-stretch" />

        {/* ── RIGHT COLUMN — Insights Panel ──────────────────────────────── */}
        <div className="hidden lg:flex lg:w-[380px] shrink-0 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:overflow-hidden flex-col">
          <InsightsPanel
            recommendations={recommendations}
            transactions={transactions}
            accounts={accounts}
            alerts={alerts}
            approved={approved}
            dismissed={dismissed}
            analyzeStatus={analyzeStatus}
            businessProfile={businessProfile}
            externalPrompt={externalPrompt}
            onExternalPromptConsumed={() => setExternalPrompt(undefined)}
            onApprove={(type) => setApproved((prev) => new Set([...prev, type]))}
            onDismiss={(type) => setDismissed((prev) => new Set([...prev, type]))}
            onTakeAction={(rec) => setEditingRec(rec)}
          />
        </div>
      </div>

      {/* ── Mobile insights FAB ─────────────────────────────────────────────── */}
      <button
        onClick={() => setMobileInsightsOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#0D7C66] text-white shadow-lg shadow-[#0D7C66]/30 transition-all hover:bg-[#0A6B58] hover:-translate-y-0.5"
        title="View Insights"
      >
        <span className="text-lg">✦</span>
      </button>

      {/* Mobile InsightsPanel overlay */}
      <AnimatePresence>
        {mobileInsightsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#FAFAF8]"
          >
            <div className="flex items-center justify-between border-b border-[#E8E8E6] px-4 py-3 shrink-0">
              <span className="text-sm font-semibold text-[#1A1A1A]">✦ RunwayAI Insights</span>
              <button
                onClick={() => setMobileInsightsOpen(false)}
                className="rounded-lg p-1.5 text-[#9B9B9B] hover:bg-[#F5F5F3] hover:text-[#1A1A1A] transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <InsightsPanel
                recommendations={recommendations}
                transactions={transactions}
                accounts={accounts}
                alerts={alerts}
                approved={approved}
                dismissed={dismissed}
                analyzeStatus={analyzeStatus}
                externalPrompt={externalPrompt}
                onExternalPromptConsumed={() => setExternalPrompt(undefined)}
                onApprove={(type) => setApproved((prev) => new Set([...prev, type]))}
                onDismiss={(type) => setDismissed((prev) => new Set([...prev, type]))}
                onTakeAction={(rec) => { setEditingRec(rec); setMobileInsightsOpen(false); }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chart Modal ─────────────────────────────────────────────────────── */}
      {chartModalOpen && (
        <ChartModal
          chartData={chartData}
          transactions={transactions}
          accounts={accounts}
          initialPrompt={chartModalPrompt}
          safetyFloor={safetyFloor}
          onClose={() => { setChartModalOpen(false); setChartModalPrompt(undefined); }}
        />
      )}

      {/* ── Growth Chart Modal ──────────────────────────────────────────────── */}
      {growthModalOpen && (
        <GrowthChartModal
          growthProjectionData={growthProjectionData}
          growthPrompts={growthPrompts}
          transactions={transactions}
          accounts={accounts}
          businessProfile={businessProfile}
          initialPrompt={growthModalPrompt}
          onClose={() => { setGrowthModalOpen(false); setGrowthModalPrompt(undefined); }}
        />
      )}

      {/* ── Action Modal ────────────────────────────────────────────────────── */}
      {editingRec && (
        <ActionModal
          recommendation={editingRec}
          transactions={transactions}
          accounts={accounts}
          onClose={() => setEditingRec(null)}
          onApprove={(type) => setApproved((prev) => new Set([...prev, type]))}
        />
      )}
    </div>
  );
}
