import React from 'react';
import { Wifi, User as UserIcon, Bell, LayoutGrid, MonitorPlay, ShieldCheck, FileText, LogOut, Briefcase, Scale } from 'lucide-react';
import { WorkspaceTab, User } from '../types';

interface HeaderProps {
  activeTab?: WorkspaceTab;
  onTabChange?: (tab: WorkspaceTab) => void;
  showNavigation?: boolean;
  user?: User | null;
  onLogout?: () => void;
}

type TabDef = { id: WorkspaceTab; label: string; icon: React.ReactNode };

const TABS_MASTER: TabDef[] = [
  { id: 'dashboard',         label: 'Resumen',             icon: <LayoutGrid size={14} /> },
  { id: 'operations',        label: 'Mesa de Operaciones',  icon: <MonitorPlay size={14} /> },
  { id: 'pre-trade',         label: 'Pre-Trade',            icon: <FileText size={14} /> },
  { id: 'post-trade',        label: 'Post-Trade',           icon: <MonitorPlay size={14} /> },
  { id: 'back-office',       label: 'Back-Office',          icon: <Briefcase size={14} /> },
  { id: 'control-dashboard', label: 'Control Dashboard',    icon: <ShieldCheck size={14} /> },
  { id: 'compliance',        label: 'Compliance',           icon: <Scale size={14} /> },
];

const TABS_GESTOR: TabDef[] = [
  { id: 'dashboard',   label: 'Resumen',             icon: <LayoutGrid size={14} /> },
  { id: 'operations',  label: 'Mesa de Operaciones',  icon: <MonitorPlay size={14} /> },
  { id: 'pre-trade',   label: 'Pre-Trade',            icon: <FileText size={14} /> },
  { id: 'post-trade',  label: 'Post-Trade',           icon: <MonitorPlay size={14} /> },
];

const TABS_COMPLIANCE: TabDef[] = [
  { id: 'control-dashboard', label: 'Dashboard', icon: <LayoutGrid size={14} /> },
  { id: 'compliance',        label: 'Historial', icon: <FileText size={14} /> },
];

const getRolLabel = (rol?: string): string => {
  switch (rol) {
    case 'Master': return 'Master';
    case 'Gestor': return 'Gestor Senior';
    case 'Compliance': return 'Dpto. Compliance';
    case 'Backoffice': return 'Dpto. Back-Office';
    default: return 'Usuario';
  }
};

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, showNavigation = false, user, onLogout }) => {
  const rol = user?.rol;

  // Decide qué tabs mostrar según rol
  const tabs: TabDef[] | null =
    rol === 'Master' ? TABS_MASTER :
    rol === 'Gestor' ? TABS_GESTOR :
    rol === 'Compliance' ? TABS_COMPLIANCE :
    null; // Backoffice no tiene tabs de navegación (single-view)

  // Badge estático para Backoffice
  const staticBadge =
    rol === 'Backoffice' ? { icon: <Briefcase size={16} />, label: 'Panel de Back-Office' } :
    null;

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

            {/* Tabs de navegación (Master / Gestor) */}
            {showNavigation && onTabChange && tabs && (
              <nav className="hidden md:flex space-x-1.5 ml-6 bg-slate-100 p-1 rounded-lg">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-md text-xs font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </nav>
            )}

            {/* Badge estático (Compliance / Backoffice) */}
            {showNavigation && onTabChange && staticBadge && (
              <nav className="hidden md:flex space-x-1 ml-4">
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-brand-800 bg-brand-50 border border-brand-100">
                  {staticBadge.icon}
                  {staticBadge.label}
                </div>
              </nav>
            )}
          </div>

          {/* Right: Actions & User */}
          <div className="flex items-center gap-8">
            {/* Status Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
              <Wifi size={14} />
              <span>Conectado</span>
            </div>

            <div className="flex items-center gap-6 border-l border-slate-200 pl-8">
              <button className="text-slate-400 hover:text-slate-600 transition-colors relative">
                <Bell size={20} />
                <span className="absolute top-0 right-0 w-2 h-2 bg-brand-500 rounded-full border border-white"></span>
              </button>

              <div className="flex items-center gap-4 cursor-pointer group relative">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-800 group-hover:text-brand-700 transition-colors">
                    {user ? `${user.name} ${user.surname.split(' ')[0]}.` : 'Usuario'}
                  </p>
                  <p className="text-[11px] text-slate-500">{user?.position || getRolLabel(user?.rol)}</p>
                </div>
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 text-slate-600 group-hover:border-brand-300 group-hover:bg-brand-50 transition-all">
                  <UserIcon size={20} />
                </div>

                {onLogout && (
                  <>
                    {/* Puente invisible para que el ratón no pierda el hover al desplazarse hacia el botón */}
                    <div className="absolute top-full left-0 right-0 h-2" />
                    <button
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onLogout();
                      }}
                      className="absolute top-full mt-2 right-0 bg-white border border-slate-200 rounded-lg shadow-lg py-2 px-4 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto flex items-center gap-2"
                    >
                      <LogOut size={14} />
                      Cerrar Sesión
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
