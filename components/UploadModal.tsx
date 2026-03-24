import React from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Trash2, Database, Settings } from 'lucide-react';
import { UploadedFile, User } from '../types';
import { FundLimit } from '../data/fundLimits';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  isProcessing: boolean;
  validationError: string | null;
  handleReset: () => void;
  officialFile: UploadedFile | null;
  positionFile: UploadedFile | null;
  onFileSelect: (file: File, type: 'position' | 'official' | 'master' | 'limits') => void;
  onRemoveFile: (type: 'official' | 'position' | 'master' | 'limits') => void;
  masterFile: UploadedFile | null;
  limitsFile: UploadedFile | null;
  fundLimits: FundLimit[];
  setFundLimits: (limits: FundLimit[]) => void;
  onShowMasterModal: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isProcessing,
  validationError,
  handleReset,
  officialFile,
  positionFile,
  onFileSelect,
  onRemoveFile,
  masterFile,
  limitsFile,
  onShowMasterModal
}) => {
  if (!isOpen) return null;

  const isMaster = currentUser?.rol === 'Master';
  const isCompliance = currentUser?.rol === 'Compliance';

  const FileInput = ({ 
    id, 
    label, 
    file, 
    accept = ".xlsx,.xls,.csv",
    type 
  }: { 
    id: string; 
    label: string; 
    file: UploadedFile | null; 
    accept?: string;
    type: 'position' | 'official' | 'master' | 'limits';
  }) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {label}
        </label>
        {file && (
          <button 
            onClick={() => onRemoveFile(type)}
            className="text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <div className="relative group">
        {!file ? (
          <>
            <input
              type="file"
              accept={accept}
              onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0], type)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 group-hover:border-brand-300 group-hover:bg-brand-50/30 transition-all">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-brand-500 group-hover:border-brand-100 shadow-sm transition-all">
                <Upload size={16} />
              </div>
              <span className="text-xs text-slate-500 font-medium">Seleccionar archivo...</span>
            </div>
          </>
        ) : (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
            file.status === 'success' 
              ? 'border-emerald-100 bg-emerald-50/30' 
              : file.status === 'error'
              ? 'border-red-100 bg-red-50/30'
              : 'border-brand-100 bg-brand-50/30'
          }`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${
              file.status === 'success' ? 'bg-white text-emerald-500 border border-emerald-100' :
              file.status === 'error' ? 'bg-white text-red-500 border border-red-100' :
              'bg-white text-brand-500 border border-brand-100'
            }`}>
              {file.status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{file.name}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
                {file.status === 'loading' ? 'Procesando...' : `${file.size} • ${file.date}`}
              </p>
            </div>
            {file.status === 'success' && <CheckCircle2 size={16} className="text-emerald-500" />}
            {file.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-600/20">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Carga de Datos Diarios</h2>
              <p className="text-xs text-slate-500 font-medium">Actualiza el estado de la cartera y límites</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-8">
          {validationError && (
            <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
              <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-grow">
                <p className="text-sm font-semibold text-red-800">Error de Validación</p>
                <p className="text-xs text-red-600 mt-1 leading-relaxed">{validationError}</p>
                <button 
                  onClick={handleReset}
                  className="mt-3 text-xs font-bold text-red-700 hover:underline flex items-center gap-1"
                >
                  Reiniciar y reintentar
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Sección Gestor */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-brand-500 rounded-full"></div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Datos de Cartera</h3>
              </div>
              
              <FileInput 
                id="official" 
                label="Valoración Oficial (Excel)" 
                file={officialFile} 
                type="official"
              />
              
              <FileInput 
                id="position" 
                label="Posiciones Intradía (Excel)" 
                file={positionFile} 
                type="position"
              />
            </div>

            {/* Sección Control/Master */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-brand-500 rounded-full"></div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Configuración & Límites</h3>
              </div>

              <FileInput 
                id="master" 
                label="Maestro de Activos" 
                file={masterFile} 
                type="master"
              />

              <FileInput 
                id="limits" 
                label="Fichero de Límites" 
                file={limitsFile} 
                type="limits"
              />

              {isMaster && (
                <button
                  onClick={onShowMasterModal}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-600 transition-all">
                      <Settings size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-700">Configuración Manual</p>
                      <p className="text-[10px] text-slate-400">Gestionar fondos y emisores</p>
                    </div>
                  </div>
                  <CheckCircle2 size={16} className="text-slate-300 group-hover:text-brand-500" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <p className="text-[10px] text-slate-400 font-medium max-w-[240px]">
            Los archivos cargados se procesarán para extraer posiciones, AUM y cumplimiento normativo.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={onClose}
              disabled={isProcessing || (!officialFile && !positionFile)}
              className="px-8 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-xl shadow-brand-600/20 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  Confirmar y Analizar
                  <CheckCircle2 size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
