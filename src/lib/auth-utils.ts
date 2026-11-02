export function safeNext(value: string | null | undefined) {
  return value === '/' || value === '/write' || value === '/profile' || /^\/guestbooks\/[0-9a-f-]{36}$/i.test(value ?? '') ? value! : '/';
}
export const authConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
