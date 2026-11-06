const router = require('express').Router();
const multer = require('multer');
const { q } = require('../db');
const { wrap, Erro } = require('../util');
const { lerEmpenhoPdf } = require('../lib/empenho');
const { lerNfeXml } = require('../lib/nfe');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 } });

// Lê a Nota de Empenho em PDF e devolve os dados para conferência (nada é gravado aqui)
router.post('/empenho', upload.single('arquivo'), wrap(async (req, res) => {
  if (!req.file) throw new Erro(400, 'Envie o PDF da Nota de Empenho.');
  if (!/pdf/i.test(req.file.mimetype) && !/\.pdf$/i.test(req.file.originalname)) throw new Erro(400, 'O arquivo precisa ser PDF.');
  let dados;
  try {
    dados = await lerEmpenhoPdf(req.file.buffer);
  } catch (e) {
    throw new Erro(422, e.message && e.message.includes('Nota de Empenho') ? e.message : 'Não consegui ler este PDF. Se for imagem escaneada, cadastre a venda manualmente.');
  }
  // já existe venda com este empenho?
  let duplicada = null;
  if (dados.numero_empenho) {
    const num = String(parseInt(dados.numero_empenho.slice(6), 10));
    const r = await q(`SELECT id, objeto, numero_empenho FROM vendas WHERE usuario_id = $1
      AND regexp_replace(COALESCE(numero_empenho,''), '\\D', '', 'g') ~ ('^' || $2 || '0*' || $3 || '$')`, [req.user.id, dados.ano, num]);
    duplicada = r[0] || null;
  }
  res.json({ empenho: dados, duplicada });
}));

// Lê o XML da NF-e e sugere a venda correspondente
router.post('/nfe', upload.single('arquivo'), wrap(async (req, res) => {
  if (!req.file) throw new Erro(400, 'Envie o XML da nota fiscal.');
  let nf;
  try { nf = lerNfeXml(req.file.buffer.toString('utf8')); } catch (e) { throw new Erro(422, e.message); }
  const candidatas = await q(`SELECT v.id, v.objeto, v.numero_empenho, v.valor_total, v.status, v.orgao_nome, o.cnpj
    FROM vendas_resumo v LEFT JOIN orgaos o ON o.id = v.orgao_id WHERE v.usuario_id = $1 AND v.status <> 'cancelada'`, [req.user.id]);
  const so = (s) => String(s || '').replace(/\D/g, '');
  const pontuar = (v) => {
    let p = 0;
    if (nf.destinatario.cnpj && so(v.cnpj) === so(nf.destinatario.cnpj)) p += 3;
    if (Math.abs((v.valor_total || 0) - (nf.valor_total || 0)) < 0.05) p += 3;
    const numEmp = v.numero_empenho ? String(parseInt(so(v.numero_empenho).slice(4) || '0', 10)) : null;
    if (numEmp && nf.empenhos_citados.includes(numEmp)) p += 4;
    if (['entregue', 'em_transito', 'comprada', 'empenhada'].includes(v.status)) p += 1;
    return p;
  };
  const sugestoes = candidatas.map((v) => ({ ...v, pontos: pontuar(v) })).filter((v) => v.pontos >= 3).sort((a, b) => b.pontos - a.pontos).slice(0, 5);
  res.json({ nf, sugestoes });
}));

module.exports = router;
