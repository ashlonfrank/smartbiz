export interface Transaction {
  transaction_id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  category: string[] | null;
  personal_finance_category?: { primary: string; detailed: string } | null;
  iso_currency_code: string | null;
}

export interface Account {
  account_id: string;
  name: string;
  type: string;
  subtype: string | null;
  balances: {
    current: number | null;
    available: number | null;
    iso_currency_code: string | null;
  };
}

export type RecommendationType =
  | 'cash_flow_forecast'
  | 'overdue_invoices'
  | 'anomalies'
  | 'subscription_audit'
  | 'payment_timing'
  | 'loan_readiness';

export type Severity = 'critical' | 'warning' | 'info';

export interface Recommendation {
  type: RecommendationType;
  severity: Severity;
  title: string;
  description: string;
  reasoning: string;
  suggested_action: string;
}

export interface AnalyzeResponse {
  recommendations: Recommendation[];
}

export interface DailyFlow {
  date: string;
  spend: number;
  income: number;
  net: number;
  cumulative: number;
  forecast?: number;
}

// ── Onboarding / Business Profile ──────────────────────────────────

export type BusinessType = 'Restaurant' | 'Retail' | 'Service' | 'E-commerce' | 'Other';
export type BusinessStage = 'Just Starting' | 'Surviving' | 'Stabilizing' | 'Growing' | 'Scaling';
export type Priority =
  | 'Understand my cash flow'
  | 'Reduce expenses'
  | 'Hire or expand'
  | 'Get a loan'
  | 'Forecast growth'
  | 'Track recurring costs';

export interface BusinessProfile {
  businessType: BusinessType;
  stage: BusinessStage;
  priorities: Priority[];
  completedOnboarding: boolean;
}

// ── Insight Feedback ───────────────────────────────────────────────

export interface InsightFeedback {
  vote: 'up' | 'down';
  comment?: string;
  timestamp: number;
}
