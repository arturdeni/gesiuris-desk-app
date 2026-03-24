import React, { useState } from 'react';
import { Save, AlertTriangle, Edit2, RotateCcw } from 'lucide-react';
import { FundLimit } from '../data/fundLimits';

interface FundLimitEditorProps {
  limits: FundLimit[];
  onSave: (newLimits: FundLimit[]) => void;
}

export const FundLimitEditor: React.FC<FundLimitEditorProps> = ({ limits, onSave }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempLimits, setTempLimits] = useState<FundLimit[]>(limits);

  const handleEditChange = (code: string, field: 'minEquity' | 'maxEquity', value: string) => {
    // Convert percentage string input (e.g. "75") back to decimal (0.75)
    const numValue = parseFloat(value);
    const decimalValue = isNaN(numValue) ? 0 : numValue / 100;

    setTempLimits(prev => prev.map(l => 
      l.code === code ? { ...l, [field]: decimalValue } : l
    ));
  };

  const saveChanges = () => {
    onSave(tempLimits);
    setEditingId(null);
  };

  const cancelChanges = () => {
    setTempLimits(limits); // Revert to props
    setEditingId(null);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Edit2 size={18} className="text-brand-600" />
            Configuración de Límites (Repositorio Interno)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Modifica los límites de Renta Variable (Folleto) aplicados en las reglas de validación.
          </p>
        </div>
        {editingId === 'global' ? (
          <div className="flex gap-2">
            <button 
              onClick={cancelChanges}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button 
              onClick={saveChanges}
              className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 rounded-lg hover:bg-brand-700 flex items-center gap-2 shadow-sm"
            >
              <Save size={14} /> Guardar Cambios
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setEditingId('global')}
            className="px-3 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 flex items-center gap-2"
          >
            <Edit2 size={14} /> Editar Tabla
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-3 font-bold">Código IIC</th>
              <th className="px-6 py-3 font-bold">Palabra Clave (Matching)</th>
              <th className="px-6 py-3 font-bold text-right">Límite Mínimo RV</th>
              <th className="px-6 py-3 font-bold text-right">Límite Máximo RV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tempLimits.map((limit) => {
              const isEditing = editingId === 'global';
              
              // Display as Percentage (0.75 -> 75)
              const displayMin = Math.round(limit.minEquity * 100);
              const displayMax = Math.round(limit.maxEquity * 100);

              return (
                <tr key={limit.code} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-slate-900">
                    {limit.code}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <span className="inline-block px-2 py-0.5 bg-slate-100 rounded border border-slate-200 text-xs">
                      {limit.nameKeywords}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <input 
                          type="number" 
                          value={displayMin}
                          onChange={(e) => handleEditChange(limit.code, 'minEquity', e.target.value)}
                          className="w-16 p-1 text-right border border-slate-300 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        />
                        <span className="text-slate-400">%</span>
                      </div>
                    ) : (
                      <span className={`font-bold ${limit.minEquity < 0 ? 'text-slate-400' : 'text-slate-700'}`}>
                        {displayMin}%
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                       <div className="flex items-center justify-end gap-1">
                        <input 
                          type="number" 
                          value={displayMax}
                          onChange={(e) => handleEditChange(limit.code, 'maxEquity', e.target.value)}
                          className="w-16 p-1 text-right border border-slate-300 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        />
                        <span className="text-slate-400">%</span>
                      </div>
                    ) : (
                      <span className="font-bold text-slate-700">
                        {displayMax}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
        <p>
          <strong>Nota:</strong> Los cambios realizados aquí son temporales para la sesión actual. 
          Para hacerlos permanentes, contacta con el equipo de desarrollo para actualizar el archivo <code>data/fundLimits.ts</code>.
        </p>
      </div>
    </div>
  );
};