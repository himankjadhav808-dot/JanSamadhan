import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutDashboard, PlusCircle, Trophy, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const navItems = [
    { label: 'Feed', icon: Home, path: '/' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Report', icon: PlusCircle, path: '/report', isCenter: true },
    { label: 'Rewards', icon: Trophy, path: '/rewards' },
    { label: 'Profile', icon: User, path: `/profile/${user?._id || ''}`, requiresAuth: true },
  ];

  const handleProfileClick = () => {
    if (user) {
      navigate(`/profile/${user._id}`);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-40 px-2 py-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
                          (item.path !== '/' && location.pathname.startsWith(item.path));

          if (item.isCenter) {
            return (
              <NavLink 
                key={item.path} 
                to={item.path}
                className="flex flex-col items-center -mt-5"
              >
                <div className="p-3 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/30 active:scale-95 transition-transform">
                  <Icon className="w-6 h-6"/>
                </div>
                <span className="text-[10px] font-bold text-blue-600 mt-0.5">
                  {item.label}
                </span>
              </NavLink>
            );
          }

          if (item.requiresAuth) {
            return (
              <button
                key={item.label}
                onClick={handleProfileClick}
                className={`flex flex-col items-center px-2.5 py-1 transition-colors ${
                  isActive ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className="text-[10px] mt-0.5">{item.label}</span>
              </button>
            );
          }

          return (
            <NavLink 
              key={item.path}
              to={item.path}
              className={({ isActive: linkActive }) => 
                `flex flex-col items-center px-2.5 py-1 transition-colors ${
                  linkActive ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
                }`
              }
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
