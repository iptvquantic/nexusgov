import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, ExternalLink, Loader2, Pencil, Plus, Search, Target, Trash2, Trophy, XCircle, Send, Copy } from 'lucide-react';
import { api } from '../lib/api';
import { Abas, Cabecalho, Campo, CampoValor, ChipOport, ErroCaixa, Kpi, Modal, Spinner, Vazio, useConfirm, useDados, useToast } from '../components/ui';
import ItensEditor, { ResumoItens, itemVazio } from '../components/ItensEditor';
import { useFornecedores } from './VendaForm';
import { MODALIDADES, PORTAIS, STATUS_OPORT, corLucro, dataHora, dinheiro, hojeIso, pct } from '../lib/fmt';

const vazio = () => ({ objeto: '', uasg: '', orgao_nome: '', numero: '', portal: 'Compras.gov.br', modalidade: 'Dispensa eletrônica', data_sessao: '', frete: 0, margem_alvo: 30, link: '', obs: '', status: 'cotando', itens: [itemVazio()] });

const paraInputData = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - 3 * 3600000); // horário de Brasília
  return local.toISOString().slice(0, 16);
};

export default function Oportunidades() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const avisar = useToast();
  const confirmar = useConfirm();
  const [status, setStatus] = useState('abertas');
  const [busca, setBusca] = useState('');
  const [buscaQ, setBuscaQ] = useState('');
  const [form, setForm] = useState(null);
  const [converter, setConverter] = useState(null);
  const { dados, erro, recarregar } = useDados(() => api(`/oportunidades?status=${status}&busca=${encodeURIComponent(buscaQ)}`), [status, buscaQ]);

  useEffect(() => { const t = setTimeout(() => setBuscaQ(busca), 350); return () => clearTimeout(t); }, [busca]);
  useEffect(() => { if (sp.get('nova')) { setForm(vazio()); sp.delete('nova'); setSp(sp, { replace: true }); } }, []); // eslint-disable-line

  const abrir = async (o, copiar = false) => {
    try {
      const r = await api(`/oportunidades/${o.id}`);
      const base = { ...r.oportunidade, data_sessao: paraInputData(r.oportunidade.data_sessao), itens: r.itens.map((i) => ({ ...i, _k: Math.random() })) };
      if (copiar) { delete base.id; base.status = 'cotando'; base.venda_id = null; base.numero = ''; base.data_sessao = ''; base.objeto = `${base.objeto} (cópia)`; base.itens = base.itens.map(({ id, ...x }) => x); }
      setForm(base);
    } catch (e) { avisar(e.message, 'erro'); }
  };
  const mudarStatus = async (o, st) => {
    let motivo;
    if (st === 'perdida') { motivo = window.prompt('Motivo (opcional): preço, documentação, desclassificada…') ?? undefined; }
    try { await api(`/oportunidades/${o.id}/status`, { method: 'PATCH', body: { status: st, motivo_perda: motivo } }); avisar(`Marcada como ${STATUS_OPORT[st].rotulo.toLowerCase()}.`); recarregar(); } catch (e) { avisar(e.message, 'erro'); }
  };
  const excluir = async (o) => {
    if (!(await confirmar(`Excluir a cotação "${o.objeto}"?`, { perigo: true, botao: 'Excluir' }))) return;
    try { await api(`/oportunidades/${o.id}`, { method: 'DELETE' }); avisar('Excluída.'); recarregar(); } catch (e) { avisar(e.message, 'erro'); }
  };

  const r = dados?.resumo;
  const abas = [{ id: 'abertas', rotulo: 'Em aberto' }, { id: '', rotulo: 'Todas' }, ...Object.entries(STATUS_OPORT).map(([id, s]) => ({ id, rotulo: s.rotulo }))];

  return (
    <div className="fade-in">
      <Cabecalho titulo="Oportunidades e cotações" sub="Monte o preço com custo e margem antes de disputar. Ganhou? Vira venda com um clique.">
        <button className="btn-pri" onClick={() => setForm(vazio())}><Plus size={16} />Nova cotação</button>
      </Cabecalho>

      {r && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Kpi titulo="Em aberto" valor={r.abertas} icone={Target} />
          <Kpi titulo="Sessões em 3 dias" valor={r.proximas} icone={CalendarClock} tom="ambar" />
          <Kpi titulo="Ganhas" valor={r.ganhas} icone={Trophy} tom="verde" />
          <Kpi titulo="Taxa de vitória" valor={r.taxa_vitoria === null ? '—' : `${r.taxa_vitoria}%`} sub={`${r.ganhas} ganhas · ${r.perdidas} perdidas`} tom="roxo" />
        </div>
      )}

      <div className="card p-3 sm:p-4 mb-4 space-y-3">
        <Abas abas={abas} valor={status} mudar={setStatus} />
        <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input className="input pl-9" placeholder="Buscar objeto, número, UASG, órgão…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
      </div>

      {erro ? <ErroCaixa erro={erro} tentar={recarregar} /> : !dados ? <div className="flex justify-center py-16"><Spinner tamanho={28} /></div> : dados.oportunidades.length === 0 ? (
        <div className="card"><Vazio icone={Target} titulo="Nenhuma cotação aqui" texto="Cadastre as dispensas e pregões que você vai disputar para calcular o preço certo e acompanhar o resultado."
          acao={<button className="btn-pri" onClick={() => setForm(vazio())}><Plus size={16} />Nova cotação</button>} /></div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {dados.oportunidades.map((o) => {
            const sessao = o.data_sessao ? new Date(o.data_sessao) : null;
            const horas = sessao ? (sessao - new Date()) / 3600000 : null;
            const aberta = ['cotando', 'enviada'].includes(o.status);
            return (
              <div key={o.id} className="card p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <ChipOport status={o.status} />
                  <div className="flex gap-0.5">
                    <button onClick={() => abrir(o, true)} title="Duplicar" className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><Copy size={14} /></button>
                    <button onClick={() => abrir(o)} title="Editar" className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><Pencil size={14} /></button>
                    <button onClick={() => excluir(o)} title="Excluir" className="p-1.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </div>
                </div>
                <button className="text-left mt-2" onClick={() => abrir(o)}>
                  <p className="font-semibold text-white line-clamp-2">{o.objeto}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{o.orgao_nome || 'Órgão não informado'}{o.uasg ? ` · UASG ${o.uasg}` : ''}</p>
                  <p className="text-[11px] text-slate-500 truncate">{o.portal} · {o.modalidade}{o.numero ? ` · nº ${o.numero}` : ''}</p>
                </button>
                {sessao && <p className={`text-xs mt-2 flex items-center gap-1 ${aberta && horas < 0 ? 'text-slate-500' : aberta && horas < 24 ? 'text-red-300 font-semibold' : aberta && horas < 72 ? 'text-amber-300' : 'text-slate-400'}`}><CalendarClock size={12} />Sessão {dataHora(o.data_sessao)}</p>}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-borda text-xs">
                  <div><p className="text-slate-500">Proposta</p><p className="num text-marca-300 font-semibold truncate">{dinheiro(o.valor_proposta)}</p></div>
                  <div><p className="text-slate-500">Lucro est.</p><p className={`num font-semibold truncate ${o.custo_itens > 0 ? corLucro(o.lucro_estimado) : 'text-slate-500'}`}>{o.custo_itens > 0 ? dinheiro(o.lucro_estimado) : '—'}</p></div>
                  <div><p className="text-slate-500">Margem</p><p className={`num font-semibold ${o.custo_itens > 0 ? corLucro(o.lucro_estimado) : 'text-slate-500'}`}>{o.custo_itens > 0 ? pct(o.margem_estimada) : '—'}</p></div>
                </div>
                {o.status === 'perdida' && o.motivo_perda && <p className="text-[11px] text-red-300/80 mt-2">Motivo: {o.motivo_perda}</p>}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {o.status === 'cotando' && <button className="btn-sec btn-sm" onClick={() => mudarStatus(o, 'enviada')}><Send size={13} />Enviei a proposta</button>}
                  {aberta && <button className="btn-ok btn-sm" onClick={() => setConverter(o)}><Trophy size={13} />Ganhei</button>}
                  {aberta && <button className="btn-sec btn-sm" onClick={() => mudarStatus(o, 'perdida')}><XCircle size={13} />Perdi</button>}
                  {o.venda_id && <button className="btn-sec btn-sm" onClick={() => nav(`/vendas/${o.venda_id}`)}>Ver venda</button>}
                  {o.link && <a href={o.link} target="_blank" rel="noreferrer" className="btn-sec btn-sm"><ExternalLink size={13} />Edital</a>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && <FormOport inicial={form} fechar={() => setForm(null)} salvo={() => { setForm(null); recarregar(); }} />}
      {converter && <ModalConverter oport={converter} fechar={() => setConverter(null)} />}
    </div>
  );
}

function FormOport({ inicial, fechar, salvo }) {
  const avisar = useToast();
  const { fornecedores } = useFornecedores();
  const [f, setF] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const m = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });

  const salvar = async () => {
    if (!f.objeto?.trim()) return avisar('Informe o objeto.', 'erro');
    setEnviando(true);
    try {
      const body = { ...f, itens: f.itens.filter((i) => i.descricao?.trim()) };
      if (f.id) await api(`/oportunidades/${f.id}`, { method: 'PUT', body }); else await api('/oportunidades', { method: 'POST', body });
      avisar('Cotação salva.');
      salvo();
    } catch (e) { avisar(e.message, 'erro'); } finally { setEnviando(false); }
  };

  return (
    <Modal titulo={f.id ? 'Editar cotação' : 'Nova cotação'} aberto fechar={fechar} largura="max-w-4xl"
      rodape={<><button className="btn-sec" onClick={fechar}>Voltar</button><button className="btn-pri" disabled={enviando} onClick={salvar}>{enviando && <Loader2 size={15} className="animate-spin" />}Salvar</button></>}>
      <div className="space-y-5">
        <div className="grid sm:grid-cols-6 gap-3">
          <Campo rotulo="Objeto (o que o órgão quer comprar) *" className="sm:col-span-6"><input className="input" value={f.objeto} onChange={m('objeto')} placeholder="ex.: Material elétrico — fios e cabos" /></Campo>
          <Campo rotulo="Órgão" className="sm:col-span-4"><input className="input" value={f.orgao_nome || ''} onChange={m('orgao_nome')} placeholder="ex.: 9º BATALHÃO DE ENGENHARIA" /></Campo>
          <Campo rotulo="UASG" className="sm:col-span-2"><input className="input num" value={f.uasg || ''} onChange={m('uasg')} placeholder="160000" /></Campo>
          <Campo rotulo="Portal" className="sm:col-span-2"><select className="input" value={f.portal} onChange={m('portal')}>{PORTAIS.map((p) => <option key={p}>{p}</option>)}</select></Campo>
          <Campo rotulo="Modalidade" className="sm:col-span-2"><select className="input" value={f.modalidade} onChange={m('modalidade')}>{MODALIDADES.map((p) => <option key={p}>{p}</option>)}</select></Campo>
          <Campo rotulo="Nº da dispensa / pregão" className="sm:col-span-2"><input className="input num" value={f.numero || ''} onChange={m('numero')} placeholder="90012/2026" /></Campo>
          <Campo rotulo="Data e hora da sessão" className="sm:col-span-2"><input type="datetime-local" className="input" value={f.data_sessao || ''} onChange={m('data_sessao')} /></Campo>
          <Campo rotulo="Link do edital" className="sm:col-span-4"><input className="input" value={f.link || ''} onChange={m('link')} placeholder="https://…" /></Campo>
        </div>

        <div>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <h3 className="font-semibold text-white">Itens, custos e preço</h3>
            <div className="flex gap-2">
              <Campo rotulo="Margem desejada %"><CampoValor value={f.margem_alvo} onChange={m('margem_alvo')} className="w-24" /></Campo>
              <Campo rotulo="Frete (vazio = CIF)"><CampoValor value={f.frete} onChange={m('frete')} className="w-28" /></Campo>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-3">Informe o custo do fornecedor e toque na varinha para calcular o preço com a margem desejada. Nenhum imposto é somado automaticamente.</p>
          <ItensEditor itens={f.itens} setItens={(itens) => setF({ ...f, itens })} fornecedores={fornecedores} modo="cotacao" margemAlvo={f.margem_alvo} />
        </div>
        <ResumoItens itens={f.itens} frete={f.frete} modo="cotacao" />
        <Campo rotulo="Observações"><textarea className="input" rows={2} value={f.obs || ''} onChange={m('obs')} /></Campo>
      </div>
    </Modal>
  );
}

function ModalConverter({ oport, fechar }) {
  const avisar = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ numero_empenho: '', data_empenho: hojeIso(), prazo_entrega_dias: 30 });
  const [enviando, setEnviando] = useState(false);
  const ir = async () => {
    setEnviando(true);
    try {
      const r = await api(`/oportunidades/${oport.id}/converter`, { method: 'POST', body: f });
      avisar(r.ja_existia ? 'Esta cotação já virou venda.' : 'Parabéns! Venda criada com os itens e custos da cotação.');
      nav(`/vendas/${r.venda_id}`);
    } catch (e) { avisar(e.message, 'erro'); setEnviando(false); }
  };
  return (
    <Modal titulo="Ganhei! Transformar em venda" aberto fechar={fechar} largura="max-w-md"
      rodape={<><button className="btn-sec" onClick={fechar}>Voltar</button><button className="btn-ok" disabled={enviando} onClick={ir}>{enviando && <Loader2 size={15} className="animate-spin" />}Criar venda</button></>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-400">{oport.objeto}</p>
        <Campo rotulo="Nº do empenho (se já tiver)"><input className="input num" value={f.numero_empenho} onChange={(e) => setF({ ...f, numero_empenho: e.target.value })} placeholder="2026NE000123" /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data do empenho"><input type="date" className="input" value={f.data_empenho} onChange={(e) => setF({ ...f, data_empenho: e.target.value })} /></Campo>
          <Campo rotulo="Prazo de entrega (dias)"><input type="number" className="input" value={f.prazo_entrega_dias} onChange={(e) => setF({ ...f, prazo_entrega_dias: e.target.value })} /></Campo>
        </div>
        <p className="text-[11px] text-slate-500">Quando o PDF do empenho chegar, você pode editar a venda e completar os dados.</p>
      </div>
    </Modal>
  );
}
