'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV = [
  { href: '/', label: 'Overview', icon: '🏠' },
  { href: '/search', label: 'Global Search', icon: '🔎' },
  { href: '/companies', label: 'Companies', icon: '🏢' },
  { href: '/map', label: 'Map Intelligence', icon: '🗺' },
  { href: '/economy', label: 'GUS / Economy', icon: '📊' },
  { href: '/finance', label: 'NBP / Finance', icon: '💰' },
  { href: '/air', label: 'Air Quality', icon: '🌫' },
  { href: '/healthcare', label: 'Healthcare', icon: '🏥' },
  { href: '/transport', label: 'Transport', icon: '🚌' },
  { href: '/public-data', label: 'Public Data', icon: '🏛' },
  { href: '/locations', label: 'Locations', icon: '📍' },
  { href: '/reports', label: 'Reports', icon: '📑' },
  { href: '/watchlist', label: 'Watchlists', icon: '⭐' },
  { href: '/system', label: 'System Health', icon: '🩺' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="hidden w-60 shrink-0 border-r border-line bg-panel md:block">
      <div className="px-4 py-4">
        <div className="text-sm font-semibold tracking-tight text-ink">POLAND INTELLIGENCE</div>
        <div className="mt-1 text-[11px] leading-snug text-muted">
          Firmy, miejsca, dane publiczne, gospodarka, infrastruktura i środowisko Polski.
        </div>
      </div>
      <ul className="space-y-0.5 px-2 pb-8">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-panel2 text-white' : 'text-muted hover:bg-panel2 hover:text-ink'
                }`}
              >
                <span aria-hidden className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const items = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/search', label: 'Search', icon: '🔎' },
    { href: '/map', label: 'Map', icon: '🗺' },
    { href: '/watchlist', label: 'Watchlist', icon: '⭐' },
    { href: '/system', label: 'More', icon: '⋯' },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-panel md:hidden">
      {items.map((i) => {
        const active = i.href === '/' ? pathname === '/' : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active ? 'text-white' : 'text-muted'}`}>
            <span aria-hidden>{i.icon}</span>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
