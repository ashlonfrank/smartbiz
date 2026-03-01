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
