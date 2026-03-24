import React from 'react';
import { ArrowUpRight, ArrowDownRight, HelpCircle } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, subValue, trend, trendValue, icon, highlight }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow duration-300 relative overflow-hidden group">
      {highlight && <div className="absolute top-0 left-0 w-1 h-full bg-brand-600" />}
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{value}</span>
            {subValue && <span className="text-sm font-medium text-slate-500">{subValue}</span>}
          </div>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg text-brand-700 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
          {icon}
        </div>
      </div>

      {trend && (
        <div className="flex items-center pt-4 border-t border-slate-50">
          <span className={`
            flex items-center text-xs font-semibold px-1.5 py-0.5 rounded mr-2
            ${trend === 'up' ? 'text-green-700 bg-green-50' : ''}
            ${trend === 'down' ? 'text-red-700 bg-red-50' : ''}
            ${trend === 'neutral' ? 'text-slate-600 bg-slate-100' : ''}
          `}>
            {trend === 'up' && <ArrowUpRight size={12} className="mr-1" />}
            {trend === 'down' && <ArrowDownRight size={12} className="mr-1" />}
            {trendValue}
          </span>
          <span className="text-xs text-slate-400">vs. periodo anterior</span>
        </div>
      )}
    </div>
  );
};