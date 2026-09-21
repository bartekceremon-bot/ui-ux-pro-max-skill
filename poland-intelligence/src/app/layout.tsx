import type { Metadata } from 'next';
import './globals.css';
import Sidebar, { BottomNav } from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

export const metadata: Metadata = {
  title: 'Poland Intelligence',
  description:
    'Jedno miejsce do analizy firm, miejsc, danych publicznych, gospodarki, infrastruktury i środowiska Polski.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-bg text-ink antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-8">{children}</main>
          </div>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
