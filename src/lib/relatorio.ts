// Relatórios para imprimir (ou salvar em PDF pelo navegador) e exportar para Excel.
// Usado pelas telas do sistema: cada uma passa as colunas e as linhas que estão na tela.

import * as XLSX from 'xlsx'

export interface ColunaRelatorio {
  titulo: string
  direita?: boolean   // números e valores
  moeda?: boolean     // valor em reais: impresso como R$ e mantido como número no Excel
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export interface Relatorio {
  titulo: string                     // "Contas a pagar"
  organizacao?: string               // nome do escritório
  filtros?: string[]                 // "Novembro de 2026", "Situação: Vencido"...
  colunas: ColunaRelatorio[]
  linhas: Array<Array<string | number | null | undefined>>
  destaque?: (linha: number) => boolean   // linhas em vermelho (vencidas)
  totais?: Array<{ label: string; valor: string }>
  arquivo?: string                   // nome do arquivo do Excel, sem extensão
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** Abre o relatório em uma nova aba, pronto para imprimir ou salvar em PDF */
export function imprimirRelatorio(r: Relatorio) {
  const w = window.open('', '_blank')
  if (!w) { alert('O navegador bloqueou a nova aba. Permita pop-ups deste site para imprimir.'); return }
  const gerado = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const cab = r.colunas.map(c => `<th${c.direita || c.moeda ? ' class="d"' : ''}>${esc(c.titulo)}</th>`).join('')
  const corpo = r.linhas.length
    ? r.linhas.map((l, i) => `<tr${r.destaque?.(i) ? ' class="alerta"' : ''}>${l.map((v, j) => `<td${r.colunas[j]?.direita || r.colunas[j]?.moeda ? ' class="d"' : ''}>${esc(r.colunas[j]?.moeda && typeof v === 'number' ? brl(v) : (v ?? '—'))}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${r.colunas.length}" class="vazio">Nenhum registro para os filtros escolhidos.</td></tr>`
  const totais = r.totais?.length
    ? `<div class="totais">${r.totais.map(t => `<div><span>${esc(t.label)}</span><strong>${esc(t.valor)}</strong></div>`).join('')}</div>`
    : ''
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(r.titulo)}</title>
<style>
*{box-sizing:border-box}
body{font-family:'IBM Plex Sans',Arial,sans-serif;font-size:11px;color:#0f172a;margin:28px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:14px}
h1{font-size:18px;margin:0}
.org{font-size:12px;color:#334155;margin-top:2px}
.meta{font-size:10px;color:#475569;text-align:right}
.filtros{font-size:11px;color:#334155;margin-bottom:12px}
.totais{display:flex;flex-wrap:wrap;gap:22px;margin:0 0 14px}
.totais span{display:block;font-size:10px;color:#475569}
.totais strong{font-size:13px}
table{width:100%;border-collapse:collapse}
th{background:#f1f5f9;border-bottom:1px solid #cbd5e1;padding:6px 8px;text-align:left;font-size:10px;font-weight:600}
td{border-bottom:1px solid #e2e8f0;padding:6px 8px;vertical-align:top}
.d{text-align:right;white-space:nowrap}
tr.alerta td{color:#b91c1c}
.vazio{text-align:center;color:#64748b;padding:24px}
.rodape{margin-top:14px;font-size:10px;color:#64748b}
.acoes{position:fixed;top:12px;right:12px;display:flex;gap:8px}
.acoes button{font:inherit;font-size:12px;font-weight:600;padding:8px 14px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;cursor:pointer}
.acoes button.p{background:#0f172a;color:#fff;border-color:#0f172a}
@media print{.acoes{display:none}body{margin:0}@page{margin:14mm}tr{page-break-inside:avoid}}
</style></head><body>
<div class="acoes"><button class="p" onclick="window.print()">Imprimir / salvar PDF</button><button onclick="window.close()">Fechar</button></div>
<header><div><h1>${esc(r.titulo)}</h1>${r.organizacao ? `<div class="org">${esc(r.organizacao)}</div>` : ''}</div>
<div class="meta">Gerado em ${esc(gerado)}<br>${r.linhas.length} ${r.linhas.length === 1 ? 'registro' : 'registros'}</div></header>
${r.filtros?.length ? `<div class="filtros">${r.filtros.map(esc).join(' · ')}</div>` : ''}
${totais}
<table><thead><tr>${cab}</tr></thead><tbody>${corpo}</tbody></table>
<div class="rodape">Paralegal PRO</div>
</body></html>`)
  w.document.close()
}

/** Mesmo relatório em planilha do Excel */
export function exportarRelatorioExcel(r: Relatorio) {
  const linhas: any[][] = [
    [r.titulo + (r.organizacao ? ' — ' + r.organizacao : '')],
    ...(r.filtros?.length ? [[r.filtros.join(' · ')]] : []),
    [],
    r.colunas.map(c => c.titulo),
    ...r.linhas.map(l => l.map(v => v ?? '')),
    ...(r.totais?.length ? [[], ...r.totais.map(t => [t.label, t.valor])] : []),
  ]
  const ws = XLSX.utils.aoa_to_sheet(linhas)
  // colunas de valor: formato de moeda, continuam somáveis no Excel
  const inicio = (r.filtros?.length ? 4 : 3)
  r.colunas.forEach((c, j) => {
    if (!c.moeda) return
    for (let i = 0; i < r.linhas.length; i++) {
      const cel = ws[XLSX.utils.encode_cell({ r: inicio + i, c: j })]
      if (cel && typeof cel.v === 'number') cel.z = '"R$" #,##0.00'
    }
  })
  ws['!cols'] = r.colunas.map(() => ({ wch: 22 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
  const nome = (r.arquivo || r.titulo).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_')
  XLSX.writeFile(wb, nome + '.xlsx')
}
