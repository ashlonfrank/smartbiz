import { Transaction, Account } from './types';

// ─── Loan Readiness Score ──────────────────────────────────────────────────

export interface LoanScoreComponent {
  score: number;
  label: string;
}

export interface LoanScore {
  overall: number;
  components: {
    cashRunway: LoanScoreComponent;
    revenueConsistency: LoanScoreComponent;
    expenseRatio: LoanScoreComponent;
    growthTrend: LoanScoreComponent;
    transactionVolume: LoanScoreComponent;
  };
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';
  summary: string;
}

export function calculateLoanScore(transactions: Transaction[], accounts: Account[]): LoanScore {
  const totalBalance = accounts.reduce((s, a) => s + (a.balances.current ?? 0), 0);
  const spendTx = transactions.filter((t) => t.amount > 0);
  const incomeTx = transactions.filter((t) => t.amount < 0);
  const totalSpend = spendTx.reduce((s, t) => s + t.amount, 0);
  const totalIncome = Math.abs(incomeTx.reduce((s, t) => s + t.amount, 0));
  const monthlyBurn = totalSpend / 3;

  // Split into 3 monthly buckets
  const now = new Date();
  const months: { revenue: number; expenses: number }[] = [
    { revenue: 0, expenses: 0 },
    { revenue: 0, expenses: 0 },
    { revenue: 0, expenses: 0 },
  ];
  for (const tx of transactions) {
    const txDate = new Date(tx.date);
    const daysAgo = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
    const bucket = Math.min(Math.floor(daysAgo / 30), 2);
    if (tx.amount > 0) months[bucket].expenses += tx.amount;
    else months[bucket].revenue += Math.abs(tx.amount);
  }

  // 1. Cash Runway (25%)
  const runwayMonths = monthlyBurn > 0 ? totalBalance / monthlyBurn : 12;
  const cashRunwayScore = Math.min(100, Math.round((runwayMonths / 6) * 100));
  const cashRunwayLabel = runwayMonths >= 6 ? `${runwayMonths.toFixed(1)} months — strong` :
    runwayMonths >= 3 ? `${runwayMonths.toFixed(1)} months — adequate` :
    `${runwayMonths.toFixed(1)} months — low`;

  // 2. Revenue Consistency (25%)
  const monthlyRevenues = months.map((m) => m.revenue);
  const meanRevenue = monthlyRevenues.reduce((s, v) => s + v, 0) / 3;
  const stddev = Math.sqrt(monthlyRevenues.reduce((s, v) => s + (v - meanRevenue) ** 2, 0) / 3);
  const cv = meanRevenue > 0 ? stddev / meanRevenue : 1;
  const revenueConsistencyScore = Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));
  const revenueConsistencyLabel = cv < 0.15 ? 'Very consistent' :
    cv < 0.3 ? 'Moderately consistent' : 'High variability';

  // 3. Expense-to-Revenue Ratio (20%)
  const expenseRatio = totalIncome > 0 ? totalSpend / totalIncome : 2;
  const expenseRatioScore = Math.round(Math.max(0, Math.min(100, (1 - (expenseRatio - 0.5)) * 100)));
  const expenseRatioLabel = expenseRatio < 0.7 ? `${(expenseRatio * 100).toFixed(0)}% — healthy` :
    expenseRatio < 1 ? `${(expenseRatio * 100).toFixed(0)}% — moderate` :
    `${(expenseRatio * 100).toFixed(0)}% — exceeds revenue`;

  // 4. Growth Trend (15%) — compare most recent month vs oldest month
  const recentRevenue = months[0].revenue;
  const oldestRevenue = months[2].revenue;
  const growthPct = oldestRevenue > 0 ? ((recentRevenue - oldestRevenue) / oldestRevenue) * 100 : 0;
  const growthScore = Math.round(Math.max(0, Math.min(100, 50 + growthPct)));
  const growthLabel = growthPct > 10 ? `+${growthPct.toFixed(0)}% growth` :
    growthPct > -5 ? 'Stable' :
    `${growthPct.toFixed(0)}% decline`;

  // 5. Transaction Volume (15%)
  const volumeScore = Math.round(Math.min(100, (transactions.length / 100) * 100));
  const volumeLabel = `${transactions.length} transactions in 90 days`;

  // Weighted overall
  const overall = Math.round(
    cashRunwayScore * 0.25 +
    revenueConsistencyScore * 0.25 +
    expenseRatioScore * 0.20 +
    growthScore * 0.15 +
    volumeScore * 0.15
  );

  const grade: LoanScore['grade'] = overall >= 75 ? 'Excellent' :
    overall >= 55 ? 'Good' :
    overall >= 35 ? 'Fair' : 'Needs Improvement';

  const summary = overall >= 75
    ? 'Strong financial health with consistent revenue and manageable expenses.'
    : overall >= 55
    ? 'Good financial position with some areas for improvement.'
    : overall >= 35
    ? 'Moderate financial health. Address key areas before applying for financing.'
    : 'Financial fundamentals need strengthening before seeking financing.';

  return {
    overall,
    components: {
      cashRunway: { score: cashRunwayScore, label: cashRunwayLabel },
      revenueConsistency: { score: revenueConsistencyScore, label: revenueConsistencyLabel },
      expenseRatio: { score: expenseRatioScore, label: expenseRatioLabel },
      growthTrend: { score: growthScore, label: growthLabel },
      transactionVolume: { score: volumeScore, label: volumeLabel },
    },
    grade,
    summary,
  };
}

