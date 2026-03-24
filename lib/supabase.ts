import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno de Supabase. ' +
    'Crea un archivo .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
  );
}

// Singleton: este objeto gestiona el pool de conexiones, la caché del JWT
// y el WebSocket de Realtime. Importarlo desde aquí en todos los archivos.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // El SDK guarda el JWT en localStorage automáticamente con clave 'sb-<project>-auth-token'
    persistSession: true,
    // Refresca el JWT antes de que expire (tokens duran 1h por defecto)
    autoRefreshToken: true,
    // Necesario para detectar el redirect tras aceptar una invitación por email
    detectSessionInUrl: true,
    // Desactivar navigator.locks — evita NavigatorLockAcquireTimeoutError cuando
    // el refresh del token cuelga. Seguro para uso single-tab.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
});
