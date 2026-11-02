import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { authConfigured, safeNext } from '@/lib/auth-utils';
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  if (authConfigured() && token_hash && (type === 'signup' || type === 'recovery')) {
    const client = await serverClient();
    const { data, error } = await client.auth.verifyOtp({ token_hash, type });
    if (!error && data.user && !data.user.is_anonymous) {
      const response = new NextResponse(null, { status: 303, headers: { Location: type === 'recovery' ? '/reset-password' : safeNext(request.nextUrl.searchParams.get('next')) } });
      if (type === 'recovery') response.cookies.set('trace-recovery', data.user.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 });
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('Referrer-Policy', 'no-referrer');
      return response;
    }
  }
  return new NextResponse(null, { status: 303, headers: { Location: '/login?error=link', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
