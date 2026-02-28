import { Transaction } from './types';

export interface Alert {
  id: string;
  type: 'anomaly' | 'budget';
  severity: 'critical' | 'warning';
  title: string;
  description: string;
  amount: number;
  category: string;
}

export interface BudgetThreshold {
  category: string;
  limit: number;
}

/**
 * Detect anomalous transactions: any transaction > 2x the average for that merchant.
 */
export function detectAnomalies(transactions: Transaction[]): Alert[] {
  const spending = transactions.filter((t) => t.amount > 0);

  // Group by merchant
  const byMerchant: Record<string, number[]> = {};
  for (const tx of spending) {
    const key = tx.merchant_name ?? tx.name;
    if (!byMerchant[key]) byMerchant[key] = [];
    byMerchant[key].push(tx.amount);
  }

  const alerts: Alert[] = [];
  for (const tx of spending) {
    const key = tx.merchant_name ?? tx.name;
    const amounts = byMerchant[key];
    if (amounts.length < 3) continue; // need at least 3 transactions to detect anomaly
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    if (tx.amount > avg * 2 && tx.amount > 50) {
      alerts.push({
        id: `anomaly-${tx.transaction_id}`,
        type: 'anomaly',
        severity: tx.amount > avg * 3 ? 'critical' : 'warning',
        title: `Unusual charge at ${key}`,
        description: `$${tx.amount.toFixed(2)} on ${tx.date} is ${(tx.amount / avg).toFixed(1)}x the average of $${avg.toFixed(2)} at this merchant.`,
        amount: tx.amount,
        category: tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other',
      });
    }
  }

  // Deduplicate — keep only the largest anomaly per merchant
  const seen = new Map<string, Alert>();
  for (const a of alerts) {
    const key = a.title;
    if (!seen.has(key) || a.amount > (seen.get(key)?.amount ?? 0)) {
      seen.set(key, a);
    }
  }

  return [...seen.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
}

/**
 * Check category spending against user-set budget thresholds.
 */
export function checkBudgetThresholds(
  transactions: Transaction[],
  thresholds: BudgetThreshold[],
): Alert[] {
  if (thresholds.length === 0) return [];

  // Calculate monthly category spend (90 days = ~3 months, so divide by 3)
  const catTotals: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.amount <= 0) continue;
    const cat = tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other';
    catTotals[cat] = (catTotals[cat] ?? 0) + tx.amount;
  }

  const alerts: Alert[] = [];
  for (const t of thresholds) {
    const total = catTotals[t.category] ?? 0;
    const monthly = total / 3;
    if (monthly > t.limit) {
      const overBy = monthly - t.limit;
      const pct = ((overBy / t.limit) * 100).toFixed(0);
      alerts.push({
        id: `budget-${t.category}`,
        type: 'budget',
        severity: monthly > t.limit * 1.5 ? 'critical' : 'warning',
        title: `${t.category} over budget`,
        description: `Monthly spending of $${monthly.toFixed(0)} exceeds your $${t.limit.toFixed(0)}/mo limit by ${pct}% ($${overBy.toFixed(0)} over).`,
        amount: monthly,
        category: t.category,
      });
    }
  }

  return alerts;
}

/**
 * Suggest default budget thresholds based on 80% of current monthly category spend.
 */
export function suggestThresholds(transactions: Transaction[]): BudgetThreshold[] {
  const catTotals: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.amount <= 0) continue;
    const cat = tx.personal_finance_category?.primary ?? tx.category?.[0] ?? 'Other';
    catTotals[cat] = (catTotals[cat] ?? 0) + tx.amount;
  }

  return Object.entries(catTotals)
    .map(([category, total]) => ({
      category,
      limit: Math.round((total / 3) * 0.8), // 80% of current monthly avg
    }))
    .filter((t) => t.limit >= 50) // only suggest thresholds for meaningful categories
    .sort((a, b) => b.limit - a.limit);
}

// localStorage helpers
const BUDGETS_KEY = 'runwayai_budgets';
const DISMISSED_ALERTS_KEY = 'runwayai_dismissed_alerts';

export function loadBudgets(): BudgetThreshold[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BUDGETS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export function saveBudgets(budgets: BudgetThreshold[]) {
  localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
}

export function loadDismissedAlerts(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(DISMISSED_ALERTS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
}

export function saveDismissedAlerts(ids: Set<string>) {
  localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...ids]));
}