export function exportTransactionsCSV(transactions: Transaction[]) {
  const headers = ['Date', 'Merchant', 'Category', 'Amount', 'Currency', 'Transaction ID'];
  const rows = transactions.map((tx) => [
    tx.date,
    `"${(tx.merchant_name ?? tx.name).replace(/"/g, '""')}"`,
    tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other',
    tx.amount.toFixed(2),
    tx.iso_currency_code ?? 'USD',
    tx.transaction_id,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `runwayai-transactions-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportDashboardPDF(
  transactions: Transaction[],
  accounts: Account[],
) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const totalBalance = accounts.reduce((s, a) => s + (a.balances.current ?? 0), 0);
  const totalSpend = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalIncome = Math.abs(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const netFlow = totalIncome - totalSpend;
  const monthlyBurn = totalSpend / 3;
  const runwayMonths = monthlyBurn > 0 ? totalBalance / monthlyBurn : Infinity;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  // Category totals
  const catMap: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.amount <= 0) continue;
    const cat = tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other';
    catMap[cat] = (catMap[cat] ?? 0) + tx.amount;
  }
  const topCategories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const w = pdf.internal.pageSize.getWidth();
  let y = 50;

  // Title
  pdf.setFontSize(22);
  pdf.setTextColor(30, 30, 60);
  pdf.text('RunwayAI Financial Report', w / 2, y, { align: 'center' });
  y += 20;
  pdf.setFontSize(10);
  pdf.setTextColor(120, 120, 140);
  pdf.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, w / 2, y, { align: 'center' });
  y += 40;

  // Summary stats
  pdf.setFontSize(14);
  pdf.setTextColor(30, 30, 60);
  pdf.text('Financial Summary', 40, y);
  y += 24;

  const stats = [
    ['Total Balance', fmt(totalBalance)],
    ['90-Day Spend', fmt(totalSpend)],
    ['90-Day Income', fmt(totalIncome)],
    ['Net Cash Flow', `${netFlow >= 0 ? '+' : ''}${fmt(netFlow)}`],
    ['Cash Runway', runwayMonths === Infinity ? 'N/A' : `${runwayMonths.toFixed(1)} months`],
    ['Monthly Burn Rate', monthlyBurn > 0 ? `${fmt(monthlyBurn)}/mo` : 'No expenses'],
    ['Transactions', `${transactions.length} total`],
    ['Accounts', `${accounts.length} connected`],
  ];

  pdf.setFontSize(10);
  for (const [label, value] of stats) {
    pdf.setTextColor(100, 100, 120);
    pdf.text(label, 50, y);
    pdf.setTextColor(30, 30, 60);
    pdf.text(value, 200, y);
    y += 18;
  }
  y += 20;

  // Top categories
  pdf.setFontSize(14);
  pdf.setTextColor(30, 30, 60);
  pdf.text('Top Spending Categories', 40, y);
  y += 24;
  pdf.setFontSize(10);
  for (const [cat, total] of topCategories) {
    const pct = totalSpend > 0 ? ((total / totalSpend) * 100).toFixed(1) : '0';
    pdf.setTextColor(100, 100, 120);
    pdf.text(cat, 50, y);
    pdf.setTextColor(30, 30, 60);
    pdf.text(`${fmt(total)} (${pct}%)`, 200, y);
    y += 18;
  }
  y += 20;

  // Capture chart if visible
  const chartEl = document.querySelector('[data-pdf-chart]') as HTMLElement | null;
  if (chartEl) {
    try {
      const canvas = await html2canvas(chartEl, {
        backgroundColor: '#0f172a',
        scale: 2,
      });
      const imgData = canvas.toDataURL('image/png');
      const imgW = w - 80;
      const imgH = (canvas.height / canvas.width) * imgW;

      if (y + imgH > pdf.internal.pageSize.getHeight() - 40) {
        pdf.addPage();
        y = 50;
      }
      pdf.setFontSize(14);
      pdf.setTextColor(30, 30, 60);
      pdf.text('Cash Flow Chart', 40, y);
      y += 16;
      pdf.addImage(imgData, 'PNG', 40, y, imgW, imgH);
      y += imgH + 20;
    } catch {
      // chart capture failed silently, continue
    }
  }

  // Recent transactions table
  if (y + 40 > pdf.internal.pageSize.getHeight() - 40) {
    pdf.addPage();
    y = 50;
  }
  pdf.setFontSize(14);
  pdf.setTextColor(30, 30, 60);
  pdf.text('Recent Transactions', 40, y);
  y += 24;

  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 120);
  pdf.text('Date', 50, y);
  pdf.text('Merchant', 120, y);
  pdf.text('Category', 320, y);
  pdf.text('Amount', 450, y);
  y += 14;
  pdf.setDrawColor(200, 200, 210);
  pdf.line(50, y - 4, w - 40, y - 4);

  const recentTx = transactions.slice(0, 30);
  for (const tx of recentTx) {
    if (y > pdf.internal.pageSize.getHeight() - 40) {
      pdf.addPage();
      y = 50;
    }
    pdf.setTextColor(80, 80, 100);
    pdf.text(tx.date, 50, y);
    const merchant = (tx.merchant_name ?? tx.name).slice(0, 30);
    pdf.text(merchant, 120, y);
    const cat = (tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other').slice(0, 20);
    pdf.text(cat, 320, y);
    pdf.setTextColor(tx.amount > 0 ? 180 : 50, tx.amount > 0 ? 60 : 160, tx.amount > 0 ? 60 : 80);
    pdf.text(`${tx.amount > 0 ? '-' : '+'}$${Math.abs(tx.amount).toFixed(2)}`, 450, y);
    y += 14;
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(160, 160, 170);
  pdf.text('RunwayAI - AI-Powered Financial Intelligence', w / 2, pdf.internal.pageSize.getHeight() - 20, { align: 'center' });

  pdf.save(`runwayai-report-${new Date().toISOString().split('T')[0]}.pdf`);
}

// ─── Loan Readiness Report PDF ─────────────────────────────────────────────

export async function exportLoanReadinessReport(
  transactions: Transaction[],
  accounts: Account[],
) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const score = calculateLoanScore(transactions, accounts);

  const totalBalance = accounts.reduce((s, a) => s + (a.balances.current ?? 0), 0);
  const totalSpend = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalIncome = Math.abs(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const netFlow = totalIncome - totalSpend;
  const monthlyBurn = totalSpend / 3;
  const runwayMonths = monthlyBurn > 0 ? totalBalance / monthlyBurn : Infinity;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  // Monthly buckets
  const now = new Date();
  const monthBuckets: { label: string; revenue: number; expenses: number }[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    monthBuckets.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      revenue: 0,
      expenses: 0,
    });
  }
  for (const tx of transactions) {
    const txDate = new Date(tx.date);
    const daysAgo = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
    const bucket = Math.min(Math.floor(daysAgo / 30), 2);
    const idx = 2 - bucket; // reverse: oldest first
    if (tx.amount > 0) monthBuckets[idx].expenses += tx.amount;
    else monthBuckets[idx].revenue += Math.abs(tx.amount);
  }

  // Top revenue sources
  const revenueSources: Record<string, number> = {};
  for (const tx of transactions.filter((t) => t.amount < 0)) {
    const key = tx.merchant_name ?? tx.name;
    revenueSources[key] = (revenueSources[key] ?? 0) + Math.abs(tx.amount);
  }
  const topRevenue = Object.entries(revenueSources).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Top expense categories
  const catMap: Record<string, number> = {};
  for (const tx of transactions.filter((t) => t.amount > 0)) {
    const cat = tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other';
    catMap[cat] = (catMap[cat] ?? 0) + tx.amount;
  }
  const topCategories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  let y = 50;

  const businessName = accounts[0]?.name ?? 'Business';

  // ── PAGE 1: Title + Score ──────────────────────────────────────────────

  pdf.setFontSize(24);
  pdf.setTextColor(30, 30, 60);
  pdf.text('Cash Flow Signal Report', w / 2, y, { align: 'center' });
  y += 24;
  pdf.setFontSize(11);
  pdf.setTextColor(100, 100, 130);
  pdf.text('Prepared for Loan Application', w / 2, y, { align: 'center' });
  y += 30;

  pdf.setFontSize(10);
  pdf.setTextColor(120, 120, 140);
  pdf.text(`Business: ${businessName}`, w / 2, y, { align: 'center' });
  y += 16;
  pdf.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, w / 2, y, { align: 'center' });
  y += 16;
  pdf.text(`Data Period: Last 90 days (${transactions.length} transactions)`, w / 2, y, { align: 'center' });
  y += 40;

  // Score badge
  const scoreColor: [number, number, number] = score.overall >= 70 ? [34, 197, 94] :
    score.overall >= 40 ? [234, 179, 8] : [239, 68, 68];
  pdf.setFillColor(...scoreColor);
  pdf.roundedRect(w / 2 - 60, y, 120, 80, 8, 8, 'F');
  pdf.setFontSize(36);
  pdf.setTextColor(255, 255, 255);
  pdf.text(String(score.overall), w / 2, y + 42, { align: 'center' });
  pdf.setFontSize(10);
  pdf.text('/ 100', w / 2, y + 58, { align: 'center' });
  y += 100;

  pdf.setFontSize(16);
  pdf.setTextColor(30, 30, 60);
  pdf.text(score.grade, w / 2, y, { align: 'center' });
  y += 18;
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 130);
  pdf.text(score.summary, w / 2, y, { align: 'center', maxWidth: w - 100 });
  y += 40;

  // Score components
  pdf.setFontSize(12);
  pdf.setTextColor(30, 30, 60);
  pdf.text('Score Breakdown', 40, y);
  y += 22;

  const components = [
    { name: 'Cash Runway', weight: '25%', ...score.components.cashRunway },
    { name: 'Revenue Consistency', weight: '25%', ...score.components.revenueConsistency },
    { name: 'Expense-to-Revenue', weight: '20%', ...score.components.expenseRatio },
    { name: 'Growth Trend', weight: '15%', ...score.components.growthTrend },
    { name: 'Transaction Volume', weight: '15%', ...score.components.transactionVolume },
  ];

  pdf.setFontSize(9);
  for (const c of components) {
    // Bar background
    pdf.setFillColor(230, 230, 235);
    pdf.roundedRect(50, y - 8, 200, 10, 3, 3, 'F');
    // Bar fill
    const barColor: [number, number, number] = c.score >= 70 ? [99, 102, 241] :
      c.score >= 40 ? [234, 179, 8] : [239, 68, 68];
    pdf.setFillColor(...barColor);
    pdf.roundedRect(50, y - 8, Math.max(4, (c.score / 100) * 200), 10, 3, 3, 'F');
    // Labels
    pdf.setTextColor(60, 60, 80);
    pdf.text(`${c.name} (${c.weight})`, 260, y);
    pdf.setTextColor(100, 100, 120);
    pdf.text(`${c.score}/100 — ${c.label}`, 400, y);
    y += 22;
  }

  // ── PAGE 2: Financial Summary ──────────────────────────────────────────

  pdf.addPage();
  y = 50;

  pdf.setFontSize(16);
  pdf.setTextColor(30, 30, 60);
  pdf.text('Financial Summary', 40, y);
  y += 30;

  // Key metrics
  pdf.setFontSize(12);
  pdf.text('Key Metrics', 40, y);
  y += 22;

  const metrics = [
    ['Total Balance', fmt(totalBalance)],
    ['90-Day Revenue', fmt(totalIncome)],
    ['90-Day Expenses', fmt(totalSpend)],
    ['Net Cash Flow', `${netFlow >= 0 ? '+' : ''}${fmt(netFlow)}`],
    ['Cash Runway', runwayMonths === Infinity ? 'N/A' : `${runwayMonths.toFixed(1)} months`],
    ['Monthly Burn Rate', monthlyBurn > 0 ? `${fmt(monthlyBurn)}/mo` : 'N/A'],
    ['Connected Accounts', String(accounts.length)],
  ];

  pdf.setFontSize(10);
  for (const [label, value] of metrics) {
    pdf.setTextColor(100, 100, 120);
    pdf.text(label, 50, y);
    pdf.setTextColor(30, 30, 60);
    pdf.text(value, 220, y);
    y += 18;
  }
  y += 20;

  // Monthly breakdown table
  pdf.setFontSize(12);
  pdf.setTextColor(30, 30, 60);
  pdf.text('Monthly Breakdown', 40, y);
  y += 22;

  // Table header
  pdf.setFontSize(9);
  pdf.setFillColor(240, 240, 245);
  pdf.rect(40, y - 12, w - 80, 18, 'F');
  pdf.setTextColor(80, 80, 100);
  pdf.text('Month', 50, y);
  pdf.text('Revenue', 180, y);
  pdf.text('Expenses', 280, y);
  pdf.text('Net', 380, y);
  pdf.text('Margin', 460, y);
  y += 20;

  for (const m of monthBuckets) {
    const net = m.revenue - m.expenses;
    const margin = m.revenue > 0 ? ((net / m.revenue) * 100).toFixed(0) + '%' : 'N/A';
    pdf.setTextColor(60, 60, 80);
    pdf.text(m.label, 50, y);
    pdf.setTextColor(34, 130, 80);
    pdf.text(fmt(m.revenue), 180, y);
    pdf.setTextColor(180, 60, 60);
    pdf.text(fmt(m.expenses), 280, y);
    pdf.setTextColor(net >= 0 ? 34 : 180, net >= 0 ? 130 : 60, net >= 0 ? 80 : 60);
    pdf.text(`${net >= 0 ? '+' : ''}${fmt(net)}`, 380, y);
    pdf.setTextColor(80, 80, 100);
    pdf.text(margin, 460, y);
    y += 18;
  }
  y += 10;
  pdf.setDrawColor(220, 220, 230);
  pdf.line(40, y, w - 40, y);
  y += 6;
  // Totals
  pdf.setTextColor(30, 30, 60);
  pdf.text('90-Day Total', 50, y + 10);
  pdf.setTextColor(34, 130, 80);
  pdf.text(fmt(totalIncome), 180, y + 10);
  pdf.setTextColor(180, 60, 60);
  pdf.text(fmt(totalSpend), 280, y + 10);
  pdf.setTextColor(netFlow >= 0 ? 34 : 180, netFlow >= 0 ? 130 : 60, netFlow >= 0 ? 80 : 60);
  pdf.text(`${netFlow >= 0 ? '+' : ''}${fmt(netFlow)}`, 380, y + 10);
  y += 40;

  // ── PAGE 3: Chart + Details ────────────────────────────────────────────

  pdf.addPage();
  y = 50;

  // Capture chart
  const chartEl = document.querySelector('[data-pdf-chart]') as HTMLElement | null;
  if (chartEl) {
    try {
      pdf.setFontSize(14);
      pdf.setTextColor(30, 30, 60);
      pdf.text('Cash Flow Trend', 40, y);
      y += 20;

      const canvas = await html2canvas(chartEl, { backgroundColor: '#0f172a', scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const imgW = w - 80;
      const imgH = (canvas.height / canvas.width) * imgW;
      pdf.addImage(imgData, 'PNG', 40, y, imgW, imgH);
      y += imgH + 30;
    } catch {
      // chart capture failed silently
    }
  }

  // Top Revenue Sources
  if (y + 200 > h - 40) { pdf.addPage(); y = 50; }
  pdf.setFontSize(12);
  pdf.setTextColor(30, 30, 60);
  pdf.text('Top Revenue Sources', 40, y);
  y += 20;
  pdf.setFontSize(9);
  for (const [name, amount] of topRevenue) {
    pdf.setTextColor(80, 80, 100);
    pdf.text(name.slice(0, 35), 50, y);
    pdf.setTextColor(34, 130, 80);
    pdf.text(fmt(amount), 280, y);
    y += 16;
  }
  y += 20;

  // Top Expense Categories
  if (y + 200 > h - 40) { pdf.addPage(); y = 50; }
  pdf.setFontSize(12);
  pdf.setTextColor(30, 30, 60);
  pdf.text('Top Expense Categories', 40, y);
  y += 20;
  pdf.setFontSize(9);
  for (const [cat, amount] of topCategories) {
    const pct = totalSpend > 0 ? ((amount / totalSpend) * 100).toFixed(1) : '0';
    pdf.setTextColor(80, 80, 100);
    pdf.text(cat, 50, y);
    pdf.setTextColor(180, 60, 60);
    pdf.text(`${fmt(amount)} (${pct}%)`, 280, y);
    y += 16;
  }
  y += 20;

  // Account details
  if (y + 100 > h - 40) { pdf.addPage(); y = 50; }
  pdf.setFontSize(12);
  pdf.setTextColor(30, 30, 60);
  pdf.text('Connected Accounts', 40, y);
  y += 20;
  pdf.setFontSize(9);
  for (const acct of accounts) {
    pdf.setTextColor(80, 80, 100);
    pdf.text(`${acct.name} (${acct.subtype ?? acct.type})`, 50, y);
    pdf.setTextColor(30, 30, 60);
    pdf.text(fmt(acct.balances.current ?? 0), 280, y);
    y += 16;
  }

  // Footer on all pages
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(160, 160, 170);
    pdf.text('RunwayAI — Cash Flow Signal Report | Confidential', w / 2, h - 20, { align: 'center' });
    pdf.text(`Page ${i} of ${pageCount}`, w - 40, h - 20, { align: 'right' });
  }

  pdf.save(`runwayai-loan-report-${new Date().toISOString().split('T')[0]}.pdf`);
}
