import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AuthGuard from '../components/AuthGuard';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'N1 Personal Learning',
  description: 'App học N1 cá nhân (Tháng 5 - Tháng 11)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className={`${inter.className} bg-slate-50 text-slate-900 min-h-screen`}>
        <AuthGuard>
          <main className="max-w-5xl mx-auto p-4 py-8">
            {children}
          </main>
        </AuthGuard>
      </body>
    </html>
  );
}
