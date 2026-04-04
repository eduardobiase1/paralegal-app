'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Empresa } from '@/types'
import toast from 'react-hot-toast'

export default function RelatoriosPage() {
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

      // Buscar todos os dados da empresa
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
        supabase.from('processos_societarios').select('*, etapas:processo_etapas(*)').eq('empresa_id', empresaId).eq('status', 'em_andamento'),
      ])

      // Importar jspdf dinamicamente
      const jsPDF = (await import('jspdf')).default
      await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      let y = 15

      // ── Cabeçalho ──────────────────────────────────────────
      doc.setFillColor(37, 99, 235)
      doc.rect(0, 0, pageWidth, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Relatório Paralegal', 14, 12)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(empresa.razao_social, 14, 19)
      doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, 19, { align: 'right' })
      y = 36

      // ── Dados cadastrais ───────────────────────────────────
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Dados Cadastrais', 14, y); y += 6

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)

      const dadosCad = [
        ['CNPJ', empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')],
      ]
      ;(doc as any).autoTable({
        startY: y,
        head: [],
        body: dadosCad,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
        margin: { left: 14, right: 14 },
      })
      y = (doc as any).lastAutoTable.finalY + 8

      // ── Certidões ──────────────────────────────────────────
      const addSection = (title: string, headers: string[], rows: string[][], color: [number,number,number]) => {
        if (y > 260) { doc.addPage(); y = 15 }
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(title, 14, y); y += 4

        ;(doc as any).autoTable({
          startY: y,
          head: [headers],
          body: rows.length ? rows : [['Nenhum registro encontrado']],
          theme: 'striped',
          headStyles: { fillColor: color, fontSize: 9, fontStyle: 'bold' },
          styles: { fontSize: 8.5, cellPadding: 2 },
          margin: { left: 14, right: 14 },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      }

      const statusLabel = (s: string) => {
        const m: Record<string, string> = {
          ok: 'Em dia', alerta: 'Atenção (90d)', atencao: 'Atenção (60d)',
          critico: 'Crítico (30d)', vencido: 'Vencido', sem_data: 'Sem data'
        }
        return m[s] ?? s
      }

      const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

      addSection(
        'Certidões Negativas',
        ['Tipo', 'Órgão', 'Emissão', 'Vencimento', 'Status'],
        (certidoes ?? []).map((c: any) => [c.tipo, c.orgao_emissor, fmtDate(c.data_emissao), fmtDate(c.data_vencimento), statusLabel(c.status_cor ?? '')]),
        [99, 102, 241]
      )

      addSection(
        'Alvarás de Funcionamento',
        ['Tipo', 'Órgão', 'Número', 'Vencimento', 'Status'],
        (alvaras ?? []).map((a: any) => [a.tipo, a.orgao_emissor, a.numero ?? '—', fmtDate(a.data_vencimento), statusLabel(a.status_cor ?? '')]),
        [16, 185, 129]
      )

      addSection(
        'Licenças Sanitárias',
        ['Órgão', 'Número', 'Atividade', 'Vencimento', 'Status'],
        (licencas ?? []).map((l: any) => [l.orgao, l.numero_licenca ?? '—', (l.atividade_sanitaria ?? '').slice(0,30), fmtDate(l.data_vencimento), statusLabel(l.status_cor ?? '')]),
        [245, 158, 11]
      )

      addSection(
        'Certificados Digitais',
        ['Titular', 'Tipo', 'Uso', 'AC', 'Vencimento', 'Status'],
        (certificados ?? []).map((c: any) => [c.titular, c.tipo, c.uso, c.autoridade_certificadora, fmtDate(c.data_vencimento), statusLabel(c.status_cor ?? '')]),
        [139, 92, 246]
      )

      // Processos em andamento
      if (processos && processos.length > 0) {
        const TIPO_LABELS: Record<string, string> = {
          abertura: 'Abertura', alteracao_contratual: 'Alteração Contratual',
          encerramento: 'Encerramento', transferencia_entrada: 'Transf. Entrada',
          transferencia_saida: 'Transf. Saída',
        }
        addSection(
          'Processos Societários em Andamento',
          ['Tipo', 'Etapa Atual', 'Abertura'],
          (processos as any[]).map((p: any) => {
            const etapaAtual = (p.etapas ?? []).find((e: any) => e.status === 'em_andamento')?.nome
              || (p.etapas ?? []).find((e: any) => e.status === 'pendente')?.nome
              || 'Concluído'
            return [TIPO_LABELS[p.tipo] ?? p.tipo, etapaAtual, fmtDate(p.data_abertura)]
          }),
          [59, 130, 246]
        )
      }

      // Rodapé
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(
          `Página ${i}/${totalPages} — Gerado em ${new Date().toLocaleString('pt-BR')}`,
          pageWidth / 2, doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        )
      }

      doc.save(`Relatorio_${empresa.razao_social.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('Relatório gerado!')
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao gerar PDF: ' + (err.message ?? 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Relatório por Cliente</h1>

      <div className="card">
        <div className="card-body space-y-6">
          <div>
            <label className="label">Empresa *</label>
            <select className="input" value={empresaId} onChange={e => setEmpresaId(e.target.value)}>
              <option value="">Selecione uma empresa...</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
            </select>
          </div>

          {empresaId && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-medium mb-2">O relatório incluirá:</p>
              <ul className="space-y-1 list-disc list-inside text-blue-700">
                <li>Dados cadastrais da empresa</li>
                <li>Certidões negativas com status atual</li>
                <li>Alvarás de funcionamento</li>
                <li>Licenças sanitárias</li>
                <li>Certificados digitais</li>
                <li>Processos societários em andamento</li>
              </ul>
            </div>
          )}

          <button
            onClick={gerarRelatorio}
            disabled={loading || !empresaId}
            className="btn-primary w-full justify-center py-3"
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
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Gerar e Baixar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
