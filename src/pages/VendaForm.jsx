import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileUp, Loader2, Save, AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { Campo, CampoValor, Carregando, Modal, useToast } from '../components/ui';
import ItensEditor, { ResumoItens, itemVazio } from '../components/ItensEditor';
import { MODALIDADES, PORTAIS, STATUS_VENDA, hojeIso } from '../lib/fmt';

const VAZIA = {
  objeto: '', descricao: '', numero_empenho: '', processo: '', numero_compra: '', portal: 'Compras.gov.br', modalidade: 'Dispensa eletrônica',
  data_empenho: hojeIso(), prazo_entrega_dias: 30, data_limite_entrega: '', local_entrega: '', status: 'empenhada',
  frete: null, outros_custos: null, obs: '', nf_numero: '', nf_data: '', data_prev_pagamento: '',
  orgao: { uasg: '', nome: '', cnpj: '', municipio: '', uf: '', telefone: '', endereco: '' },
};

export function useFornecedores() {
  const [lista, setLista] = useState([]);
  const carregar = () => api('/fornecedores').then((r) => setLista(r.fornecedores)).catch(() => {});
  useEffect(() => { carregar(); }, []);
  return [lista, carregar];
}

export function NovoFornecedorRapido({ aberto, fechar, criado }) {
  const avisar = useToast();
  const [f, setF] = useState({ nome: '', produtos: '', telefone: '', email: '' });
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setSalvando(true);
    try { const r = await api('/fornecedores', { method: 'POST', body: f }); avisar('Fornecedor cadastrado.'); criado(r.fornecedor); setF({ nome: '', produtos: '', telefone: '', email: '' }); fechar(); } catch (e) { avisar(e.message, 'erro'); } finally { setSalvando(false); }
  };
  return (
    <Modal titulo="Novo fornecedor" aberto={aberto} fechar={fechar} largura="max-w-md"
      rodape={<><button className="btn-sec" onClick={fechar}>Cancelar</button><button className="btn-pri" disabled={!f.nome || salvando} onClick={salvar}>Salvar</button></>}>
      <div className="space-y-3">
        <Campo rotulo="Nome"><input className="input" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus /></Campo>
        <Campo rotulo="O que vende"><input className="input" value={f.produtos} onChange={(e) => setF({ ...f, produtos: e.target.value })} placeholder="Cabos, mangueiras..." /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Telefone / WhatsApp"><input className="input" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></Campo>
          <Campo rotulo="E-mail"><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Campo>
        </div>
      </div>
    </Modal>
  );
}

