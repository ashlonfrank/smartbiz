import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';

export async function POST(request: NextRequest) {
  try {
    const { public_token } = await request.json();

    if (!public_token) {
      return NextResponse.json({ error: 'public_token is required' }, { status: 400 });
    }

    const response = await plaidClient.itemPublicTokenExchange({ public_token });

    return NextResponse.json({ access_token: response.data.access_token });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
