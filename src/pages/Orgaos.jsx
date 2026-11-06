import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Loader2, Mail, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Cabecalho, Campo, ErroCaixa, Modal, Spinner, Vazio, useConfirm, useDados, useToast } from '../components/ui';
import { corLucro, data, dinheiro } from '../lib/fmt';

export default function Orgaos() {
  const avisar = useToast();
  const confirmar = useConfirm();
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null);
  const { dados, erro, recarregar } = useDados(() => api('/orgaos'), []);
  const b = busca.toLowerCase();
  const lista = (dados?.orgaos || []).filter((o) => !b || [o.nome, o.uasg, o.municipio, o.cnpj].some((x) => (x || '').toLowerCase().includes(b)));
  const excluir = async (o) => {
    if (!(await confirmar(`Excluir ${o.nome}? As vendas continuam, só perdem o vínculo com o órgão.`, { perigo: true, botao: 'Excluir' }))) return;
    try { await api(`/orgaos/${o.id}`, { method: 'DELETE' }); avisar('Excluído.'); recarregar(); } catch (e) { avisar(e.message, 'erro'); }
  };

  return (
    <div className="fade-in">
      <Cabecalho titulo="Órgãos (clientes)" sub="Quanto cada órgão comprou, pagou, deve e em quantos dias costuma pagar.">
        <button className="btn-pri" onClick={() => setForm({})}><Plus size={16} />Novo órgão</button>
      </Cabecalho>
      <div className="relative mb-4"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input className="input pl-9" placeholder="Buscar nome, UASG, cidade, CNPJ…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
      {erro ? <ErroCaixa erro={erro} tentar={recarregar} /> : !dados ? <div className="flex justify-center py-16"><Spinner tamanho={28} /></div> : lista.length === 0 ? (
        <div className="card"><Vazio icone={Building2} titulo="Nenhum órgão" texto="Os órgãos são criados sozinhos quando você importa um empenho." /></div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {lista.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-semibold text-white line-clamp-2">{o.nome}</p>
                  <p className="text-[11px] text-slate-500">{o.uasg ? `UASG ${o.uasg}` : 'sem UASG'}{o.municipio ? ` · ${o.municipio}${o.uf ? '/' + o.uf : ''}` : ''}</p></div>
                <div className="flex shrink-0">
                  <button onClick={() => setForm(o)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5" aria-label="Editar"><Pencil size={14} /></button>
                  <button onClick={() => excluir(o)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10" aria-label="Excluir"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div><p className="text-slate-500">Vendido ({o.vendas})</p><p className="num text-marca-300 font-semibold">{dinheiro(o.total_vendido)}</p></div>
                <div><p className="text-slate-500">Lucro</p><p className={`num font-semibold ${corLucro(o.lucro)}`}>{dinheiro(o.lucro)}</p></div>
                <div><p className="text-slate-500">A receber</p><p className="num text-amber-300 font-semibold">{dinheiro(o.a_receber)}</p></div>
                <div><p className="text-slate-500">Paga em média</p><p className="num text-slate-300 font-semibold">{o.prazo_medio_pagamento !== null && o.prazo_medio_pagamento !== undefined ? `${o.prazo_medio_pagamento} dias` : '—'}</p></div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-3 border-t border-borda text-[11px]">
                {o.telefone && <span className="text-slate-400 flex items-center gap-1"><Phone size={11} />{o.telefone}</span>}
                {o.email && <a href={`mailto:${o.email}`} className="text-marca-300 flex items-center gap-1"><Mail size={11} />{o.email}</a>}
                {o.vendas > 0 && <Link to={`/vendas?orgao_id=${o.id}`} className="text-marca-300 hover:underline ml-auto">ver vendas →</Link>}
                {o.ultima_venda && <span className="text-slate-500">última {data(o.ultima_venda)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {form && <FormOrgao inicial={form} fechar={() => setForm(null)} salvo={() => { setForm(null); recarregar(); }} />}
    </div>
  );
}

function FormOrgao({ inicial, fechar, salvo }) {
  const avisar = useToast();
  const [f, setF] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const m = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const salvar = async () => {
    setEnviando(true);
    try { if (f.id) await api(`/orgaos/${f.id}`, { method: 'PUT', body: f }); else await api('/orgaos', { method: 'POST', body: f }); avisar('Órgão salvo.'); salvo(); } catch (e) { avisar(e.message, 'erro'); } finally { setEnviando(false); }
  };
  return (
    <Modal titulo={f.id ? 'Editar órgão' : 'Novo órgão'} aberto fechar={fechar}
      rodape={<><button className="btn-sec" onClick={fechar}>Voltar</button><button className="btn-pri" disabled={enviando} onClick={salvar}>{enviando && <Loader2 size={15} className="animate-spin" />}Salvar</button></>}>
      <div className="grid sm:grid-cols-6 gap-3">
        <Campo rotulo="Nome *" className="sm:col-span-4"><input className="input" value={f.nome || ''} onChange={m('nome')} /></Campo>
        <Campo rotulo="UASG" className="sm:col-span-2"><input className="input num" value={f.uasg || ''} onChange={m('uasg')} /></Campo>
        <Campo rotulo="CNPJ" className="sm:col-span-3"><input className="input num" value={f.cnpj || ''} onChange={m('cnpj')} /></Campo>
        <Campo rotulo="Cidade" className="sm:col-span-2"><input className="input" value={f.municipio || ''} onChange={m('municipio')} /></Campo>
        <Campo rotulo="UF" className="sm:col-span-1"><input className="input uppercase" maxLength={2} value={f.uf || ''} onChange={m('uf')} /></Campo>
        <Campo rotulo="Endereço" className="sm:col-span-6"><input className="input" value={f.endereco || ''} onChange={m('endereco')} /></Campo>
        <Campo rotulo="Contato (setor / pessoa)" className="sm:col-span-2"><input className="input" value={f.contato || ''} onChange={m('contato')} /></Campo>
        <Campo rotulo="Telefone" className="sm:col-span-2"><input className="input" value={f.telefone || ''} onChange={m('telefone')} /></Campo>
        <Campo rotulo="E-mail" className="sm:col-span-2"><input className="input" value={f.email || ''} onChange={m('email')} /></Campo>
        <Campo rotulo="Observações" className="sm:col-span-6"><textarea className="input" rows={2} value={f.obs || ''} onChange={m('obs')} /></Campo>
      </div>
    </Modal>
  );
}