export default function VendaForm() {
  const { id } = useParams();
  const editando = !!id;
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const avisar = useToast();
  const [v, setV] = useState(VAZIA);
  const [itens, setItens] = useState([itemVazio()]);
  const [carregando, setCarregando] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [lido, setLido] = useState(null);
  const [duplicada, setDuplicada] = useState(null);
  const [fornecedores, recarregarForn] = useFornecedores();
  const [novoForn, setNovoForn] = useState(false);
  const arquivo = useRef(null);

  useEffect(() => {
    if (!editando) { if (sp.get('importar') === '1') setTimeout(() => arquivo.current?.click(), 300); return; }
    api(`/vendas/${id}`).then((r) => {
      const x = r.venda;
      setV({
        ...VAZIA, ...Object.fromEntries(Object.entries(x).map(([k, val]) => [k, val ?? (typeof VAZIA[k] === 'string' ? '' : val)])),
        frete: x.frete || null, outros_custos: x.outros_custos || null,
        orgao: r.orgao ? { ...VAZIA.orgao, ...Object.fromEntries(Object.entries(r.orgao).map(([k, val]) => [k, val ?? ''])) } : VAZIA.orgao,
      });
      setItens(r.itens.map((i) => ({ ...i, _k: i.id, fornecedor_id: i.fornecedor_id || '' })));
    }).catch((e) => { avisar(e.message, 'erro'); nav('/vendas'); }).finally(() => setCarregando(false));
  }, [id]); // eslint-disable-line

  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const setO = (k) => (e) => setV((x) => ({ ...x, orgao: { ...x.orgao, [k]: e.target.value } }));

  const lerPdf = async (file) => {
    if (!file) return;
    setLendo(true);
    setDuplicada(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const r = await api('/importar/empenho', { method: 'POST', form: fd });
      const e = r.empenho;
      setV((x) => ({
        ...x,
        objeto: e.objeto || x.objeto, descricao: e.descricao || '', numero_empenho: e.numero_empenho_curto || e.numero_empenho || '',
        processo: e.processo || '', numero_compra: e.numero_compra || '', portal: e.portal || x.portal, modalidade: e.modalidade || x.modalidade,
        data_empenho: e.data_empenho || x.data_empenho, local_entrega: e.local_entrega || '',
        orgao: { ...x.orgao, ...Object.fromEntries(Object.entries(e.orgao || {}).map(([k, val]) => [k, val || ''])) },
      }));
      setItens(e.itens.map((it) => ({ ...itemVazio(), numero_item: it.numero_item, descricao: it.descricao, quantidade: it.quantidade, valor_unit: it.valor_unit })));
      setLido(e);
      setDuplicada(r.duplicada);
      avisar(`Empenho ${e.numero_empenho_curto} lido: ${e.itens.length} item(ns). Agora informe o custo de cada item.`);
    } catch (err) {
      avisar(err.message, 'erro');
    } finally {
      setLendo(false);
      if (arquivo.current) arquivo.current.value = '';
    }
  };

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const corpo = { ...v, itens: itens.map((i) => ({ ...i, fornecedor_id: i.fornecedor_id || null })) };
      const r = editando ? await api(`/vendas/${id}`, { method: 'PUT', body: corpo }) : await api('/vendas', { method: 'POST', body: corpo });
      avisar(editando ? 'Venda atualizada.' : 'Venda cadastrada!');
      nav(`/vendas/${r.venda.id}`, { replace: true });
    } catch (err) { avisar(err.message, 'erro'); } finally { setSalvando(false); }
  };

  if (carregando) return <Carregando />;

  return (
    <form onSubmit={salvar} className="space-y-5 fade-in max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to={editando ? `/vendas/${id}` : '/vendas'} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><ArrowLeft size={18} /></Link>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white">{editando ? 'Editar venda' : 'Nova venda / empenho'}</h1>
          <p className="text-sm text-slate-400">Preencha o custo de cada item para ver o lucro.</p>
        </div>
      </div>

      {!editando && (
        <div className="card p-4 sm:p-5 border-dashed border-marca-500/40 bg-marca-500/[0.04] flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-marca-600/20 text-marca-300 flex items-center justify-center shrink-0">{lendo ? <Loader2 className="animate-spin" /> : <FileUp />}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white">Tem o PDF da Nota de Empenho?</p>
            <p className="text-sm text-slate-400">Anexe e o NexusGov preenche órgão, UASG, número, itens, quantidades e valores.</p>
            {lido && <p className="text-xs text-emerald-300 mt-1 flex items-center gap-1"><CheckCircle2 size={13} />Lido: {lido.numero_empenho_curto} · {lido.orgao?.nome}</p>}
          </div>
          <input ref={arquivo} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => lerPdf(e.target.files[0])} />
          <button type="button" className="btn-pri" disabled={lendo} onClick={() => arquivo.current?.click()}>{lendo ? 'Lendo…' : lido ? 'Trocar PDF' : 'Anexar PDF'}</button>
        </div>
      )}
      {duplicada && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-center gap-2">
          <AlertTriangle size={16} />Este empenho já está cadastrado: <Link className="underline" to={`/vendas/${duplicada.id}`}>{duplicada.objeto}</Link>
        </div>
      )}

      <section className="card p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold text-white">Órgão comprador</h2>
        <div className="grid sm:grid-cols-6 gap-3">
          <Campo rotulo="UASG" className="sm:col-span-1"><input className="input num" value={v.orgao.uasg} onChange={setO('uasg')} placeholder="781200" /></Campo>
          <Campo rotulo="Nome do órgão" className="sm:col-span-3"><input className="input" value={v.orgao.nome} onChange={setO('nome')} placeholder="1º Batalhão..." /></Campo>
          <Campo rotulo="CNPJ" className="sm:col-span-2"><input className="input num" value={v.orgao.cnpj} onChange={setO('cnpj')} /></Campo>
          <Campo rotulo="Cidade" className="sm:col-span-2"><input className="input" value={v.orgao.municipio} onChange={setO('municipio')} /></Campo>
          <Campo rotulo="UF" className="sm:col-span-1"><input className="input" maxLength={2} value={v.orgao.uf} onChange={setO('uf')} /></Campo>
          <Campo rotulo="Telefone" className="sm:col-span-3"><input className="input" value={v.orgao.telefone} onChange={setO('telefone')} /></Campo>
        </div>
      </section>

      <section className="card p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold text-white">Dados da venda</h2>
        <div className="grid sm:grid-cols-6 gap-3">
          <Campo rotulo="Objeto (resumo)" className="sm:col-span-4"><input className="input" required value={v.objeto} onChange={set('objeto')} placeholder="Ex.: Fios elétricos" /></Campo>
          <Campo rotulo="Etapa" className="sm:col-span-2">
            <select className="input" value={v.status} onChange={set('status')}>{Object.entries(STATUS_VENDA).map(([k, s]) => <option key={k} value={k}>{s.rotulo}</option>)}</select>
          </Campo>
          <Campo rotulo="Nº do empenho" className="sm:col-span-2"><input className="input num" value={v.numero_empenho} onChange={set('numero_empenho')} placeholder="2026NE152" /></Campo>
          <Campo rotulo="Data do empenho" className="sm:col-span-2"><input type="date" className="input" value={v.data_empenho || ''} onChange={set('data_empenho')} /></Campo>
          <Campo rotulo="Nº dispensa / pregão" className="sm:col-span-2"><input className="input num" value={v.numero_compra} onChange={set('numero_compra')} placeholder="90034/2026" /></Campo>
          <Campo rotulo="Portal" className="sm:col-span-2"><select className="input" value={v.portal} onChange={set('portal')}>{PORTAIS.map((p) => <option key={p}>{p}</option>)}</select></Campo>
          <Campo rotulo="Modalidade" className="sm:col-span-2"><select className="input" value={v.modalidade} onChange={set('modalidade')}>{MODALIDADES.map((p) => <option key={p}>{p}</option>)}</select></Campo>
          <Campo rotulo="Processo" className="sm:col-span-2"><input className="input num" value={v.processo} onChange={set('processo')} /></Campo>
          <Campo rotulo="Prazo de entrega (dias)" dica="Conta a partir da data do empenho" className="sm:col-span-2"><CampoValor value={v.prazo_entrega_dias} onChange={(n) => setV((x) => ({ ...x, prazo_entrega_dias: n, data_limite_entrega: '' }))} placeholder="30" /></Campo>
          <Campo rotulo="Ou data limite" className="sm:col-span-2"><input type="date" className="input" value={v.data_limite_entrega || ''} onChange={set('data_limite_entrega')} /></Campo>
          <Campo rotulo="Local de entrega" className="sm:col-span-2"><input className="input" value={v.local_entrega} onChange={set('local_entrega')} /></Campo>
        </div>
      </section>

      <section className="card p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-white">Itens, custos e fornecedores</h2>
          <button type="button" className="btn-sec btn-sm" onClick={() => setNovoForn(true)}><UserPlus size={14} />Fornecedor</button>
        </div>
        <ItensEditor itens={itens} setItens={setItens} fornecedores={fornecedores} />
        <div className="grid sm:grid-cols-3 gap-3">
          <Campo rotulo="Frete que eu pago (R$)" dica="Deixe vazio se o frete está incluso no preço do fornecedor (CIF)"><CampoValor value={v.frete} onChange={set('frete')} /></Campo>
          <Campo rotulo="Outros custos (R$)" dica="Embalagem, taxa, motoboy..."><CampoValor value={v.outros_custos} onChange={set('outros_custos')} /></Campo>
        </div>
        <ResumoItens itens={itens} frete={v.frete} outros={v.outros_custos} />
      </section>

      {editando && (
        <section className="card p-4 sm:p-5 space-y-4">
          <h2 className="font-semibold text-white">Nota fiscal e pagamento</h2>
          <div className="grid sm:grid-cols-4 gap-3">
            <Campo rotulo="Nº da NF"><input className="input num" value={v.nf_numero} onChange={set('nf_numero')} /></Campo>
            <Campo rotulo="Data da NF"><input type="date" className="input" value={v.nf_data || ''} onChange={(e) => setV((x) => ({ ...x, nf_data: e.target.value, data_prev_pagamento: '' }))} /></Campo>
            <Campo rotulo="Previsão de pagamento" dica="Calculada pela data da NF se vazia"><input type="date" className="input" value={v.data_prev_pagamento || ''} onChange={set('data_prev_pagamento')} /></Campo>
            <Campo rotulo="Data da entrega"><input type="date" className="input" value={v.data_entrega || ''} onChange={set('data_entrega')} /></Campo>
          </div>
        </section>
      )}

      <section className="card p-4 sm:p-5">
        <Campo rotulo="Observações"><textarea className="input" rows={3} value={v.obs} onChange={set('obs')} placeholder="Contato do almoxarifado, combinados com o fornecedor..." /></Campo>
        {v.descricao && <p className="text-xs text-slate-500 mt-3"><b>Descrição do empenho:</b> {v.descricao}</p>}
      </section>

      <div className="sticky bottom-0 -mx-3 sm:mx-0 px-3 sm:px-0 py-3 bg-fundo/90 backdrop-blur flex justify-end gap-2 border-t border-borda sm:border-0">
        <Link to={editando ? `/vendas/${id}` : '/vendas'} className="btn-sec">Cancelar</Link>
        <button className="btn-pri" disabled={salvando}>{salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Salvar venda</button>
      </div>

      <NovoFornecedorRapido aberto={novoForn} fechar={() => setNovoForn(false)} criado={() => recarregarForn()} />
    </form>
  );
}
