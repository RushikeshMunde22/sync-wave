import React from 'react';
import BottomNav from './BottomNav';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 flex">
      {/* Desktop Sidebar could go here */}
      <main className="flex-1 pb-20 md:pb-0 relative h-screen overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
