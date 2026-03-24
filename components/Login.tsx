import React, { useState } from 'react';
import { Lock, ArrowRight, User as UserIcon, AlertCircle, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  // Ya no recibe un User: App.tsx reacciona al evento SIGNED_IN de onAuthStateChange
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectMetaMask = async () => {
    setError(null);
    setIsLoading(true);

    if (typeof (window as any).ethereum !== 'undefined') {
      try {
        // Request account access
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];
        console.log('Connected account:', account);
        
        // In a real app, we would verify this address with Supabase or a backend
        // For now, we'll simulate a successful login
        onLoginSuccess();
      } catch (err: any) {
        console.error('MetaMask connection error:', err);
        setError(err.message || 'Error al conectar con MetaMask');
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
      setError('MetaMask no está instalado. Por favor, instala la extensión para continuar.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Llamada real al servidor de Supabase Auth (GoTrue)
    // El SDK guarda el JWT en localStorage automáticamente si el login es exitoso
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setIsLoading(false);

    if (authError) {
      // Supabase devuelve 'Invalid login credentials' para email/password incorrectos
      setError('Usuario o Contraseña equivocados. Por favor, intenta de nuevo.');
    } else {
      // El SDK dispara onAuthStateChange(SIGNED_IN) en App.tsx, que carga el perfil
      // y cambia la fase. Este callback es solo por si App.tsx lo necesita para algo extra.
      onLoginSuccess();
    }
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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-400">O también</span>
              </div>
            </div>

            <button
              type="button"
              onClick={connectMetaMask}
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Wallet size={18} className="text-orange-500" />
              Conectar con MetaMask
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
