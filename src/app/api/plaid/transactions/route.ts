import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';

export async function POST(request: NextRequest) {
  try {
    const { access_token } = await request.json();

    if (!access_token) {
      return NextResponse.json({ error: 'access_token is required' }, { status: 400 });
    }

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: startDate,
      end_date: endDate,
    });

    return NextResponse.json({
      transactions: response.data.transactions,
      total_transactions: response.data.total_transactions,
      accounts: response.data.accounts,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
