import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '한 조각 | 실시간 전자방명록', description: '당신이 머문 순간, 손끝으로 남기는 한 조각의 마음.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ko"><body>{children}</body></html>; }
