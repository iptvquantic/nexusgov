// Extrai texto de PDF preservando o layout (linhas e colunas separadas por "  ")
const pdf = require('pdf-parse/lib/pdf-parse.js');
// O pdf-parse carrega o pdf.js com require dinâmico; este require estático garante que o arquivo vá junto no deploy (Vercel).
const carregarPdfjs = () => require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');

function renderPage(pageData) {
  return pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false }).then((tc) => {
    const itens = tc.items
      .filter((it) => it.str && it.str.trim() !== '')
      .map((it) => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, s: it.str }));
    // agrupa por linha (y com tolerância)
    itens.sort((a, b) => b.y - a.y || a.x - b.x);
    const linhas = [];
    for (const it of itens) {
      const l = linhas.find((ln) => Math.abs(ln.y - it.y) < 2.5);
      if (l) l.itens.push(it); else linhas.push({ y: it.y, itens: [it] });
    }
    linhas.sort((a, b) => b.y - a.y);
    return linhas.map((ln) => {
      ln.itens.sort((a, b) => a.x - b.x);
      let out = '', fim = null;
      for (const it of ln.itens) {
        if (fim !== null) {
          const gap = it.x - fim;
          out += gap > 6 ? '   ' : gap > 0.8 ? ' ' : '';
        }
        out += it.s;
        fim = it.x + it.w;
      }
      return out.replace(/\s+$/, '');
    }).join('\n');
  });
}

async function textoDoPdf(buffer) {
  carregarPdfjs();
  const d = await pdf(buffer, { pagerender: renderPage });
  return d.text;
}

module.exports = { textoDoPdf };
