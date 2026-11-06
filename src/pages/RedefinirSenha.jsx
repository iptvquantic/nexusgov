import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui';
import { Logo } from '../components/Layout';

export default function RedefinirSenha() {
  const [sp] = useSearchParams();
  const token = sp.get('token');
  const { entrar } = useAuth();
  const avisar = useToast();
  const nav = useNavigate();
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (s1 !== s2) return avisar('As senhas não são iguais.', 'erro');
    setEnviando(true);
    try {
      const r = await api('/auth/redefinir', { method: 'POST', body: { token, senha: s1 } });
      entrar(r.token, r.usuario);
      avisar('Senha alterada! Você já está dentro.');
      nav('/');
    } catch (err) { avisar(err.message, 'erro'); } finally { setEnviando(false); }
  };

  return (
    <div className="min-h-screen bg-fundo flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6"><Logo /></div>
        {!token ? (
          <div className="card p-6"><p className="text-slate-300">Link inválido.</p><Link to="/entrar" className="btn-pri mt-4">Ir para o login</Link></div>
        ) : (
          <form onSubmit={enviar} className="card p-6 space-y-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2"><KeyRound size={20} className="text-marca-400" />Criar nova senha</h1>
            <label className="block"><span className="label">Nova senha</span><input className="input" type="password" minLength={6} required value={s1} onChange={(e) => setS1(e.target.value)} /></label>
            <label className="block"><span className="label">Repita a nova senha</span><input className="input" type="password" minLength={6} required value={s2} onChange={(e) => setS2(e.target.value)} /></label>
            <button className="btn-pri w-full" disabled={enviando}>{enviando && <Loader2 size={16} className="animate-spin" />}Salvar e entrar</button>
          </form>
        )}
      </div>
    </div>
  );
}
