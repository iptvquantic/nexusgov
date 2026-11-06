import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, token, ganchos } from './api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(!!token.get());

  const recarregar = useCallback(async () => {
    if (!token.get()) { setUsuario(null); setCarregando(false); return null; }
    try {
      const r = await api('/auth/me');
      setUsuario(r.usuario);
      return r.usuario;
    } catch {
      setUsuario(null);
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);
  useEffect(() => {
    ganchos.sair(() => setUsuario(null));
    ganchos.plano(() => setUsuario((u) => (u ? { ...u, plano_ativo: false } : u)));
  }, []);

  const entrar = (t, u) => { token.set(t); setUsuario(u); };
  const sair = () => { token.set(null); setUsuario(null); };

  return <Ctx.Provider value={{ usuario, setUsuario, carregando, entrar, sair, recarregar }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
