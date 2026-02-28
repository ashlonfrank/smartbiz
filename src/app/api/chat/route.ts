import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Transaction, Account } from '@/lib/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildContext(transactions: Transaction[], accounts: Account[]): string {
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balances.current ?? 0), 0);
  const totalAvailable = accounts.reduce((sum, a) => sum + (a.balances.available ?? 0), 0);

  const spendTx = transactions.filter((t) => t.amount > 0);
  const incomeTx = transactions.filter((t) => t.amount < 0);
  const totalSpend = spendTx.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = Math.abs(incomeTx.reduce((sum, t) => sum + t.amount, 0));

  const merchantTotals: Record<string, number> = {};
  for (const tx of spendTx) {
    const key = tx.merchant_name ?? tx.name;
    merchantTotals[key] = (merchantTotals[key] ?? 0) + tx.amount;
  }
  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, total]) => `${name}: $${total.toFixed(2)}`);

  const merchantCounts: Record<string, number> = {};
  for (const tx of transactions) {
    const key = tx.merchant_name ?? tx.name;
    merchantCounts[key] = (merchantCounts[key] ?? 0) + 1;
  }
  const recurring = Object.entries(merchantCounts)
    .filter(([, count]) => count >= 2)
    .map(([name, count]) => `${name} (${count}x)`);

  const recent = transactions
    .slice(0, 20)
    .map((t) => ({
      date: t.date,
      name: t.merchant_name ?? t.name,
      amount: t.amount,
      category: t.personal_finance_category?.primary ?? t.category?.[0] ?? 'Unknown',
    }));

  return `## Financial Context
- Total current balance: $${totalBalance.toFixed(2)}
- Total available balance: $${totalAvailable.toFixed(2)}
- Accounts: ${accounts.map((a) => `${a.name} (${a.subtype ?? a.type})`).join(', ')}
- Total spend (90 days): $${totalSpend.toFixed(2)}
- Total income (90 days): $${totalIncome.toFixed(2)}
- Net cash flow: $${(totalIncome - totalSpend).toFixed(2)}
- Transaction count: ${transactions.length}

## Top Merchants by Spend
${topMerchants.join('\n')}

## Recurring Charges
${recurring.length > 0 ? recurring.join(', ') : 'None detected'}

## Recent Transactions
${JSON.stringify(recent, null, 2)}`;
}

export async function POST(request: NextRequest) {
  try {
    const { message, transactions, accounts, history, alerts } = await request.json() as {
      message: string;
      transactions: Transaction[];
      accounts: Account[];
      history?: { role: 'user' | 'assistant'; content: string }[];
      alerts?: { title: string; description: string; type: string }[];
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const context = buildContext(transactions ?? [], accounts ?? []);

    let alertContext = '';
    if (alerts?.length) {
      alertContext = `\n\n## Active Alerts\n${alerts.map((a) => `- [${a.type.toUpperCase()}] ${a.title}: ${a.description}`).join('\n')}`;
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are RunwayAI, a conversational financial assistant for small business owners. You have access to the user's real bank transaction data and account information below.

${context}${alertContext}

Rules:
- Be conversational, concise, and helpful.
- Reference specific merchants, amounts, and dates from the data when relevant.
- If asked to draft emails or messages, write them directly.
- If asked about cash flow trends, reference the actual numbers.
- Format currency amounts properly (e.g., $1,234.56).
- Use short paragraphs. Avoid walls of text.
- If you don't have enough data to answer a question, say so honestly.`,
      },
    ];

    if (history?.length) {
      for (const msg of history.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: message });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.5,
      max_tokens: 1000,
    });

    const reply = completion.choices[0]?.message?.content ?? 'Sorry, I could not generate a response.';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
