import { useEffect, useState } from 'react';
import { ClipboardPaste, Globe, Loader2, Mail, Pencil, Phone, Plus, Search, Trash2, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { Cabecalho, Campo, ErroCaixa, Modal, Spinner, Vazio, useConfirm, useDados, useToast } from '../components/ui';
import { data, dinheiro } from '../lib/fmt';

export default function Fornecedores() {
  const avisar = useToast();
  const confirmar = useConfirm();
  const [busca, setBusca] = useState('');
  const [buscaQ, setBuscaQ] = useState('');
  const [form, setForm] = useState(null);
  const [importar, setImportar] = useState(false);
  useEffect(() => { const t = setTimeout(() => setBuscaQ(busca), 300); return () => clearTimeout(t); }, [busca]);
  const { dados, erro, recarregar } = useDados(() => api(`/fornecedores?busca=${encodeURIComponent(buscaQ)}`), [buscaQ]);
  const excluir = async (f) => {
    if (!(await confirmar(`Excluir ${f.nome}?`, { perigo: true, botao: 'Excluir' }))) return;
    try { await api(`/fornecedores/${f.id}`, { method: 'DELETE' }); avisar('Excluído.'); recarregar(); } catch (e) { avisar(e.message, 'erro'); }
  };
  const zap = (t) => `https://wa.me/55${String(t).replace(/\D/g, '').replace(/^55/, '')}`;

  return (
    <div className="fade-in">
      <Cabecalho titulo="Fornecedores" sub="Quem vende o quê, contatos e quanto você já comprou de cada um.">
        <button className="btn-sec" onClick={() => setImportar(true)}><ClipboardPaste size={16} />Colar lista</button>
        <button className="btn-pri" onClick={() => setForm({})}><Plus size={16} />Novo fornecedor</button>
      </Cabecalho>
      <div className="relative mb-4"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input className="input pl-9" placeholder="Buscar por nome, produto (ex.: fio, mangueira), cidade…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
      {erro ? <ErroCaixa erro={erro} tentar={recarregar} /> : !dados ? <div className="flex justify-center py-16"><Spinner tamanho={28} /></div> : dados.fornecedores.length === 0 ? (
        <div className="card"><Vazio icone={Truck} titulo={buscaQ ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor ainda'} texto="Cadastre ou cole a sua lista (nome; produtos; e-mail; telefone)." /></div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {dados.fornecedores.map((f) => (
            <div key={f.id} className="card p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-semibold text-white truncate">{f.nome}</p>{f.cidade && <p className="text-[11px] text-slate-500">{f.cidade}</p>}</div>
                <div className="flex shrink-0">
                  <button onClick={() => setForm(f)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5" aria-label="Editar"><Pencil size={14} /></button>
                  <button onClick={() => excluir(f)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10" aria-label="Excluir"><Trash2 size={14} /></button>
                </div>
              </div>
              {f.produtos && <p className="text-xs text-slate-400 mt-2 line-clamp-3">{f.produtos}</p>}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px]">
                {f.telefone && <a href={zap(f.telefone)} target="_blank" rel="noreferrer" className="text-marca-300 flex items-center gap-1 hover:underline"><Phone size={11} />{f.telefone}</a>}
                {f.email && f.email.split(/[;,\s]+/).filter(Boolean).slice(0, 2).map((e) => <a key={e} href={`mailto:${e}`} className="text-marca-300 flex items-center gap-1 hover:underline break-all"><Mail size={11} />{e}</a>)}
                {f.site && <a href={f.site.startsWith('http') ? f.site : `https://${f.site}`} target="_blank" rel="noreferrer" className="text-marca-300 flex items-center gap-1"><Globe size={11} />site</a>}
              </div>
              <div className="mt-auto pt-3 border-t border-borda grid grid-cols-3 gap-2 text-xs mt-3">
                <div><p className="text-slate-500">Vendas</p><p className="num text-slate-200">{f.vendas}</p></div>
                <div><p className="text-slate-500">Comprado</p><p className="num text-amber-300 truncate">{dinheiro(f.total_comprado)}</p></div>
                <div><p className="text-slate-500">Última</p><p className="num text-slate-400">{data(f.ultima_compra)}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
      {form && <FormFornecedor inicial={form} fechar={() => setForm(null)} salvo={() => { setForm(null); recarregar(); }} />}
      {importar && <ModalImportar fechar={() => setImportar(false)} pronto={() => { setImportar(false); recarregar(); }} />}
    </div>
  );
}

export function FormFornecedor({ inicial, fechar, salvo }) {
  const avisar = useToast();
  const [f, setF] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const m = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const salvar = async () => {
    setEnviando(true);
    try {
      const r = f.id ? await api(`/fornecedores/${f.id}`, { method: 'PUT', body: f }) : await api('/fornecedores', { method: 'POST', body: f });
      avisar('Fornecedor salvo.'); salvo(r.fornecedor);
    } catch (e) { avisar(e.message, 'erro'); } finally { setEnviando(false); }
  };
  return (
    <Modal titulo={f.id ? 'Editar fornecedor' : 'Novo fornecedor'} aberto fechar={fechar}
      rodape={<><button className="btn-sec" onClick={fechar}>Voltar</button><button className="btn-pri" disabled={enviando} onClick={salvar}>{enviando && <Loader2 size={15} className="animate-spin" />}Salvar</button></>}>
      <div className="grid sm:grid-cols-6 gap-3">
        <Campo rotulo="Nome *" className="sm:col-span-4"><input className="input" value={f.nome || ''} onChange={m('nome')} autoFocus /></Campo>
        <Campo rotulo="CNPJ" className="sm:col-span-2"><input className="input num" value={f.cnpj || ''} onChange={m('cnpj')} /></Campo>
        <Campo rotulo="Produtos que vende" className="sm:col-span-6"><textarea className="input" rows={2} value={f.produtos || ''} onChange={m('produtos')} placeholder="ex.: fios, cabos, disjuntores" /></Campo>
        <Campo rotulo="Contato" className="sm:col-span-2"><input className="input" value={f.contato || ''} onChange={m('contato')} /></Campo>
        <Campo rotulo="Telefone / WhatsApp" className="sm:col-span-2"><input className="input" value={f.telefone || ''} onChange={m('telefone')} /></Campo>
        <Campo rotulo="E-mail" className="sm:col-span-2"><input className="input" value={f.email || ''} onChange={m('email')} /></Campo>
        <Campo rotulo="Cidade" className="sm:col-span-2"><input className="input" value={f.cidade || ''} onChange={m('cidade')} /></Campo>
        <Campo rotulo="Site" className="sm:col-span-2"><input className="input" value={f.site || ''} onChange={m('site')} /></Campo>
        <Campo rotulo="Prazo de entrega (dias)" className="sm:col-span-2"><input type="number" className="input" value={f.prazo_entrega_dias ?? ''} onChange={m('prazo_entrega_dias')} /></Campo>
        <Campo rotulo="Observações" className="sm:col-span-6"><textarea className="input" rows={2} value={f.obs || ''} onChange={m('obs')} /></Campo>
      </div>
    </Modal>
  );
}

function ModalImportar({ fechar, pronto }) {
  const avisar = useToast();
  const [txt, setTxt] = useState('');
  const [enviando, setEnviando] = useState(false);
  const linhas = txt.split('\n').map((l) => l.split(/\t|;/).map((x) => x.trim())).filter((l) => l[0]);
  const enviar = async () => {
    setEnviando(true);
    try {
      const r = await api('/fornecedores/importar', { method: 'POST', body: { fornecedores: linhas.map(([nome, produtos, email, telefone, contato]) => ({ nome, produtos, email, telefone, contato })) } });
      avisar(`${r.criados} fornecedor(es) importado(s).`); pronto();
    } catch (e) { avisar(e.message, 'erro'); } finally { setEnviando(false); }
  };
  return (
    <Modal titulo="Colar lista de fornecedores" aberto fechar={fechar}
      rodape={<><button className="btn-sec" onClick={fechar}>Voltar</button><button className="btn-pri" disabled={enviando || !linhas.length} onClick={enviar}>{enviando && <Loader2 size={15} className="animate-spin" />}Importar {linhas.length || ''}</button></>}>
      <p className="text-sm text-slate-400 mb-2">Uma linha por fornecedor, colunas separadas por <b>;</b> ou copiadas do Excel, nesta ordem:</p>
      <p className="text-xs num text-marca-300 mb-3">nome ; produtos ; e-mail ; telefone ; contato</p>
      <textarea className="input num text-xs" rows={10} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={'Elétrica Silva; fios e cabos; vendas@silva.com; (11) 99999-0000; João\nHidráulica Sul; mangueiras; contato@sul.com.br'} />
      <p className="text-[11px] text-slate-500 mt-2">Repetidos (mesmo nome e produtos) são ignorados.</p>
    </Modal>
  );
}
