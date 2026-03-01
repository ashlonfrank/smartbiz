/**
 * Mock data for development — realistic restaurant business transactions.
 * This data is used as a fallback when no Plaid data exists in localStorage,
 * so the dashboard can render without requiring bank login in dev/preview.
 *
 * When a user connects a real bank via Plaid, real data replaces this in localStorage.
 */

import { Transaction, Account } from './types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

let txIdCounter = 1;
function tx(
  daysBack: number,
  name: string,
  amount: number,
  category: string,
  merchantName?: string,
): Transaction {
  return {
    transaction_id: `mock_tx_${String(txIdCounter++).padStart(4, '0')}`,
    name,
    merchant_name: merchantName ?? name,
    amount, // positive = spend, negative = income (Plaid convention)
    date: daysAgo(daysBack),
    category: [category],
    personal_finance_category: { primary: category, detailed: category },
    iso_currency_code: 'USD',
  };
}

// ─── mock accounts ────────────────────────────────────────────────────────────

export const mockAccounts: Account[] = [
  {
    account_id: 'mock_acct_checking',
    name: 'Bella\'s Kitchen Business Checking',
    type: 'depository',
    subtype: 'checking',
    balances: { current: 47250.0, available: 45100.0, iso_currency_code: 'USD' },
  },
  {
    account_id: 'mock_acct_savings',
    name: 'Bella\'s Kitchen Reserve Savings',
    type: 'depository',
    subtype: 'savings',
    balances: { current: 12800.0, available: 12800.0, iso_currency_code: 'USD' },
  },
];

// ─── mock transactions (~120 transactions over 90 days) ───────────────────────

