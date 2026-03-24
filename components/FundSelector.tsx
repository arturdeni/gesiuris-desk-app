import React from 'react';
import { Fund } from '../types';
import { ChevronDown } from 'lucide-react';

interface FundSelectorProps {
  selectedFundId: string;
  funds: Fund[];
  onFundChange: (id: string) => void;
  className?: string;
}

export const FundSelector: React.FC<FundSelectorProps> = ({
  selectedFundId,
  funds,
  onFundChange,
  className = ""
}) => {
  const selectedFund = funds.find(f => f.id === selectedFundId);

  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={selectedFundId}
        onChange={(e) => onFundChange(e.target.value)}
        className="appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
      >
        {funds.map((fund) => (
          <option key={fund.id} value={fund.id}>
            {fund.name} ({fund.ticker})
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
        <ChevronDown size={16} />
      </div>
    </div>
  );
};
