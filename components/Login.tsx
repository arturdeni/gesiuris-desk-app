import React, { useState } from 'react';
import { Lock, ArrowRight, User as UserIcon, AlertCircle } from 'lucide-react';
import { AUTHORIZED_USERS } from '../data/users';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simulate network delay for better UX feeling
    setTimeout(() => {
      const foundUser = AUTHORIZED_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
      );

      if (foundUser) {
        setIsLoading(false);
        onLogin(foundUser);
      } else {
        setIsLoading(false);
        setError("Usuario o Contraseña equivocados. Por favor, intenta de nuevo");
      }
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Section */}
        <div className="bg-slate-900 px-8 py-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-500"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-6">
              G
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">
              Gesiuris<span className="text-slate-400 font-light">Desk</span>
            </h1>
          </div>
          
          {/* Decorative background circle */}
          <div className="absolute -bottom-24 -right-10 w-48 h-48 bg-slate-800 rounded-full opacity-50 blur-2xl"></div>
          <div className="absolute -top-24 -left-10 w-48 h-48 bg-slate-800 rounded-full opacity-50 blur-2xl"></div>
        </div>

        {/* Form Section */}
        <div className="p-8 pt-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="text-red-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon size={18} />
                </div>
                <input
                  id="email"
                  type="text"
                  required
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-slate-50 focus:bg-white ${
                    error ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-500'
                  }`}
                  placeholder="nombre.apellido@gesiuris.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-slate-50 focus:bg-white ${
                    error ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-500'
                  }`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600">
                  Recordarme
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-brand-600 hover:text-brand-500">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                'Verificando...'
              ) : (
                <>
                  Acceder al Sistema <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">
            Acceso restringido. Gesiuris Asset Management SGIIC SA
          </p>
        </div>
      </div>
    </div>
  );
};