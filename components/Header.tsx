import React from 'react';
import { Wifi, User as UserIcon, Bell, LayoutGrid, MonitorPlay, ShieldCheck, FileText } from 'lucide-react';
import { WorkspaceTab, User } from '../types';

interface HeaderProps {
  activeTab?: WorkspaceTab;
  onTabChange?: (tab: WorkspaceTab) => void;
  showNavigation?: boolean;
  user?: User | null;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, showNavigation = false, user }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: Brand & Navigation */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                G
              </div>
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                Gesiuris<span className="text-slate-400 font-light">Desk</span>
              </h1>
            </div>

            {showNavigation && onTabChange && user?.rol === 'Gestor' && (
              <nav className="hidden md:flex space-x-1 ml-4 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => onTabChange('dashboard')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  <LayoutGrid size={16} />
                  Resumen
                </button>
                <button
                  onClick={() => onTabChange('operations')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'operations'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  <MonitorPlay size={16} />
                  Mesa de Operaciones
                </button>
                <button
                  onClick={() => onTabChange('pre-trade')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'pre-trade'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  <FileText size={16} />
                  Pre-Trade
                </button>
                <button
                  onClick={() => onTabChange('post-trade')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'post-trade'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  <MonitorPlay size={16} />
                  Post-Trade
                </button>
              </nav>
            )}

            {/* Placeholder for Control Navigation if needed later */}
            {showNavigation && onTabChange && user?.rol === 'Control' && (
               <nav className="hidden md:flex space-x-1 ml-4">
                 <div className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-brand-800 bg-brand-50 border border-brand-100">
                    <ShieldCheck size={16} />
                    Panel de Control Normativo
                 </div>
               </nav>
            )}
          </div>

          {/* Right: Actions & User */}
          <div className="flex items-center gap-6">
            {/* Status Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
              <Wifi size={14} />
              <span>Conectado</span>
            </div>

            <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
              <button className="text-slate-400 hover:text-slate-600 transition-colors relative">
                <Bell size={20} />
                <span className="absolute top-0 right-0 w-2 h-2 bg-brand-500 rounded-full border border-white"></span>
              </button>
              
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-800 group-hover:text-brand-700 transition-colors">
                    {user ? `${user.name} ${user.surname.split(' ')[0]}.` : 'Gestor'}
                  </p>
                  <p className="text-xs text-slate-500">{user?.rol === 'Control' ? 'Departamento Control' : 'Gestor Senior'}</p>
                </div>
                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 text-slate-600 group-hover:border-brand-300 group-hover:bg-brand-50 transition-all">
                  <UserIcon size={18} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};