export const mockTransactions: Transaction[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // MONTH 3 (most recent 30 days) — revenue trending UP
  // ═══════════════════════════════════════════════════════════════════════════

  // Revenue — POS deposits (Square/Toast)
  tx(1, 'Square POS Deposit', -2450.00, 'INCOME', 'Square'),
  tx(3, 'Toast POS Deposit', -2280.00, 'INCOME', 'Toast'),
  tx(5, 'Square POS Deposit', -2510.00, 'INCOME', 'Square'),
  tx(8, 'Toast POS Deposit', -2390.00, 'INCOME', 'Toast'),
  tx(10, 'Square POS Deposit', -2620.00, 'INCOME', 'Square'),
  tx(12, 'Toast POS Deposit', -2180.00, 'INCOME', 'Toast'),
  tx(15, 'Square POS Deposit', -2540.00, 'INCOME', 'Square'),
  tx(17, 'Toast POS Deposit', -2350.00, 'INCOME', 'Toast'),
  tx(20, 'Square POS Deposit', -2480.00, 'INCOME', 'Square'),
  tx(22, 'Toast POS Deposit', -2290.00, 'INCOME', 'Toast'),
  tx(25, 'Square POS Deposit', -2410.00, 'INCOME', 'Square'),
  tx(28, 'Toast POS Deposit', -2200.00, 'INCOME', 'Toast'),

  // Revenue — delivery platforms
  tx(4, 'UberEats Payout', -1850.00, 'INCOME', 'UberEats'),
  tx(11, 'DoorDash Merchant Payout', -1620.00, 'INCOME', 'DoorDash'),
  tx(18, 'UberEats Payout', -1780.00, 'INCOME', 'UberEats'),
  tx(25, 'DoorDash Merchant Payout', -1540.00, 'INCOME', 'DoorDash'),

  // Revenue — catering
  tx(6, 'Catering - Martinez Wedding', -3200.00, 'INCOME', 'Catering Event'),
  tx(19, 'Catering - Oakwood Corp Lunch', -1800.00, 'INCOME', 'Catering Event'),

  // Expenses — food supplies
  tx(2, 'Sysco Foods', 3450.00, 'FOOD_AND_DRINK', 'Sysco'),
  tx(9, 'US Foods', 2890.00, 'FOOD_AND_DRINK', 'US Foods'),
  tx(16, 'Sysco Foods', 3280.00, 'FOOD_AND_DRINK', 'Sysco'),
  tx(23, 'US Foods', 2950.00, 'FOOD_AND_DRINK', 'US Foods'),
  tx(7, 'Restaurant Depot', 680.00, 'FOOD_AND_DRINK', 'Restaurant Depot'),
  tx(21, 'Restaurant Depot', 540.00, 'FOOD_AND_DRINK', 'Restaurant Depot'),

  // Expenses — rent
  tx(1, 'Oakwood Properties - Rent', 4500.00, 'RENT_AND_UTILITIES', 'Oakwood Properties'),

  // Expenses — payroll
  tx(3, 'ADP Payroll', 6200.00, 'PAYROLL', 'ADP'),
  tx(17, 'ADP Payroll', 6200.00, 'PAYROLL', 'ADP'),

  // Expenses — utilities
  tx(5, 'PG&E - Gas & Electric', 890.00, 'RENT_AND_UTILITIES', 'PG&E'),
  tx(12, 'City Water & Sewer', 245.00, 'RENT_AND_UTILITIES', 'City Water'),

  // Expenses — SaaS subscriptions
  tx(2, 'Toast POS Monthly', 79.00, 'GENERAL_SERVICES', 'Toast'),
  tx(2, 'QuickBooks Online', 25.00, 'GENERAL_SERVICES', 'QuickBooks'),
  tx(3, 'Yelp Advertising', 300.00, 'GENERAL_SERVICES', 'Yelp'),
  tx(5, 'Gusto Payroll SaaS', 49.00, 'GENERAL_SERVICES', 'Gusto'),
  tx(8, 'OpenTable Subscription', 149.00, 'GENERAL_SERVICES', 'OpenTable'),

  // Expenses — insurance
  tx(10, 'StateFarm Business Insurance', 420.00, 'INSURANCE', 'StateFarm'),

  // Expenses — equipment lease
  tx(15, 'Hobart Equipment Lease', 350.00, 'GENERAL_MERCHANDISE', 'Hobart Equipment'),

  // Expenses — misc
  tx(4, 'Costco Business Center', 320.00, 'FOOD_AND_DRINK', 'Costco'),
  tx(14, 'Amazon Business', 185.00, 'GENERAL_MERCHANDISE', 'Amazon Business'),
  tx(26, 'HD Supply - Cleaning', 98.00, 'GENERAL_MERCHANDISE', 'HD Supply'),

  // ANOMALY — unusually large Sysco order (normally ~$3k, this is $6.8k)
  tx(13, 'Sysco Foods - Bulk Holiday Order', 6800.00, 'FOOD_AND_DRINK', 'Sysco'),

  // ═══════════════════════════════════════════════════════════════════════════
  // MONTH 2 (days 31-60) — moderate revenue
  // ═══════════════════════════════════════════════════════════════════════════

  // Revenue — POS
  tx(31, 'Square POS Deposit', -2100.00, 'INCOME', 'Square'),
  tx(33, 'Toast POS Deposit', -2050.00, 'INCOME', 'Toast'),
  tx(35, 'Square POS Deposit', -2250.00, 'INCOME', 'Square'),
  tx(38, 'Toast POS Deposit', -2180.00, 'INCOME', 'Toast'),
  tx(40, 'Square POS Deposit', -2320.00, 'INCOME', 'Square'),
  tx(42, 'Toast POS Deposit', -1980.00, 'INCOME', 'Toast'),
  tx(45, 'Square POS Deposit', -2200.00, 'INCOME', 'Square'),
  tx(47, 'Toast POS Deposit', -2100.00, 'INCOME', 'Toast'),
  tx(50, 'Square POS Deposit', -2150.00, 'INCOME', 'Square'),
  tx(52, 'Toast POS Deposit', -2080.00, 'INCOME', 'Toast'),
  tx(55, 'Square POS Deposit', -2300.00, 'INCOME', 'Square'),
  tx(58, 'Toast POS Deposit', -2050.00, 'INCOME', 'Toast'),

  // Revenue — delivery
  tx(34, 'UberEats Payout', -1580.00, 'INCOME', 'UberEats'),
  tx(41, 'DoorDash Merchant Payout', -1420.00, 'INCOME', 'DoorDash'),
  tx(48, 'UberEats Payout', -1650.00, 'INCOME', 'UberEats'),
  tx(55, 'DoorDash Merchant Payout', -1380.00, 'INCOME', 'DoorDash'),

  // Revenue — catering
  tx(36, 'Catering - Johnson Birthday', -1400.00, 'INCOME', 'Catering Event'),

  // Expenses — food supplies
  tx(32, 'Sysco Foods', 3100.00, 'FOOD_AND_DRINK', 'Sysco'),
  tx(39, 'US Foods', 2780.00, 'FOOD_AND_DRINK', 'US Foods'),
  tx(46, 'Sysco Foods', 3050.00, 'FOOD_AND_DRINK', 'Sysco'),
  tx(53, 'US Foods', 2860.00, 'FOOD_AND_DRINK', 'US Foods'),
  tx(37, 'Restaurant Depot', 620.00, 'FOOD_AND_DRINK', 'Restaurant Depot'),
  tx(51, 'Restaurant Depot', 490.00, 'FOOD_AND_DRINK', 'Restaurant Depot'),

  // Expenses — rent
  tx(31, 'Oakwood Properties - Rent', 4500.00, 'RENT_AND_UTILITIES', 'Oakwood Properties'),

  // Expenses — payroll
  tx(33, 'ADP Payroll', 5900.00, 'PAYROLL', 'ADP'),
  tx(47, 'ADP Payroll', 5900.00, 'PAYROLL', 'ADP'),

  // Expenses — utilities
  tx(35, 'PG&E - Gas & Electric', 820.00, 'RENT_AND_UTILITIES', 'PG&E'),
  tx(42, 'City Water & Sewer', 230.00, 'RENT_AND_UTILITIES', 'City Water'),

  // Expenses — SaaS
  tx(32, 'Toast POS Monthly', 79.00, 'GENERAL_SERVICES', 'Toast'),
  tx(32, 'QuickBooks Online', 25.00, 'GENERAL_SERVICES', 'QuickBooks'),
  tx(33, 'Yelp Advertising', 300.00, 'GENERAL_SERVICES', 'Yelp'),
  tx(35, 'Gusto Payroll SaaS', 49.00, 'GENERAL_SERVICES', 'Gusto'),
  tx(38, 'OpenTable Subscription', 149.00, 'GENERAL_SERVICES', 'OpenTable'),

  // Expenses — insurance
  tx(40, 'StateFarm Business Insurance', 420.00, 'INSURANCE', 'StateFarm'),

  // Expenses — equipment
  tx(45, 'Hobart Equipment Lease', 350.00, 'GENERAL_MERCHANDISE', 'Hobart Equipment'),

  // Expenses — misc
  tx(34, 'Costco Business Center', 290.00, 'FOOD_AND_DRINK', 'Costco'),
  tx(44, 'Amazon Business', 145.00, 'GENERAL_MERCHANDISE', 'Amazon Business'),

  // ANOMALY — duplicate vendor charge
  tx(43, 'US Foods', 2780.00, 'FOOD_AND_DRINK', 'US Foods'),
  tx(43, 'US Foods - DUPLICATE CHARGE', 2780.00, 'FOOD_AND_DRINK', 'US Foods'),

  // ═══════════════════════════════════════════════════════════════════════════
  // MONTH 1 (days 61-90) — lowest revenue (showing growth trend)
  // ═══════════════════════════════════════════════════════════════════════════

  // Revenue — POS
  tx(61, 'Square POS Deposit', -1950.00, 'INCOME', 'Square'),
  tx(63, 'Toast POS Deposit', -1880.00, 'INCOME', 'Toast'),
  tx(65, 'Square POS Deposit', -2050.00, 'INCOME', 'Square'),
  tx(68, 'Toast POS Deposit', -1920.00, 'INCOME', 'Toast'),
  tx(70, 'Square POS Deposit', -2100.00, 'INCOME', 'Square'),
  tx(72, 'Toast POS Deposit', -1850.00, 'INCOME', 'Toast'),
  tx(75, 'Square POS Deposit', -2000.00, 'INCOME', 'Square'),
  tx(77, 'Toast POS Deposit', -1900.00, 'INCOME', 'Toast'),
  tx(80, 'Square POS Deposit', -2080.00, 'INCOME', 'Square'),
  tx(82, 'Toast POS Deposit', -1870.00, 'INCOME', 'Toast'),
  tx(85, 'Square POS Deposit', -1980.00, 'INCOME', 'Square'),
  tx(88, 'Toast POS Deposit', -1820.00, 'INCOME', 'Toast'),

  // Revenue — delivery
  tx(64, 'UberEats Payout', -1350.00, 'INCOME', 'UberEats'),
  tx(71, 'DoorDash Merchant Payout', -1280.00, 'INCOME', 'DoorDash'),
  tx(78, 'UberEats Payout', -1420.00, 'INCOME', 'UberEats'),
  tx(85, 'DoorDash Merchant Payout', -1180.00, 'INCOME', 'DoorDash'),

  // Expenses — food supplies
  tx(62, 'Sysco Foods', 2900.00, 'FOOD_AND_DRINK', 'Sysco'),
  tx(69, 'US Foods', 2650.00, 'FOOD_AND_DRINK', 'US Foods'),
  tx(76, 'Sysco Foods', 2850.00, 'FOOD_AND_DRINK', 'Sysco'),
  tx(83, 'US Foods', 2700.00, 'FOOD_AND_DRINK', 'US Foods'),
  tx(67, 'Restaurant Depot', 550.00, 'FOOD_AND_DRINK', 'Restaurant Depot'),
  tx(81, 'Restaurant Depot', 480.00, 'FOOD_AND_DRINK', 'Restaurant Depot'),

  // Expenses — rent
  tx(61, 'Oakwood Properties - Rent', 4500.00, 'RENT_AND_UTILITIES', 'Oakwood Properties'),

  // Expenses — payroll
  tx(63, 'ADP Payroll', 5800.00, 'PAYROLL', 'ADP'),
  tx(77, 'ADP Payroll', 5800.00, 'PAYROLL', 'ADP'),

  // Expenses — utilities
  tx(65, 'PG&E - Gas & Electric', 780.00, 'RENT_AND_UTILITIES', 'PG&E'),
  tx(72, 'City Water & Sewer', 225.00, 'RENT_AND_UTILITIES', 'City Water'),

  // Expenses — SaaS
  tx(62, 'Toast POS Monthly', 79.00, 'GENERAL_SERVICES', 'Toast'),
  tx(62, 'QuickBooks Online', 25.00, 'GENERAL_SERVICES', 'QuickBooks'),
  tx(63, 'Yelp Advertising', 300.00, 'GENERAL_SERVICES', 'Yelp'),
  tx(65, 'Gusto Payroll SaaS', 49.00, 'GENERAL_SERVICES', 'Gusto'),
  tx(68, 'OpenTable Subscription', 149.00, 'GENERAL_SERVICES', 'OpenTable'),

  // Expenses — insurance
  tx(70, 'StateFarm Business Insurance', 420.00, 'INSURANCE', 'StateFarm'),

  // Expenses — equipment
  tx(75, 'Hobart Equipment Lease', 350.00, 'GENERAL_MERCHANDISE', 'Hobart Equipment'),

  // Expenses — misc
  tx(64, 'Costco Business Center', 275.00, 'FOOD_AND_DRINK', 'Costco'),
  tx(74, 'Amazon Business', 128.00, 'GENERAL_MERCHANDISE', 'Amazon Business'),
  tx(86, 'Home Depot - Maintenance', 165.00, 'GENERAL_MERCHANDISE', 'Home Depot'),
];
