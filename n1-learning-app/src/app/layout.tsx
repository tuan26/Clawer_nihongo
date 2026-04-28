import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

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
        <nav className="bg-blue-600 text-white shadow-md sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="font-bold text-lg tracking-tight">🎓 N1 Mastery 2026</a>
            <div className="text-sm font-medium opacity-90">
              Lộ trình 214 Ngày Đêm
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto p-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
