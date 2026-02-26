import { NextResponse } from 'next/server';
import { CountryCode, Products } from 'plaid';
import { plaidClient } from '@/lib/plaid';

export async function POST() {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'user-sandbox-001' },
      client_name: 'SmartBiz',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
