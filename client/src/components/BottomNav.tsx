import { Link, useLocation } from 'react-router-dom';

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { name: 'Home', path: '/', icon: '🏠' },
    { name: 'Discover', path: '/discover', icon: '🔍' },
    { name: 'Profile', path: '/profile', icon: '👤' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-900/90 backdrop-blur-md border-t border-neutral-800 p-4 pb-safe flex justify-around items-center md:hidden z-50">
      {tabs.map((tab) => (
        <Link 
          key={tab.path} 
          to={tab.path}
          className={`flex flex-col items-center gap-1 ${path === tab.path ? 'text-indigo-400' : 'text-neutral-500 hover:text-neutral-400'}`}
        >
          <span className="text-xl">{tab.icon}</span>
          <span className="text-[10px] font-medium">{tab.name}</span>
        </Link>
      ))}
    </div>
  );
}
