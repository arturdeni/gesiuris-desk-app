import React, { useCallback, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { UploadedFile } from '../types';

interface FileDropZoneProps {
  id: string;
  title: string;
  description: string;
  requiredColumns: string[];
  file: UploadedFile | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  id,
  title,
  description,
  requiredColumns,
  file,
  onFileSelect,
  onRemove,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !file) setIsDragging(true);
  }, [disabled, file]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || file) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [disabled, file, onFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  // State: Loaded Successfully
  if (file && file.status === 'success') {
    return (
      <div className="relative group w-full h-64 bg-white rounded-xl border-2 border-green-200 bg-green-50/30 flex flex-col items-center justify-center p-6 transition-all duration-300">
        <button 
          onClick={onRemove}
          className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs uppercase font-semibold tracking-wider"
        >
          Remover
        </button>
        <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
          <CheckCircle2 size={32} />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">{file.name}</h3>
        <p className="text-sm text-slate-500 mt-1">Datos extraídos: {file.date}</p>
        <div className="mt-4 px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
          Carga Completa
        </div>
      </div>
    );
  }

  // State: Loading
  if (file && file.status === 'loading') {
    return (
      <div className="w-full h-64 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-6">
        <Loader2 className="animate-spin text-brand-600 mb-4" size={32} />
        <p className="text-sm text-slate-600 font-medium">Procesando archivo...</p>
        <p className="text-xs text-slate-400 mt-2">Validando estructura de columnas</p>
      </div>
    );
  }

  // State: Error
  if (file && file.status === 'error') {
     return (
      <div className="relative w-full h-64 bg-red-50 rounded-xl border-2 border-red-200 flex flex-col items-center justify-center p-6">
         <button 
          onClick={onRemove}
          className="absolute top-4 right-4 text-red-500 hover:text-red-700 text-xs uppercase font-semibold tracking-wider"
        >
          Reintentar
        </button>
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-lg font-semibold text-red-900">Error de Validación</h3>
        <p className="text-sm text-red-700 mt-1 text-center">El formato no coincide con lo esperado.</p>
      </div>
    );
  }

  // State: Idle / Dragging
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        w-full h-64 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-8 relative cursor-pointer
        ${isDragging 
          ? 'border-brand-500 bg-brand-50 shadow-inner' 
          : 'border-slate-300 bg-white hover:border-brand-300 hover:bg-slate-50 hover:shadow-sm'
        }
      `}
    >
      <input
        type="file"
        id={id}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={handleInputChange}
        disabled={disabled}
      />
      
      <div className={`p-4 rounded-full mb-4 transition-colors ${isDragging ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400'}`}>
        <UploadCloud size={32} />
      </div>

      <h3 className="text-lg font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 text-center max-w-xs">{description}</p>
      
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {requiredColumns.map(col => (
          <span key={col} className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wide rounded border border-slate-200">
            {col}
          </span>
        ))}
      </div>
    </div>
  );
};
