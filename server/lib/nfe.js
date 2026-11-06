// Leitor de XML de NF-e (modelo 55)
const tag = (xml, nome) => {
  const m = new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`).exec(xml);
  return m ? m[1].trim() : null;
};
const todas = (xml, nome) => {
  const re = new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, 'g');
  const out = []; let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
};
const n = (s) => (s == null ? null : parseFloat(s));
const desesc = (s) => (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

function lerNfeXml(xmlTexto) {
  const xml = String(xmlTexto);
  if (!/<infNFe/.test(xml)) throw new Error('Arquivo não é um XML de NF-e.');
  const idm = /<infNFe[^>]*Id="NFe(\d{44})"/.exec(xml);
  const ide = tag(xml, 'ide') || '';
  const dest = tag(xml, 'dest') || '';
  const emit = tag(xml, 'emit') || '';
  const tot = tag(xml, 'ICMSTot') || '';
  const itens = todas(xml, 'det').map((d, i) => {
    const p = tag(d, 'prod') || '';
    return {
      seq: i + 1,
      descricao: desesc(tag(p, 'xProd')),
      unidade: tag(p, 'uCom'),
      quantidade: n(tag(p, 'qCom')),
      valor_unit: n(tag(p, 'vUnCom')),
      valor_total: n(tag(p, 'vProd')),
    };
  });
  const infCpl = desesc(tag(xml, 'infCpl') || '');
  const empenhos = [...new Set((infCpl.match(/(?:\d{4}\s*)?NE\s*(?:N[ºo°]?\s*)?0*\d+/gi) || [])
    .map((e) => (/(\d+)\s*$/.exec(e) || [])[1]).filter(Boolean).map((x) => String(parseInt(x, 10))))];
  const dh = tag(ide, 'dhEmi') || tag(ide, 'dEmi');
  return {
    chave: idm ? idm[1] : null,
    numero: tag(ide, 'nNF'),
    serie: tag(ide, 'serie'),
    data_emissao: dh ? dh.slice(0, 10) : null,
    natureza: desesc(tag(ide, 'natOp')),
    emitente: { cnpj: tag(emit, 'CNPJ') || tag(emit, 'CPF'), nome: desesc(tag(emit, 'xNome')) },
    destinatario: { cnpj: tag(dest, 'CNPJ') || tag(dest, 'CPF'), nome: desesc(tag(dest, 'xNome')) },
    valor_total: n(tag(tot, 'vNF')) ?? itens.reduce((s, i) => s + (i.valor_total || 0), 0),
    informacoes: infCpl,
    empenhos_citados: empenhos,
    itens,
  };
}

module.exports = { lerNfeXml };
