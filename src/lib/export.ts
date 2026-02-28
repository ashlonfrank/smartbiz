import { Transaction, Account } from './types';

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
