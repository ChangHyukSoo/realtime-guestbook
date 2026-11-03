import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfigured } from '@/lib/auth-utils';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!authConfigured()) return response;
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll(values) {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    } },
  });
  const { data: { user } } = await client.auth.getUser();
  const path = request.nextUrl.pathname;
  const member = user && !user.is_anonymous && user.email_confirmed_at;
  // Profile Actions return auth_required in place so the browser keeps its File/draft.
  // Each Action independently checks the current member and its server-bound UID.
  if (path === '/profile' && request.method === 'POST' && request.headers.has('next-action')) {
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  let target: URL | null = null;
  if (!member && (path === '/' || path === '/write' || path === '/profile' || path.startsWith('/guestbooks/'))) {
    target = new URL('/login', request.url); target.searchParams.set('next', path);
  } else if (member && (path === '/login' || path === '/signup')) target = new URL('/', request.url);
  if (target) { const redirect = NextResponse.redirect(target); response.cookies.getAll().forEach(c => redirect.cookies.set(c)); return redirect; }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/', '/profile', '/write', '/guestbooks/:path*', '/login', '/signup/:path*', '/reset-password', '/forgot-password'] };
