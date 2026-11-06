import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, Info, Inbox } from 'lucide-react';
import { STATUS_VENDA, STATUS_OPORT, dinheiro, corLucro, pct, parseNum } from '../lib/fmt';

// ---------- Avisos (toasts)
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [itens, setItens] = useState([]);
  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = Math.random();
    setItens((l) => [...l, { id, texto, tipo }]);
    setTimeout(() => setItens((l) => l.filter((i) => i.id !== id)), tipo === 'erro' ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={avisar}>
      {children}
      <div className="fixed z-[80] top-3 right-3 left-3 sm:left-auto flex flex-col gap-2 items-stretch sm:items-end pointer-events-none" aria-live="polite">
        {itens.map((t) => (
          <div key={t.id} className={`fade-in pointer-events-auto flex items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-2xl border max-w-sm
            ${t.tipo === 'erro' ? 'bg-red-950 border-red-500/40 text-red-100' : t.tipo === 'info' ? 'bg-painel2 border-borda text-slate-100' : 'bg-emerald-950 border-emerald-500/40 text-emerald-100'}`}>
            {t.tipo === 'erro' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : t.tipo === 'info' ? <Info size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
            <span>{t.texto}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- Janela (modal)
export function Modal({ titulo, aberto, fechar, children, largura = 'max-w-2xl', rodape }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e) => e.key === 'Escape' && fechar();
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [aberto, fechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={fechar} />
      <div ref={ref} className={`fade-in relative w-full ${largura} bg-painel border border-borda sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[94vh] flex flex-col`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-borda">
          <h2 className="text-base sm:text-lg font-bold text-white truncate">{titulo}</h2>
          <button onClick={fechar} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {rodape && <div className="px-5 py-3 border-t border-borda flex flex-wrap justify-end gap-2">{rodape}</div>}
      </div>
    </div>
  );
}

// ---------- Confirmação
const ConfCtx = createContext(async () => false);
export function ConfirmProvider({ children }) {
  const [p, setP] = useState(null);
  const confirmar = useCallback((texto, opts = {}) => new Promise((ok) => setP({ texto, ok, ...opts })), []);
  const fim = (v) => { p?.ok(v); setP(null); };
  return (
    <ConfCtx.Provider value={confirmar}>
      {children}
      <Modal titulo={p?.titulo || 'Confirmar'} aberto={!!p} fechar={() => fim(false)} largura="max-w-md"
        rodape={<><button className="btn-sec" onClick={() => fim(false)}>Voltar</button><button className={p?.perigo ? 'btn bg-red-600 hover:bg-red-500 text-white' : 'btn-pri'} onClick={() => fim(true)}>{p?.botao || 'Confirmar'}</button></>}>
        <p className="text-sm text-slate-300 leading-relaxed">{p?.texto}</p>
      </Modal>
    </ConfCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfCtx);

// ---------- Campos
export function Campo({ rotulo, dica, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {rotulo && <span className="label">{rotulo}</span>}
      {children}
      {dica && <span className="block text-[11px] text-slate-500 mt-1">{dica}</span>}
    </label>
  );
}

// campo de valor em reais que aceita vírgula
export function CampoValor({ value, onChange, placeholder = '0,00', className = '', ...resto }) {
  const [txt, setTxt] = useState(value === null || value === undefined || value === '' ? '' : String(value).replace('.', ','));
  const ult = useRef(value);
  useEffect(() => {
    if (value !== ult.current) {
      ult.current = value;
      const atual = parseNum(txt);
      if (atual !== (value === '' ? null : value)) setTxt(value === null || value === undefined || value === '' ? '' : String(value).replace('.', ','));
    }
  }, [value]); // eslint-disable-line
  return (
    <input {...resto} inputMode="decimal" className={`input num ${className}`} placeholder={placeholder} value={txt}
      onChange={(e) => { const t = e.target.value.replace(/[^\d.,-]/g, ''); setTxt(t); const n = parseNum(t); ult.current = n; onChange(n); }} />
  );
}

export const Spinner = ({ tamanho = 20, className = '' }) => <Loader2 size={tamanho} className={`animate-spin text-marca-400 ${className}`} />;
export const Carregando = () => <div className="flex justify-center py-20"><Spinner tamanho={30} /></div>;

export function Vazio({ icone: Icone = Inbox, titulo, texto, acao }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-painel2 border border-borda flex items-center justify-center mb-4"><Icone size={24} className="text-slate-500" /></div>
      <p className="font-semibold text-slate-200">{titulo}</p>
      {texto && <p className="text-sm text-slate-500 mt-1 max-w-sm">{texto}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export const ChipVenda = ({ status }) => {
  const s = STATUS_VENDA[status] || STATUS_VENDA.empenhada;
  return <span className={`chip ${s.cor}`}>{s.rotulo}</span>;
};
export const ChipOport = ({ status }) => {
  const s = STATUS_OPORT[status] || STATUS_OPORT.cotando;
  return <span className={`chip ${s.cor}`}>{s.rotulo}</span>;
};

export function Lucro({ valor, margem, grande = false }) {
  if (valor === null || valor === undefined) return <span className="text-xs text-slate-500 italic">sem custo</span>;
  return (
    <span className={`num font-semibold ${corLucro(valor)} ${grande ? 'text-lg' : ''}`}>
      {valor < 0 ? '−' : ''}{dinheiro(Math.abs(valor))}
      {margem !== undefined && margem !== null && <span className="text-[11px] opacity-75 ml-1">({pct(margem)})</span>}
    </span>
  );
}

export function Kpi({ titulo, valor, sub, icone: Icone, tom = 'marca', onClick }) {
  const tons = {
    marca: 'text-marca-300 bg-marca-500/10', verde: 'text-emerald-300 bg-emerald-500/10', ambar: 'text-amber-300 bg-amber-500/10',
    vermelho: 'text-red-300 bg-red-500/10', roxo: 'text-violet-300 bg-violet-500/10', cinza: 'text-slate-300 bg-slate-500/10',
  };
  const El = onClick ? 'button' : 'div';
  return (
    <El onClick={onClick} className={`card p-4 sm:p-5 text-left min-w-0 ${onClick ? 'hover:border-marca-500/50 transition' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{titulo}</span>
        {Icone && <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tons[tom]}`}><Icone size={16} /></span>}
      </div>
      <div className={`num text-xl sm:text-2xl font-bold mt-2 truncate ${tons[tom].split(' ')[0]}`}>{valor}</div>
      {sub && <div className="text-xs text-slate-500 mt-1 truncate">{sub}</div>}
    </El>
  );
}

export function Cabecalho({ titulo, sub, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-white">{titulo}</h1>
        {sub && <p className="text-sm text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Abas({ abas, valor, mudar }) {
  return (
    <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
      {abas.map((a) => (
        <button key={a.id} onClick={() => mudar(a.id)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${valor === a.id ? 'bg-marca-600 border-marca-500 text-white' : 'bg-painel2 border-borda text-slate-400 hover:text-white'}`}>
          {a.rotulo}{a.qtd !== undefined && <span className="ml-1.5 opacity-70">{a.qtd}</span>}
        </button>
      ))}
    </div>
  );
}

// hook simples de carregamento
export function useDados(fn, deps = []) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null });
  const recarregar = useCallback(async () => {
    setEstado((e) => ({ ...e, carregando: true }));
    try { setEstado({ dados: await fn(), carregando: false, erro: null }); } catch (e) { setEstado({ dados: null, carregando: false, erro: e }); }
  }, deps); // eslint-disable-line
  useEffect(() => { recarregar(); }, [recarregar]);
  return { ...estado, recarregar };
}

export function ErroCaixa({ erro, tentar }) {
  return (
    <div className="card p-6 text-center">
      <AlertTriangle className="mx-auto text-amber-400 mb-2" />
      <p className="text-sm text-slate-300">{erro?.message || 'Não foi possível carregar.'}</p>
      {tentar && <button className="btn-sec mt-4" onClick={tentar}>Tentar de novo</button>}
    </div>
  );
}
