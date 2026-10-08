import React from 'react';
import { useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isRoom = location.pathname.startsWith('/room/');

  return (
    <div className="min-h-screen min-h-[100dvh] bg-neutral-950 flex flex-col">
      <main className={`flex-1 relative overflow-y-auto ${isRoom ? 'pb-0' : 'pb-20 md:pb-0'}`}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
