'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import { Empresa } from '@/types'
import toast from 'react-hot-toast'

// Paralegal PRO colors
const PRETO: [number, number, number] = [13, 13, 13]
const AMARELO: [number, number, number] = [251, 191, 36]
const CINZA_CLARO: [number, number, number] = [248, 250, 252]
const CINZA_MEDIO: [number, number, number] = [148, 163, 184]
const BRANCO: [number, number, number] = [255, 255, 255]

export default function RelatoriosPage() {
  const { orgId, orgName } = useOrg()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [loading, setLoading] = useState(false)
  const [supabase] = useState(createClient)

  useEffect(() => {
    supabase.from('empresas').select('id, razao_social, cnpj, uf').order('razao_social')
      .then(({ data }) => setEmpresas((data ?? []) as Empresa[]))
  }, [])

  async function gerarRelatorio() {
    if (!empresaId) { toast.error('Selecione uma empresa'); return }
    setLoading(true)

    try {
      const empresa = empresas.find(e => e.id === empresaId)!

      const [
        { data: certidoes },
        { data: alvaras },
        { data: licencas },
        { data: certificados },
        { data: processos },
      ] = await Promise.all([
        supabase.from('v_certidoes_status').select('*').eq('empresa_id', empresaId),
        supabase.from('v_alvaras_status').select('*').eq('empresa_id', empresaId),
        supabase.from('v_licencas_status').select('*').eq('empresa_id', empresaId),
        supabase.from('v_certificados_status').select('*').eq('empresa_id', empresaId),
        supabase.from('processos_societarios').select('*').eq('empresa_id', empresaId).neq('status', 'cancelado'),
      ])

      const jsPDF = (await import('jspdf')).default
      await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()   // 210
      const H = doc.internal.pageSize.getHeight()  // 297
      const hoje = new Date().toLocaleDateString('pt-BR')
      let y = 0

      // ══════════════════════════════════════════════
      // CAPA / CABEÇALHO
      // ══════════════════════════════════════════════

      // Fundo preto topo
      doc.setFillColor(...PRETO)
      doc.rect(0, 0, W, 52, 'F')

      // Título grande (esquerda)
      doc.setTextColor(...BRANCO)
      doc.setFontSize(28)
      doc.setFont('helvetica', 'bold')
      doc.text('PARALEGAL', 14, 20)

      doc.setTextColor(...AMARELO)
      doc.setFontSize(28)
      doc.text('PRO', 14 + doc.getTextWidth('PARALEGAL '), 20)

      doc.setTextColor(...BRANCO)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text('Gestão Paralegal para Escritórios Contábeis', 14, 28)

      // Badge "Relatório" (direita) — retângulo arredondado amarelo
      const badgeW = 42
      const badgeH = 10
      const badgeX = W - 14 - badgeW
      const badgeY = 12
      doc.setFillColor(...AMARELO)
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, 'F')
      doc.setTextColor(...PRETO)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Relatório de Cliente', badgeX + badgeW / 2, badgeY + 6.5, { align: 'center' })

      // Data emissão (direita baixo)
      doc.setTextColor(...CINZA_MEDIO)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Emitido em ${hoje}`, W - 14, 35, { align: 'right' })
      doc.text(`Escritório: ${orgName}`, W - 14, 40, { align: 'right' })

      y = 60

      // ── Bloco de dados da empresa ──
      doc.setFillColor(...CINZA_CLARO)
      doc.roundedRect(14, y - 4, W - 28, 22, 2, 2, 'F')

      doc.setTextColor(...PRETO)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(empresa.razao_social.toUpperCase(), 19, y + 4)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      const cnpjFmt = empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      doc.text(`CNPJ: ${cnpjFmt}`, 19, y + 11)
      if (empresa.uf) doc.text(`UF: ${empresa.uf}`, 19 + 60, y + 11)

      y = y + 28

      // ══════════════════════════════════════════════
      // HELPERS
      // ══════════════════════════════════════════════

      const fmtDate = (d: string | null) =>
        d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

      const statusLabel = (s: string) => ({
        ok: '✓ Em dia',
        alerta: '! Atenção (90d)',
        atencao: '! Atenção (60d)',
        critico: '⚠ Crítico (30d)',
        vencido: '✗ Vencido',
        sem_data: '— Sem data',
      }[s] ?? s)

      const statusColor = (s: string): [number, number, number] => ({
        ok: [16, 185, 129] as [number, number, number],
        alerta: [245, 158, 11] as [number, number, number],
        atencao: [245, 158, 11] as [number, number, number],
        critico: [239, 68, 68] as [number, number, number],
        vencido: [127, 29, 29] as [number, number, number],
        sem_data: [148, 163, 184] as [number, number, number],
      }[s] ?? [148, 163, 184] as [number, number, number])

      // Título de seção com seta amarela (estilo do modelo)
      const sectionTitle = (title: string) => {
        if (y > 262) { doc.addPage(); y = 15 }

        // Seta amarela "→"
        doc.setFillColor(...AMARELO)
        doc.roundedRect(14, y - 4, 7, 7, 1.5, 1.5, 'F')
        doc.setTextColor(...PRETO)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text('→', 14 + 3.5, y + 0.5, { align: 'center' })

        // Título
        doc.setTextColor(...PRETO)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(title.toUpperCase(), 24, y + 0.5)

        // Linha decorativa amarela
        doc.setDrawColor(...AMARELO)
        doc.setLineWidth(0.5)
        doc.line(24, y + 3, W - 14, y + 3)

        y += 9
      }

      // Tabela padrão
      const addTable = (headers: string[], rows: string[][], statusColIndex?: number) => {
        if (y > 262) { doc.addPage(); y = 15 };

        (doc as any).autoTable({
          startY: y,
          head: [headers],
          body: rows.length ? rows : [Array(headers.length).fill('Nenhum registro encontrado')],
          theme: 'grid',
          headStyles: {
            fillColor: PRETO,
            textColor: AMARELO,
            fontSize: 8,
            fontStyle: 'bold',
            cellPadding: 3,
          },
          styles: {
            fontSize: 8,
            cellPadding: 2.5,
            textColor: [40, 40, 40] as [number, number, number],
            lineColor: [220, 220, 220] as [number, number, number],
            lineWidth: 0.2,
          },
          alternateRowStyles: {
            fillColor: CINZA_CLARO,
          },
          margin: { left: 14, right: 14 },
          didDrawCell: (data: any) => {
            if (statusColIndex !== undefined && data.column.index === statusColIndex && data.section === 'body' && rows.length > 0) {
              const statusText = data.cell.text[0] ?? ''
              let color: [number, number, number] = [40, 40, 40]
              if (statusText.includes('Em dia')) color = [16, 185, 129]
              else if (statusText.includes('Crítico')) color = [239, 68, 68]
              else if (statusText.includes('Atenção')) color = [245, 158, 11]
              else if (statusText.includes('Vencido')) color = [180, 30, 30]
              doc.setTextColor(...color)
            }
          },
        })
        y = (doc as any).lastAutoTable.finalY + 10
      }

      // ══════════════════════════════════════════════
      // SEÇÕES DO RELATÓRIO
      // ══════════════════════════════════════════════

      // 1. PROCESSOS SOCIETÁRIOS
      sectionTitle('Processos Societários')

      const TIPO_LABELS: Record<string, string> = {
        abertura: 'Abertura de Empresa',
        alteracao_contratual: 'Alteração Contratual',
        encerramento: 'Encerramento',
        transferencia_entrada: 'Transferência (Entrada)',
        transferencia_saida: 'Transferência (Saída)',
      }
      const STATUS_LABELS: Record<string, string> = {
        Andamento: 'Em Andamento',
        Finalizado: 'Finalizado',
        cancelado: 'Cancelado',
      }

      addTable(
        ['Tipo de Processo', 'Status', 'Progresso'],
        (processos ?? []).map((p: any) => {
          const checklist = p.checklist ?? []
          const concluidos = checklist.filter((i: any) => i.status === 'Concluido').length
          const total = checklist.length || 1
          const porc = Math.round((concluidos / total) * 100)
          return [
            TIPO_LABELS[p.tipo] ?? p.tipo,
            STATUS_LABELS[p.status] ?? p.status,
            `${porc}% (${concluidos}/${total} etapas)`,
          ]
        }),
      )

      // 2. CERTIDÕES NEGATIVAS
      sectionTitle('Certidões Negativas')
      addTable(
        ['Tipo', 'Órgão Emissor', 'Emissão', 'Vencimento', 'Status'],
        (certidoes ?? []).map((c: any) => [
          c.tipo, c.orgao_emissor,
          fmtDate(c.data_emissao), fmtDate(c.data_vencimento),
          statusLabel(c.status_cor ?? ''),
        ]),
        4
      )

      // 3. ALVARÁS DE FUNCIONAMENTO
      sectionTitle('Alvarás de Funcionamento')
      addTable(
        ['Tipo', 'Órgão Emissor', 'Número', 'Vencimento', 'Status'],
        (alvaras ?? []).map((a: any) => [
          a.tipo, a.orgao_emissor,
          a.numero ?? '—', fmtDate(a.data_vencimento),
          statusLabel(a.status_cor ?? ''),
        ]),
        4
      )

      // 4. LICENÇAS SANITÁRIAS
      sectionTitle('Licenças Sanitárias')
      addTable(
        ['Órgão', 'Nº Licença', 'Atividade', 'Vencimento', 'Status'],
        (licencas ?? []).map((l: any) => [
          l.orgao, l.numero_licenca ?? '—',
          (l.atividade_sanitaria ?? '—').slice(0, 32),
          fmtDate(l.data_vencimento),
          statusLabel(l.status_cor ?? ''),
        ]),
        4
      )

      // 5. CERTIFICADOS DIGITAIS
      sectionTitle('Certificados Digitais')
      addTable(
        ['Titular', 'Tipo', 'Uso', 'Autoridade Cert.', 'Vencimento', 'Status'],
        (certificados ?? []).map((c: any) => [
          c.titular, c.tipo, c.uso,
          c.autoridade_certificadora,
          fmtDate(c.data_vencimento),
          statusLabel(c.status_cor ?? ''),
        ]),
        5
      )

      // ══════════════════════════════════════════════
      // RODAPÉ EM TODAS AS PÁGINAS
      // ══════════════════════════════════════════════

      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)

        // Linha separadora
        doc.setDrawColor(...AMARELO)
        doc.setLineWidth(0.5)
        doc.line(14, H - 14, W - 14, H - 14)

        // Texto do rodapé
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...CINZA_MEDIO)
        doc.text('PARALEGAL PRO — Gestão Paralegal para Escritórios Contábeis', 14, H - 9)
        doc.text(
          `Página ${i} de ${totalPages}  •  Emitido em ${new Date().toLocaleString('pt-BR')}`,
          W - 14, H - 9, { align: 'right' }
        )
      }

      const nomeArquivo = `ParalegalPRO_${empresa.razao_social.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(nomeArquivo)
      toast.success('Relatório gerado com sucesso!')
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao gerar PDF: ' + (err.message ?? 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen font-sans">
      {/* Cabeçalho */}
      <header className="mb-8">
        <h1 className="text-2xl font-black italic tracking-tighter uppercase text-slate-900">
          PARALEGAL PRO <span className="text-yellow-500">| RELATÓRIOS PDF</span>
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{orgName}</p>
      </header>

      <div className="max-w-2xl space-y-6">
        {/* Card principal */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-lg font-black text-slate-900 mb-1">Relatório por Cliente</h2>
          <p className="text-xs text-slate-400 mb-6">Gera um PDF completo com todos os documentos e processos da empresa selecionada.</p>

          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecione a Empresa</label>
          <select
            className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-2 text-sm font-bold outline-none focus:border-yellow-400 text-slate-800 transition-all"
            value={empresaId}
            onChange={e => setEmpresaId(e.target.value)}
          >
            <option value="">— Escolha uma empresa —</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
          </select>

          {empresaId && (
            <div className="mt-5 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">O relatório incluirá:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Processos Societários',
                  'Certidões Negativas',
                  'Alvarás de Funcionamento',
                  'Licenças Sanitárias',
                  'Certificados Digitais',
                  'Status de vencimentos',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-400 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-[8px] font-black text-black">→</span>
                    </div>
                    <span className="text-xs font-medium text-slate-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={gerarRelatorio}
            disabled={loading || !empresaId}
            className={`mt-6 w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${
              !empresaId
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-black text-yellow-400 hover:bg-slate-800 hover:scale-[1.02]'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Gerando PDF...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Gerar e Baixar PDF
              </>
            )}
          </button>
        </div>

        {/* Preview do modelo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Prévia do Modelo</p>
          <div className="border-2 border-slate-100 rounded-xl overflow-hidden">
            {/* Simulação do cabeçalho do PDF */}
            <div className="bg-[#0d0d0d] p-4 flex justify-between items-start">
              <div>
                <p className="font-black text-white text-lg tracking-tight">
                  PARALEGAL <span className="text-yellow-400">PRO</span>
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">Gestão Paralegal para Escritórios Contábeis</p>
              </div>
              <div className="bg-yellow-400 text-black text-[9px] font-black px-3 py-1.5 rounded">
                Relatório de Cliente
              </div>
            </div>
            {/* Simulação de seção */}
            <div className="p-4 space-y-2 bg-slate-50">
              {['Processos Societários', 'Certidões Negativas', 'Alvarás', 'Licenças', 'Certificados Digitais'].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-yellow-400 rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-black">→</span>
                  </div>
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
