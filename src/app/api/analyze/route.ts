import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Transaction, Account, Recommendation, BusinessProfile } from '@/lib/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildPrompt(transactions: Transaction[], accounts: Account[], businessProfile?: BusinessProfile | null): string {
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balances.current ?? 0), 0);
  const totalAvailable = accounts.reduce((sum, a) => sum + (a.balances.available ?? 0), 0);

  const spendTx = transactions.filter((t) => t.amount > 0);
  const incomeTx = transactions.filter((t) => t.amount < 0);
  const totalSpend = spendTx.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = Math.abs(incomeTx.reduce((sum, t) => sum + t.amount, 0));

  // Summarise top merchants by spend
  const merchantTotals: Record<string, number> = {};
  for (const tx of spendTx) {
    const key = tx.merchant_name ?? tx.name;
    merchantTotals[key] = (merchantTotals[key] ?? 0) + tx.amount;
  }
  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, total]) => `${name}: $${total.toFixed(2)}`);

  // Detect recurring charges (same merchant, similar amount, multiple times)
  const merchantCounts: Record<string, number> = {};
  for (const tx of transactions) {
    const key = tx.merchant_name ?? tx.name;
    merchantCounts[key] = (merchantCounts[key] ?? 0) + 1;
  }
  const recurring = Object.entries(merchantCounts)
    .filter(([, count]) => count >= 2)
    .map(([name, count]) => `${name} (${count}x)`);

  // Recent transactions (last 30, for anomaly detection)
  const recent = transactions
    .slice(0, 30)
    .map((t) => ({
      date: t.date,
      name: t.merchant_name ?? t.name,
      amount: t.amount,
      category: t.personal_finance_category?.primary ?? t.category?.[0] ?? 'Unknown',
    }));

  // Calculate monthly revenue for growth signal
  const now = new Date();
  const monthBuckets = [0, 0, 0]; // [oldest, middle, newest]
  for (const t of incomeTx) {
    const txDate = new Date(t.date);
    const daysAgo = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo <= 30) monthBuckets[2] += Math.abs(t.amount);
    else if (daysAgo <= 60) monthBuckets[1] += Math.abs(t.amount);
    else monthBuckets[0] += Math.abs(t.amount);
  }
  const revenueGrowth = monthBuckets[0] > 0
    ? (((monthBuckets[2] - monthBuckets[0]) / monthBuckets[0]) * 100).toFixed(1)
    : 'N/A';
  const monthlyBurn = totalSpend / 3;
  const cashRunwayMonths = monthlyBurn > 0 ? (totalBalance / monthlyBurn).toFixed(1) : 'N/A';

  let profileContext = '';
  if (businessProfile) {
    profileContext = `\n## Business Context\n- Business type: ${businessProfile.businessType}\n- Business stage: ${businessProfile.stage}\n- Owner priorities: ${businessProfile.priorities.join(', ')}\n\nTailor your recommendations to this context. A ${businessProfile.businessType} business in the "${businessProfile.stage}" stage with these priorities will benefit most from actionable, specific advice related to their situation.\n`;
  }

  return `You are a financial AI analyst for a small business. Analyse the following financial data and return exactly 6 recommendations as a JSON array.
${profileContext}

## Account Summary
- Total current balance: $${totalBalance.toFixed(2)}
- Total available balance: $${totalAvailable.toFixed(2)}
- Accounts: ${accounts.map((a) => `${a.name} (${a.subtype ?? a.type})`).join(', ')}

## 90-Day Transaction Summary
- Total spend: $${totalSpend.toFixed(2)}
- Total income: $${totalIncome.toFixed(2)}
- Net cash flow: $${(totalIncome - totalSpend).toFixed(2)}
- Transaction count: ${transactions.length}
- Monthly revenue (oldest→newest): $${monthBuckets[0].toFixed(2)} → $${monthBuckets[1].toFixed(2)} → $${monthBuckets[2].toFixed(2)}
- Revenue growth (month 1 to month 3): ${revenueGrowth}%
- Cash runway: ${cashRunwayMonths} months

## Top Merchants by Spend
${topMerchants.join('\n')}

## Recurring Charges Detected
${recurring.length > 0 ? recurring.join(', ') : 'None detected'}

## Recent Transactions (last 30)
${JSON.stringify(recent, null, 2)}

## Required Output
Return ONLY a valid JSON object with this exact shape — no markdown, no code fences, no extra text:
{
  "recommendations": [
    {
      "type": "cash_flow_forecast",
      "severity": "info" | "warning" | "critical",
      "title": "...",
      "description": "...",
      "reasoning": "...",
      "suggested_action": "..."
    },
    {
      "type": "overdue_invoices",
      ...
    },
    {
      "type": "anomalies",
      ...
    },
    {
      "type": "subscription_audit",
      ...
    },
    {
      "type": "payment_timing",
      ...
    },
    {
      "type": "loan_readiness",
      ...
    }
  ]
}

Rules:
- Exactly one recommendation per type, in the order listed above.
- severity must be one of: critical, warning, info.
- Be specific — reference actual merchant names, amounts, and dates from the data.
- suggested_action must be a concrete, actionable next step.
- reasoning must explain why this is flagged based on the data.
- For loan_readiness: Only flag this if financial signals are positive (growing or stable revenue, cash runway > 3 months, positive net cash flow). Use severity "info" since it's an opportunity, not a problem. The title should reference specific growth numbers from the data. The suggested_action should mention downloading the Cash Flow Signal Report to share with lenders.`;
}

export async function POST(request: NextRequest) {
  try {
    const { transactions, accounts, businessProfile } = await request.json() as {
      transactions: Transaction[];
      accounts: Account[];
      businessProfile?: BusinessProfile | null;
    };

    if (!transactions?.length) {
      return NextResponse.json({ error: 'transactions array is required' }, { status: 400 });
    }

    const prompt = buildPrompt(transactions, accounts ?? [], businessProfile);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a financial AI analyst. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { recommendations: Recommendation[] };

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error in /api/analyze:', error);
    return NextResponse.json({ error: 'Failed to analyze transactions' }, { status: 500 });
  }
}
