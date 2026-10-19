'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CertificadoDigital, Empresa } from '@/types'
import { formatDate, formatCNPJ } from '@/lib/utils'
import { AC_URLS } from '@/types'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import CertificadoForm from '@/components/modules/CertificadoForm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { registrarAcao } from '@/lib/atividade'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Download, FileText } from 'lucide-react'
import { useOrg } from '@/lib/org-context'
import { diaLocal } from '@/lib/atividade'

type EditingDate = { id: string; field: 'aviso' | 'agenda' } | null
type Aba = 'processo' | 'certificados' | 'quinzena'

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

// Quinzena: 1ª = dias 1 a 15 · 2ª = dia 16 ao fim do mês
function periodoQuinzena(mes: string, num: 1 | 2) {
  const [y, m] = mes.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  const ini = `${mes}-${num === 1 ? '01' : '16'}`
  const fim = `${mes}-${num === 1 ? '15' : String(ultimo)}`
  const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
  return { ini, fim, titulo: `${num}ª quinzena de ${MESES[m - 1]} de ${y}`, faixa: `${br(ini)} a ${br(fim)}` }
}

function fmtDate(iso?: string | null) {
  if (!iso) return null
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function fmtDateTime(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
// Converte ISO UTC → string local para input datetime-local
function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// Converte string local do input → ISO UTC para salvar no banco
function localDatetimeToISO(localStr: string): string | null {
  if (!localStr) return null
  return new Date(localStr).toISOString()
}

function CertificadosPageInner() {
  const searchParams = useSearchParams()
  const { orgName, orgId } = useOrg()
  const [certs, setCerts] = useState<CertificadoDigital[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<CertificadoDigital | null>(null)
  const [deleteItem, setDeleteItem] = useState<CertificadoDigital | null>(null)
  const [filtroEmpresa, setFiltroEmpresa] = useState(searchParams.get('empresa') || '')
  const [supabase] = useState(createClient)
  const [editingDate, setEditingDate] = useState<EditingDate>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('processo')
  const [busca, setBusca] = useState('')
  const [filtroEmissao, setFiltroEmissao] = useState<number | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  // Relatório quinzenal — abre sempre na quinzena de hoje (no dia 16 vira sozinho para a 2ª)
  const [qMes, setQMes] = useState(() => diaLocal().slice(0, 7))
  const [qNum, setQNum] = useState<1 | 2>(() => (new Date().getDate() <= 15 ? 1 : 2))

  async function saveControl(id: string, fields: Record<string, any>) {
    setSaving(id)
    let { error } = await supabase.from('certificados_digitais').update(fields).eq('id', id)
    // Coluna data_conclusao ainda não existe (migration_v14 pendente): salva o restante
    if (error && 'data_conclusao' in fields && error.message?.includes('data_conclusao')) {
      const { data_conclusao, ...resto } = fields
      fields = resto
      if (Object.keys(resto).length > 0) ({ error } = await supabase.from('certificados_digitais').update(resto).eq('id', id))
      toast('Rode a migration_v14 no Supabase para registrar a data de conclusão.')
    }
    if (error) { setSaving(null); toast.error('Erro ao salvar: ' + error.message); return }
    setCerts(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
    setSaving(null)
    if (fields.certificado_finalizado === true) {
      toast.success('Certificado finalizado! Movido para a lista de Certificados.')
      const c = certs.find(x => x.id === id)
      registrarAcao('Certificado finalizado', `Certificado digital ${c?.tipo ?? ''} ${c?.uso ?? ''} finalizado — ${c?.titular ?? ''}`.replace(/\s+/g, ' ').trim(), { empresaId: c?.empresa_id })
      setAba('certificados')
    } else if (fields.certificado_finalizado === false) {
      toast.success('Reaberto. Movido para Em Processo.')
      setAba('processo')
    } else {
      toast.success('Salvo!')
    }
  }

  async function load() {
    setLoading(true)
    if (!orgId) return
    const [{ data: cs }, { data: emps }, { data: concl }, { data: donos }] = await Promise.all([
      supabase.from('v_certificados_status').select('*').order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social, cnpj').eq('org_id', orgId).order('razao_social'),
      supabase.from('certificados_digitais').select('id, data_conclusao'),
      supabase.from('certificados_digitais').select('id, empresa_id, org_id'),
    ])
    // Só certificados da organização selecionada: de empresas dela ou avulsos cadastrados nela
    const idsEmpresas = new Set((emps ?? []).map((e: any) => e.id))
    const dono = new Map((donos ?? []).map((r: any) => [r.id, r]))
    const daOrg = (c: any) => {
      const d: any = dono.get(c.id) ?? c
      return d.empresa_id ? idsEmpresas.has(d.empresa_id) : d.org_id === orgId
    }
    const conclusoes = new Map((concl ?? []).map((r: any) => [r.id, r.data_conclusao]))
    setCerts((cs ?? []).filter(daOrg).map((c: any) => ({ ...c, data_conclusao: conclusoes.get(c.id) ?? null })))
    setEmpresas((emps ?? []) as Empresa[])
    setLoading(false)
  }

  useEffect(() => { load() }, [orgId])

  const byEmpresa = (list: CertificadoDigital[]) =>
    filtroEmpresa === '__avulsa__'
      ? list.filter(c => !c.empresa_id)
      : filtroEmpresa
        ? list.filter(c => c.empresa_id === filtroEmpresa)
        : list

  function norm(str: string): string {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  }

  const byBusca = (list: CertificadoDigital[]) => {
    const q = norm(busca.trim())
    if (!q) return list
    const qDigits = q.replace(/\D/g, '')
    return list.filter(c => {
      const nome = norm(c.razao_social || (c as any).empresa_nome_livre || '')
      const titular = norm(c.titular || '')
      const cnpj = (c.cnpj || (c as any).empresa_cnpj_livre || '').replace(/\D/g, '')
      return nome.includes(q) || titular.includes(q) || (qDigits && cnpj.includes(qDigits))
    })
  }

  const emProcesso  = byBusca(byEmpresa(certs.filter(c => !(c as any).certificado_finalizado)))

  const byEmissao = (list: CertificadoDigital[]) => {
    if (!filtroEmissao) return list
    const corte = new Date()
    corte.setDate(corte.getDate() - filtroEmissao)
    corte.setHours(0, 0, 0, 0)
    return list.filter(c => {
      if (!c.data_emissao) return false
      return new Date(c.data_emissao + 'T12:00:00') >= corte
    })
  }

  const finalizados = byEmissao(byBusca(byEmpresa(certs.filter(c => !!(c as any).certificado_finalizado))))

  // ─── Seleção e exportação para Excel ─────────────────────────────
  function toggleSel(id: string) {
    setSelecionados(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleTodos(lista: CertificadoDigital[]) {
    setSelecionados(prev => {
      const n = new Set(prev)
      const todos = lista.length > 0 && lista.every(c => n.has(c.id))
      lista.forEach(c => { if (todos) n.delete(c.id); else n.add(c.id) })
      return n
    })
  }
  const todosMarcados = (lista: CertificadoDigital[]) => lista.length > 0 && lista.every(c => selecionados.has(c.id))

  const cadastradoEm = (c: CertificadoDigital) => (c.created_at ? diaLocal(new Date(c.created_at)) : '')
  const concluidoEm  = (c: CertificadoDigital) => ((c as any).data_conclusao as string | null) || ''

  async function exportarExcel(lista: CertificadoDigital[], arquivo: string, cabecalho: (string | number)[][] = []) {
    if (lista.length === 0) { toast.error('Nada para exportar.'); return }
    const XLSX = await import('xlsx')
    const linhas = lista.map(c => {
      const x = c as any
      const cnpj = c.cnpj || x.empresa_cnpj_livre || ''
      return [
        c.razao_social || x.empresa_nome_livre || '', cnpj ? formatCNPJ(cnpj) : '', c.titular, c.tipo, c.uso, c.autoridade_certificadora,
        c.created_at ? formatDate(cadastradoEm(c)) : '', c.data_emissao ? formatDate(c.data_emissao) : '', c.data_vencimento ? formatDate(c.data_vencimento) : '',
        x.certificado_finalizado ? 'Concluído' : 'Pendente', x.data_conclusao ? formatDate(x.data_conclusao) : '', x.pagamento_confirmado ? 'Confirmado' : 'Pendente',
        x.data_aviso_cliente ? formatDate(x.data_aviso_cliente) : '', fmtDateTime(x.data_agendamento) || '', c.observacoes || '',
      ]
    })
    const titulos = ['Empresa', 'CNPJ', 'Titular', 'Tipo', 'Uso', 'Autoridade certificadora', 'Cadastrado em', 'Emissão', 'Vencimento',
      'Situação', 'Concluído em', 'Pagamento', 'Aviso ao cliente', 'Videoconferência', 'Observações']
    const ws = XLSX.utils.aoa_to_sheet([...cabecalho, titulos, ...linhas])
    ws['!cols'] = [38, 20, 28, 6, 10, 22, 14, 12, 12, 12, 14, 12, 16, 18, 40].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Certificados')
    XLSX.writeFile(wb, arquivo + '.xlsx')
    toast.success(`${lista.length} certificado(s) exportado(s).`)
  }

  function exportarLista() {
    const visiveis = aba === 'processo' ? emProcesso : finalizados
    const marcados = certs.filter(c => selecionados.has(c.id))
    exportarExcel(marcados.length > 0 ? marcados : visiveis, `certificados_${diaLocal()}`)
  }

  // ─── Relatório quinzenal: cadastrados no período, concluídos ou pendentes ──
  const quinzena = periodoQuinzena(qMes, qNum)
  const noPeriodo = (d: string) => !!d && d >= quinzena.ini && d <= quinzena.fim
  const daQuinzena = byEmpresa(certs)
    .filter(c => noPeriodo(cadastradoEm(c)) || noPeriodo(concluidoEm(c)))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
  const qCadastrados = daQuinzena.filter(c => noPeriodo(cadastradoEm(c)))
  const qConcluidos  = daQuinzena.filter(c => noPeriodo(concluidoEm(c)))
  const qPendentes   = qCadastrados.filter(c => !(c as any).certificado_finalizado)

  function mudarQuinzena(delta: 1 | -1) {
    if (delta === 1 && qNum === 1) { setQNum(2); return }
    if (delta === -1 && qNum === 2) { setQNum(1); return }
    const [y, m] = qMes.split('-').map(Number)
    setQMes(diaLocal(new Date(y, m - 1 + delta, 1)).slice(0, 7))
    setQNum(delta === 1 ? 1 : 2)
  }

  function exportarQuinzena() {
    exportarExcel(daQuinzena, `certificados_${qMes}_${qNum}a-quinzena`, [
      [`Certificados digitais — ${quinzena.titulo} (${quinzena.faixa})`],
      ['Cadastrados na quinzena', qCadastrados.length, 'Concluídos na quinzena', qConcluidos.length, 'Cadastrados ainda pendentes', qPendentes.length],
      [],
    ])
  }

  // PDF do relatório quinzenal — abre em nova aba, sem baixar
  async function abrirPdfQuinzena() {
    if (daQuinzena.length === 0) { toast.error('Nada para gerar nesta quinzena.'); return }
    // a aba precisa ser aberta já no clique, senão o navegador bloqueia como popup
    const janela = window.open('', '_blank')
    if (!janela) { toast.error('Permita popups neste site para abrir o PDF.'); return }
    janela.document.title = 'Gerando relatório...'
    try {
      const jsPDF = (await import('jspdf')).default
      await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()
      const H = doc.internal.pageSize.getHeight()

      // Faixa da marca
      doc.setFillColor(13, 13, 13)
      doc.rect(0, 0, W, 24, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
      doc.setTextColor(255, 255, 255); doc.text('PARALEGAL', 14, 15)
      doc.setTextColor(245, 158, 11); doc.text('PRO', 14 + doc.getTextWidth('PARALEGAL '), 15)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 200, 200)
      doc.text(orgName, W - 14, 11, { align: 'right' })
      doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W - 14, 16, { align: 'right' })

      // Título e período
      doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
      doc.text('Certificados digitais — relatório quinzenal', 14, 36)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(71, 85, 105)
      const t = quinzena.titulo
      doc.text(`${t.charAt(0).toUpperCase() + t.slice(1)} · ${quinzena.faixa}${empresaNomeAtual ? ' · ' + empresaNomeAtual : ''}`, 14, 42)

      // Totais
      const totais: Array<[string, number]> = [
        ['Cadastrados na quinzena', qCadastrados.length],
        ['Concluídos na quinzena', qConcluidos.length],
        ['Cadastrados ainda pendentes', qPendentes.length],
      ]
      const boxW = 62
      totais.forEach(([rotulo, valor], i) => {
        const x = 14 + i * (boxW + 6)
        doc.setDrawColor(226, 232, 240); doc.setFillColor(248, 250, 252)
        doc.roundedRect(x, 48, boxW, 18, 2, 2, 'FD')
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(71, 85, 105)
        doc.text(rotulo, x + 4, 54)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(15, 23, 42)
        doc.text(String(valor), x + 4, 62)
      })

      ;(doc as any).autoTable({
        startY: 72,
        margin: { left: 14, right: 14, bottom: 14 },
        head: [['Cadastrado em', 'Concluído em', 'Empresa', 'CNPJ', 'Titular', 'Tipo / Uso', 'AC', 'Situação']],
        body: daQuinzena.map(c => {
          const x = c as any
          const cnpj = c.cnpj || x.empresa_cnpj_livre || ''
          return [
            c.created_at ? formatDate(cadastradoEm(c)) : '—',
            concluidoEm(c) ? formatDate(concluidoEm(c)) : '—',
            c.razao_social || x.empresa_nome_livre || '—',
            cnpj ? formatCNPJ(cnpj) : '—',
            c.titular || '—',
            `${c.tipo} · ${c.uso}`,
            c.autoridade_certificadora || '—',
            x.certificado_finalizado ? (concluidoEm(c) ? 'Concluído' : 'Concluído · sem data') : 'Pendente',
          ]
        }),
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: [15, 23, 42], lineColor: [226, 232, 240], lineWidth: 0.1 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 24 }, 3: { cellWidth: 36 }, 5: { cellWidth: 26 }, 7: { cellWidth: 32 } },
        didParseCell: (d: any) => {
          if (d.section === 'body' && d.column.index === 7) {
            d.cell.styles.fontStyle = 'bold'
            d.cell.styles.textColor = String(d.cell.raw).startsWith('Concluído') ? [22, 101, 52] : [154, 52, 18]
          }
        },
        didDrawPage: () => {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
          doc.text(`Página ${doc.getNumberOfPages()}`, W - 14, H - 6, { align: 'right' })
          doc.text('Paralegal PRO · relatório quinzenal de certificados digitais', 14, H - 6)
        },
      })

      doc.setProperties({ title: `Certificados - ${quinzena.titulo}` })
      janela.location.href = doc.output('bloburl') as unknown as string
    } catch (e: any) {
      janela.close()
      toast.error('Erro ao gerar o PDF: ' + (e?.message || ''))
    }
  }

  async function handleDelete() {
    if (!deleteItem) return
    const { error } = await supabase.from('certificados_digitais').delete().eq('id', deleteItem.id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Certificado excluído')
    setDeleteItem(null)
    load()
  }

  // ─── Chips de controle (usados na aba Em Processo) ───────────────
  function ControlChips({ c }: { c: CertificadoDigital }) {
    const avisoFmt   = fmtDate((c as any).data_aviso_cliente)
    const agendaFmt  = fmtDateTime((c as any).data_agendamento)
    const pago       = !!(c as any).pagamento_confirmado
    const isEditAviso  = editingDate?.id === c.id && editingDate.field === 'aviso'
    const isEditAgenda = editingDate?.id === c.id && editingDate.field === 'agenda'

    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setEditingDate(isEditAviso ? null : { id: c.id, field: 'aviso' })}
            title="Registrar data do aviso ao cliente"
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border transition-all ${
              avisoFmt ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                       : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
            } ${isEditAviso ? 'ring-1 ring-blue-400' : ''}`}>
            <span>📧</span><span>{avisoFmt ?? 'Aviso'}</span>
          </button>
          <button onClick={() => saveControl(c.id, { pagamento_confirmado: !pago })}
            disabled={saving === c.id}
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border transition-all ${
              pago ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                   : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
            }`}>
            <span>💰</span><span>{pago ? 'Pago' : 'Pendente'}</span>
          </button>
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setEditingDate(isEditAgenda ? null : { id: c.id, field: 'agenda' })}
            title="Agendar videoconferência"
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border transition-all ${
              agendaFmt ? 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
            } ${isEditAgenda ? 'ring-1 ring-violet-400' : ''}`}>
            <span>🎥</span><span>{agendaFmt ?? 'Videoconf.'}</span>
          </button>
          <button onClick={() => saveControl(c.id, { certificado_finalizado: true, data_conclusao: diaLocal() })}
            disabled={saving === c.id}
            title="Marcar como emitido e finalizado"
            className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border border-slate-200 bg-white text-slate-400 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
            <span>✅</span><span>Finalizar</span>
          </button>
        </div>
      </div>
    )
  }

  // ─── Linhas de editor de data inline ─────────────────────────────
  function DateEditorRow({ c, colSpan }: { c: CertificadoDigital; colSpan: number }) {
    const isEditAviso  = editingDate?.id === c.id && editingDate.field === 'aviso'
    const isEditAgenda = editingDate?.id === c.id && editingDate.field === 'agenda'
    if (!isEditAviso && !isEditAgenda) return null
    return (
      <tr className={`border-b ${isEditAviso ? 'bg-blue-50/70 border-blue-100' : 'bg-violet-50/70 border-violet-100'}`}>
        <td colSpan={colSpan} className="px-6 py-3">
          {isEditAviso && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wide text-blue-600">📧 Data do Aviso — {c.razao_social}</span>
              <input type="date" id={`aviso-${c.id}`}
                defaultValue={(c as any).data_aviso_cliente || ''}
                className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400 bg-white" />
              <button onClick={() => {
                const val = (document.getElementById(`aviso-${c.id}`) as HTMLInputElement)?.value || null
                saveControl(c.id, { data_aviso_cliente: val }).then(() => setEditingDate(null))
              }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700">Salvar</button>
              <button onClick={() => {
                const input = document.getElementById(`aviso-${c.id}`) as HTMLInputElement
                if (input) input.value = todayISO()
                saveControl(c.id, { data_aviso_cliente: todayISO() }).then(() => setEditingDate(null))
              }} className="bg-white border border-blue-300 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50">📅 Hoje</button>
              <button onClick={() => setEditingDate(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
            </div>
          )}
          {isEditAgenda && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wide text-violet-600">🎥 Agendamento — {c.razao_social}</span>
              <input type="datetime-local" id={`agenda-${c.id}`}
                defaultValue={(c as any).data_agendamento ? toLocalDatetimeInput((c as any).data_agendamento) : ''}
                className="border border-violet-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-violet-400 bg-white" />
              <button onClick={() => {
                const raw = (document.getElementById(`agenda-${c.id}`) as HTMLInputElement)?.value || null
                saveControl(c.id, { data_agendamento: localDatetimeToISO(raw ?? '') }).then(() => setEditingDate(null))
              }} className="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-violet-700">Salvar</button>
              {(c as any).data_agendamento && (
                <button onClick={() => saveControl(c.id, { data_agendamento: null }).then(() => setEditingDate(null))}
                  className="bg-white border border-red-200 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50">Remover</button>
              )}
              <button onClick={() => setEditingDate(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
            </div>
          )}
        </td>
      </tr>
    )
  }

  const empresaNomeAtual = filtroEmpresa && filtroEmpresa !== '__avulsa__'
    ? (empresas.find(e => e.id === filtroEmpresa)?.razao_social || '')
    : ''

  return (
    <div className="p-4 md:p-6 xl:p-8">
      {/* Banner empresa filtrada */}
      {filtroEmpresa && filtroEmpresa !== '__avulsa__' && searchParams.get('empresa') && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3 mb-4">
          <Link href={`/empresas/${filtroEmpresa}`} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Voltar para empresa
          </Link>
          <span className="text-blue-300">|</span>
          <span className="text-sm text-blue-800 font-bold break-words">{empresaNomeAtual}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600 mb-1">CONTROLES</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Certificados Digitais</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {emProcesso.length} em processo · {finalizados.length} emitido(s)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        {aba !== 'quinzena' && (
          <button onClick={exportarLista} className="btn-secondary"
            title="Exporta os certificados marcados; sem nenhum marcado, exporta a lista que está na tela">
            <Download className="w-4 h-4" />
            {selecionados.size > 0 ? `Exportar Excel (${selecionados.size} selecionado${selecionados.size > 1 ? 's' : ''})` : 'Exportar Excel'}
          </button>
        )}
        <button onClick={() => { setEditItem(null); setModalOpen(true) }} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Certificado
        </button>
        </div>
      </div>

      {/* Filtro + Abas */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <select className="input max-w-xs" value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)}>
            <option value="">Todas as empresas</option>
            <option value="__avulsa__">— Empresas Avulsas —</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
          </select>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar empresa, titular ou CNPJ..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="input pl-9 w-72"
            />
            {busca && (
              <button onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1.5">
          {([
            { id: 'processo',     label: 'Em Processo',  count: emProcesso.length,  hex: '#F59E0B', glow: 'rgba(245,158,11,0.25)', dot: 'bg-amber-400' },
            { id: 'certificados', label: 'Certificados', count: finalizados.length, hex: '#10B981', glow: 'rgba(16,185,129,0.25)', dot: 'bg-emerald-500' },
            { id: 'quinzena',     label: 'Relatório quinzenal', count: 0, hex: '#0F172A', glow: 'rgba(15,23,42,0.2)', dot: 'bg-slate-500' },
          ] as const).map(t => {
            const isActive = aba === t.id
            return (
              <button key={t.id} onClick={() => setAba(t.id)}
                style={isActive ? { background: t.hex, boxShadow: `0 4px 16px ${t.glow}, 0 1px 3px rgba(0,0,0,0.1)` } : {}}
                className={[
                  'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap select-none outline-none',
                  'transition-all duration-200 ease-in-out',
                  isActive
                    ? 'text-white -translate-y-px'
                    : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                ].join(' ')}>
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${!isActive ? t.dot : ''}`}
                  style={isActive ? { background: 'rgba(255,255,255,0.65)' } : {}}
                />
                {t.label}
                {t.count > 0 && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full leading-none"
                    style={isActive ? { background: 'rgba(255,255,255,0.25)', color: 'white' } : { background: '#F1F5F9', color: '#64748B' }}>
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-slate-400">Carregando...</div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════
              ABA: EM PROCESSO
          ══════════════════════════════════════════════════════ */}
          {aba === 'processo' && (
            <div className="card overflow-hidden">
              {emProcesso.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="font-semibold text-slate-700">Nenhum certificado em processo</p>
                  <p className="text-sm text-slate-400 mt-1">Tudo em dia ou adicione um novo certificado para iniciar o processo.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-amber-50 border-b border-amber-100">
                      <tr>
                        <th className="pl-4 py-3 w-8"><input type="checkbox" aria-label="Selecionar todos" checked={todosMarcados(emProcesso)} onChange={() => toggleTodos(emProcesso)} className="w-4 h-4 accent-slate-800" /></th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-amber-700">Empresa / Titular</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-amber-700">Tipo / AC</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-amber-700 min-w-[230px]">Controle do Processo</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-amber-700">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {emProcesso.map(c => (
                        <>
                        <tr key={c.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="pl-4 py-3 w-8"><input type="checkbox" aria-label={`Selecionar ${c.titular}`} checked={selecionados.has(c.id)} onChange={() => toggleSel(c.id)} className="w-4 h-4 accent-slate-800" /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {c.empresa_id
                                ? <Link href={`/empresas/${c.empresa_id}`} className="font-semibold text-slate-900 hover:text-blue-600 hover:underline underline-offset-2 transition-colors break-words" title="Ver cadastro da empresa">{c.razao_social}</Link>
                                : <span className="font-semibold text-slate-900 break-words">{c.razao_social}</span>
                              }
                              {!c.empresa_id && <span className="text-xs font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">avulsa</span>}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">{c.titular}</div>
                            {c.cnpj && <div className="text-xs text-slate-400 font-mono">{formatCNPJ(c.cnpj)}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${
                                c.tipo === 'A1' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                              }`}>{c.tipo}</span>
                              <span className="text-slate-600 text-xs">{c.uso}</span>
                            </div>
                            <div className="text-xs text-slate-400">{c.autoridade_certificadora}</div>
                          </td>
                          <td className="px-4 py-3">
                            <ControlChips c={c} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => { setEditItem(c); setModalOpen(true) }}
                                className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Editar">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => setDeleteItem(c)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                        <DateEditorRow c={c} colSpan={5} />
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              ABA: CERTIFICADOS EMITIDOS
          ══════════════════════════════════════════════════════ */}
          {aba === 'certificados' && (
            <>
              {/* Filtro por data de emissão */}
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-1">Emitidos nos últimos:</span>
                {[15, 30, 45, 60, 90].map(d => {
                  const isActive = filtroEmissao === d
                  return (
                    <button key={d} onClick={() => setFiltroEmissao(isActive ? null : d)}
                      style={isActive ? { background: '#3B82F6', boxShadow: '0 4px 16px rgba(59,130,246,0.25), 0 1px 3px rgba(0,0,0,0.1)' } : {}}
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap select-none outline-none',
                        'transition-all duration-200 ease-in-out',
                        isActive
                          ? 'text-white -translate-y-px'
                          : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                      ].join(' ')}>
                      {d} dias
                    </button>
                  )
                })}
                {filtroEmissao && (
                  <button onClick={() => setFiltroEmissao(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 underline ml-1">
                    Limpar
                  </button>
                )}
              </div>

            <div className="card overflow-hidden">
              {finalizados.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="font-semibold text-slate-700">Nenhum certificado emitido ainda</p>
                  <p className="text-sm text-slate-400 mt-1">Os certificados aparecem aqui após serem marcados como finalizados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="pl-4 py-3 w-8"><input type="checkbox" aria-label="Selecionar todos" checked={todosMarcados(finalizados)} onChange={() => toggleTodos(finalizados)} className="w-4 h-4 accent-slate-800" /></th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Empresa</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Titular</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Tipo / Uso</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">AC</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Emissão</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Vencimento</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Conclusão</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {finalizados.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="pl-4 py-3 w-8"><input type="checkbox" aria-label={`Selecionar ${c.titular}`} checked={selecionados.has(c.id)} onChange={() => toggleSel(c.id)} className="w-4 h-4 accent-slate-800" /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {c.empresa_id
                                ? <Link href={`/empresas/${c.empresa_id}`} className="font-medium text-slate-900 hover:text-blue-600 hover:underline underline-offset-2 transition-colors break-words" title="Ver cadastro da empresa">{c.razao_social}</Link>
                                : <span className="font-medium text-slate-900 break-words">{c.razao_social}</span>
                              }
                              {!c.empresa_id && <span className="text-xs font-bold uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">avulsa</span>}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">{c.cnpj && formatCNPJ(c.cnpj)}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{c.titular}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${
                                c.tipo === 'A1' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                              }`}>{c.tipo}</span>
                              <span className="text-slate-600">{c.uso}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {AC_URLS[c.autoridade_certificadora] ? (
                              <a href={AC_URLS[c.autoridade_certificadora]} target="_blank" rel="noopener noreferrer"
                                className="text-primary-600 hover:underline">{c.autoridade_certificadora}</a>
                            ) : (
                              <span className="text-slate-600">{c.autoridade_certificadora}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(c.data_emissao) || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(c.data_vencimento) || '—'}</td>
                          <td className="px-4 py-3">
                            <input type="date" aria-label={`Data de conclusão de ${c.titular}`}
                              value={concluidoEm(c)} max={diaLocal()} disabled={saving === c.id}
                              onChange={e => saveControl(c.id, { data_conclusao: e.target.value || null })}
                              className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white outline-none focus:border-slate-500" />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={c.status_cor ?? 'sem_data'} diasParaVencer={c.dias_para_vencer} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              {AC_URLS[c.autoridade_certificadora] && (
                                <a href={AC_URLS[c.autoridade_certificadora]} target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Renovar online">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </a>
                              )}
                              <button onClick={() => saveControl(c.id, { certificado_finalizado: false, data_conclusao: null })}
                                disabled={saving === c.id}
                                title="Reabrir para edição do processo"
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                              <button onClick={() => { setEditItem(c); setModalOpen(true) }}
                                className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Editar">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => setDeleteItem(c)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════
              ABA: RELATÓRIO QUINZENAL
          ══════════════════════════════════════════════════════ */}
          {aba === 'quinzena' && (
            <div className="space-y-4">
              <div className="card p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => mudarQuinzena(-1)} className="btn-secondary px-3" aria-label="Quinzena anterior">←</button>
                  <input type="month" aria-label="Mês" value={qMes} onChange={e => e.target.value && setQMes(e.target.value)} className="input w-auto" />
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    {([1, 2] as const).map(n => (
                      <button key={n} onClick={() => setQNum(n)} aria-pressed={qNum === n}
                        className={`px-3 py-2 text-sm font-semibold transition-colors ${qNum === n ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                        {n === 1 ? 'Dias 1 a 15' : 'Dia 16 ao fim'}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => mudarQuinzena(1)} className="btn-secondary px-3" aria-label="Próxima quinzena">→</button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={abrirPdfQuinzena} className="btn-secondary" title="Abre o relatório em PDF em uma nova aba">
                    <FileText className="w-4 h-4" />
                    Abrir PDF
                  </button>
                  <button onClick={exportarQuinzena} className="btn-primary">
                    <Download className="w-4 h-4" />
                    Exportar Excel
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">{quinzena.titulo}</h2>
                <p className="text-sm text-slate-500">Certificados cadastrados ou concluídos de {quinzena.faixa}{empresaNomeAtual ? ` · ${empresaNomeAtual}` : ''}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Cadastrados na quinzena', val: qCadastrados.length },
                  { label: 'Concluídos na quinzena', val: qConcluidos.length },
                  { label: 'Cadastrados ainda pendentes', val: qPendentes.length },
                ].map(k => (
                  <div key={k.label} className="card p-4">
                    <p className="text-xs font-semibold text-slate-500">{k.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{k.val}</p>
                  </div>
                ))}
              </div>

              <div className="card overflow-hidden">
                {daQuinzena.length === 0 ? (
                  <p className="p-12 text-center text-sm text-slate-500">Nenhum certificado cadastrado ou concluído nesta quinzena.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          {['Cadastrado em', 'Concluído em', 'Empresa', 'Titular', 'Tipo / Uso', 'AC', 'Situação'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {daQuinzena.map(c => {
                          const concluido = !!(c as any).certificado_finalizado
                          return (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(cadastradoEm(c))}</td>
                              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{concluidoEm(c) ? formatDate(concluidoEm(c)) : '—'}</td>
                              <td className="px-4 py-3 font-semibold text-slate-900 break-words">{c.razao_social || (c as any).empresa_nome_livre || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{c.titular}</td>
                              <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{c.tipo} · {c.uso}</td>
                              <td className="px-4 py-3 text-slate-600">{c.autoridade_certificadora}</td>
                              <td className="px-4 py-3">
                                <span className={concluido ? 'badge-ok' : 'badge-critico'}>{concluido ? (concluidoEm(c) ? 'Concluído' : 'Concluído · sem data') : 'Pendente'}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null) }}
        title={editItem ? 'Editar Certificado' : 'Novo Certificado Digital'} size="lg">
        <CertificadoForm
          empresas={empresas}
          certificado={editItem ?? undefined}
          defaultEmpresaId={filtroEmpresa}
          onSuccess={() => { setModalOpen(false); setEditItem(null); load() }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        title="Excluir Certificado"
        message={`Deseja excluir o certificado de "${deleteItem?.titular}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
        danger
      />
    </div>
  )
}

export default function CertificadosPage() {
  return <Suspense><CertificadosPageInner /></Suspense>
}
