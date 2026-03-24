import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Database, Globe, Layers, ArrowUpDown, ArrowUp, ArrowDown, Filter, CheckCircle, Plus, Loader2, AlertCircle } from 'lucide-react';
import { Instrument } from '../data/maestro';

interface MasterDataModalProps {
  onClose: () => void;
  onSelect?: (instrument: Instrument) => void; // Optional prop for selection mode
}

type SortKey = keyof Instrument;
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export const MasterDataModal: React.FC<MasterDataModalProps> = ({ onClose, onSelect }) => {
  const [data, setData] = useState<Instrument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'nombreActivo', direction: 'asc' });
  
  // Advanced Filters State
  const [filters, setFilters] = useState({
    pais: '',
    sector: '',
    subsector: '',
    moneda: ''
  });

  const [showFilters, setShowFilters] = useState(false);

  // --- 1. FETCH DATA ON MOUNT ---
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Try multiple paths to locate the file depending on the environment (Vite, custom server, etc.)
        const pathsToTry = [
          '/maestro.json',        // Root absolute (standard for public folder)
          'maestro.json',         // Relative
          '/public/maestro.json', // Explicit public absolute
          'public/maestro.json'   // Explicit public relative
        ];

        let jsonData: Instrument[] | null = null;
        let successPath = '';

        for (const path of pathsToTry) {
          try {
            const response = await fetch(path);
            // Only process if status is OK
            if (response.ok) {
              const text = await response.text();
              // Validate that it looks like JSON (starts with [) to avoid parsing HTML 404 pages
              if (text.trim().startsWith('[')) {
                // SANITIZATION: Replace "NaN" with "null" to fix common JSON syntax errors
                // Regex looks for : followed by whitespace and NaN, ensuring word boundary
                const sanitizedText = text.replace(/:\s*NaN\b/g, ': null');
                
                try {
                  jsonData = JSON.parse(sanitizedText);
                  successPath = path;
                  break; // Stop once we found it
                } catch (parseError) {
                  console.warn(`Failed to parse JSON from ${path}:`, parseError);
                  // Continue to try other paths or fail later
                }
              }
            }
          } catch (ignored) {
            // Continue to next path
          }
        }
        
        if (Array.isArray(jsonData)) {
          console.log(`Master Data loaded successfully from: ${successPath}`);
          setData(jsonData);
        } else {
          throw new Error('No se pudo encontrar el archivo maestro.json o el formato no es un array válido.');
        }
      } catch (err) {
        console.error("Error loading master data:", err);
        setError("Error de Carga: No se encuentra 'maestro.json' en la carpeta pública o el archivo está corrupto (NaN).");
      } finally {
        setIsLoading(false);
      }
    };

    loadMasterData();
  }, []);

  // --- 2. DERIVED DATA (DROPDOWNS) ---
  // Memoize these based on the loaded data so we don't recalculate on every render
  const { uniqueCountries, uniqueSectors, uniqueSubsectors, uniqueCurrencies } = useMemo(() => {
    if (data.length === 0) return { uniqueCountries: [], uniqueSectors: [], uniqueSubsectors: [], uniqueCurrencies: [] };

    const countries = new Set<string>();
    const sectors = new Set<string>();
    const subsectors = new Set<string>();
    const currencies = new Set<string>();

    data.forEach(item => {
      if (item.pais) countries.add(item.pais);
      if (item.sector) sectors.add(item.sector);
      if (item.subsector) subsectors.add(item.subsector);
      if (item.moneda) currencies.add(item.moneda);
    });

    return {
      uniqueCountries: Array.from(countries).sort(),
      uniqueSectors: Array.from(sectors).sort(),
      uniqueSubsectors: Array.from(subsectors).sort(),
      uniqueCurrencies: Array.from(currencies).sort()
    };
  }, [data]);

  // --- 3. FILTERING LOGIC ---
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // 1. Text Search (Optimized: check only if searchTerm exists)
      let matchesSearch = true;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        matchesSearch = 
          (item.nombreActivo && item.nombreActivo.toLowerCase().includes(query)) ||
          (item.ticker && item.ticker.toLowerCase().includes(query)) ||
          (item.isin && item.isin.toLowerCase().includes(query));
      }

      // 2. Specific Filters
      const matchesCountry = filters.pais ? item.pais === filters.pais : true;
      const matchesSector = filters.sector ? item.sector === filters.sector : true;
      const matchesSubsector = filters.subsector ? item.subsector === filters.subsector : true;
      const matchesCurrency = filters.moneda ? item.moneda === filters.moneda : true;

      return matchesSearch && matchesCountry && matchesSector && matchesSubsector && matchesCurrency;
    });
  }, [data, searchTerm, filters]);

  // --- 4. SORTING LOGIC ---
  const sortedData = useMemo(() => {
    // Limit initial sort to first 100 for speed if needed, but modern browsers handle 14k sorts fast.
    // We create a shallow copy to not mutate state
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;
      
      // Handle nulls
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="text-slate-300" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={12} className="text-brand-600" />
      : <ArrowDown size={12} className="text-brand-600" />;
  };

  const handleSelectInstrument = (item: Instrument) => {
    if (onSelect) {
      onSelect(item);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-200">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center text-brand-700">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Maestro de Instrumentos</h3>
                <p className="text-sm text-slate-500">
                  {onSelect 
                    ? "Selecciona un activo para llevar a la Boleta de Órdenes" 
                    : "Base de datos centralizada de activos de Renta Variable"}
                </p>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="flex-grow flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
            <p className="text-slate-500 font-medium">Cargando 14.000 registros...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {!isLoading && error && (
          <div className="flex-grow flex flex-col items-center justify-center space-y-4 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Error de Carga</h3>
            <p className="text-slate-500 max-w-md">{error}</p>
            <p className="text-xs text-slate-400 bg-slate-100 p-2 rounded">
              Tip: Verifica que <code>public/maestro.json</code> existe y tiene formato JSON válido.
            </p>
          </div>
        )}

        {/* DATA CONTENT */}
        {!isLoading && !error && (
          <>
            {/* Toolbar & Filters */}
            <div className="px-8 py-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="relative w-96">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input 
                    type="text"
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="Buscar por ISIN, Ticker o Nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center gap-4">
                   <button 
                     onClick={() => setShowFilters(!showFilters)}
                     className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-brand-100 text-brand-700' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                   >
                     <Filter size={16} />
                     Filtros
                   </button>
                   <div className="text-xs font-mono text-slate-400">
                    {sortedData.length} registros
                  </div>
                </div>
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className="grid grid-cols-4 gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-top-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">País</label>
                    <select 
                      className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                      value={filters.pais}
                      onChange={(e) => setFilters({...filters, pais: e.target.value})}
                    >
                      <option value="">Todos los países</option>
                      {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sector</label>
                    <select 
                      className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                      value={filters.sector}
                      onChange={(e) => setFilters({...filters, sector: e.target.value})}
                    >
                      <option value="">Todos los sectores</option>
                      {uniqueSectors.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subsector</label>
                    <select 
                      className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                      value={filters.subsector}
                      onChange={(e) => setFilters({...filters, subsector: e.target.value})}
                    >
                      <option value="">Todos los subsectores</option>
                      {uniqueSubsectors.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda</label>
                    <select 
                      className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                      value={filters.moneda}
                      onChange={(e) => setFilters({...filters, moneda: e.target.value})}
                    >
                      <option value="">Todas</option>
                      {uniqueCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Table Content */}
            <div className="flex-grow overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                  <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('tipologia')}>
                      <div className="flex items-center gap-2">Tipología <SortIcon columnKey="tipologia" /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('isin')}>
                      <div className="flex items-center gap-2">Identificadores (ISIN / Ticker) <SortIcon columnKey="isin" /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('codigoEmisora')}>
                      <div className="flex items-center gap-2">Emisor <SortIcon columnKey="codigoEmisora" /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('nombreActivo')}>
                      <div className="flex items-center gap-2">Nombre Activo <SortIcon columnKey="nombreActivo" /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('sector')}>
                      <div className="flex items-center gap-2">Sector / Subsector <SortIcon columnKey="sector" /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('pais')}>
                      <div className="flex items-center gap-2">Región / País <SortIcon columnKey="pais" /></div>
                    </th>
                    <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('moneda')}>
                      <div className="flex items-center justify-center gap-2">Moneda <SortIcon columnKey="moneda" /></div>
                    </th>
                    {onSelect && <th className="px-6 py-4 text-center">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {/* Virtualization would be ideal here for 14k rows, but standard mapping works for MVP if not rendering all at once. 
                      Ideally, slice the sortedData to only render visible rows or first 100 + pagination. 
                      For this demo, I will slice to first 200 to prevent DOM overload. */}
                  {sortedData.slice(0, 200).map((item, idx) => (
                    <tr key={(item.isin || 'no-isin') + idx} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          {item.tipologia}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-bold text-slate-700">{item.isin || '-'}</span>
                          <span className="font-mono text-xs text-slate-400">{item.ticker}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {item.codigoEmisora}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-800">{item.nombreActivo}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                            <Layers size={10} /> {item.sector}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                            {item.subsector || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-700">{item.pais}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Globe size={10} /> {item.region}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-bold font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          {item.moneda}
                        </span>
                      </td>
                      {onSelect && (
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleSelectInstrument(item)}
                            className="bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white p-2 rounded-full transition-colors shadow-sm border border-brand-200"
                            title="Seleccionar para Boleta"
                          >
                            <Plus size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  
                  {sortedData.length === 0 && (
                    <tr>
                      <td colSpan={onSelect ? 8 : 7} className="px-6 py-12 text-center text-slate-400">
                        No se encontraron activos que coincidan con la búsqueda o filtros.
                      </td>
                    </tr>
                  )}
                  {sortedData.length > 200 && (
                     <tr>
                      <td colSpan={onSelect ? 8 : 7} className="px-6 py-4 text-center text-xs text-slate-400 italic border-t border-slate-100">
                        Mostrando primeros 200 de {sortedData.length} resultados. Refina tu búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Footer */}
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 flex justify-between items-center">
              <span>Datos actualizados desde Fuente Interna (Carga Asíncrona)</span>
              <span>Gesiuris Asset Management {onSelect ? '• Modo Selección' : '• Solo Lectura'}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};