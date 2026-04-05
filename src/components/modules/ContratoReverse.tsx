'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntidadeDetectada {
  id: string
  tipo: 'cnpj' | 'cpf' | 'capital' | 'data' | 'cep'
  label: string
  valor: string
  contexto: string
}

interface Substituicao {
  id: string
  tipo: EntidadeDetectada['tipo']
  label: string
  original: string
  novo: string
  ativo: boolean
  contexto: string
}

// ── Regex Patterns ────────────────────────────────────────────────────────────

const PADROES: { tipo: EntidadeDetectada['tipo']; label: string; source: string; flags: string }[] = [
  { tipo: 'cnpj',    label: 'CNPJ',              source: String.raw`\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}`,     flags: 'g' },
  { tipo: 'cpf',     label: 'CPF',               source: String.raw`\d{3}\.\d{3}\.\d{3}-\d{2}`,             flags: 'g' },
  { tipo: 'capital', label: 'Capital / Valor',   source: String.raw`R\$\s*[\d.]+,\d{2}`,                    flags: 'g' },
  { tipo: 'cep',     label: 'CEP',               source: String.raw`\d{5}-\d{3}`,                            flags: 'g' },
  { tipo: 'data',    label: 'Data por extenso',  source: String.raw`\d{1,2}\s+de\s+(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}`, flags: 'gi' },
  { tipo: 'data',    label: 'Data numérica',     source: String.raw`\d{2}\/\d{2}\/\d{4}`,                   flags: 'g' },
]

function detectarEntidades(texto: string): EntidadeDetectada[] {
  const found: EntidadeDetectada[] = []
  const vistas = new Set<string>()

  for (const { tipo, label, source, flags } of PADROES) {
    const re = new RegExp(source, flags)
    let match: RegExpExecArray | null
    while ((match = re.exec(texto)) !== null) {
      const valor = match[0].trim()
      const chave = `${tipo}:${valor.toLowerCase()}`
      if (vistas.has(chave)) continue
      vistas.add(chave)

      const start = Math.max(0, match.index - 55)
      const end   = Math.min(texto.length, match.index + valor.length + 55)
      const contexto = '…' + texto.substring(start, end).replace(/\s+/g, ' ').trim() + '…'

      found.push({ id: `${tipo}_${found.length}`, tipo, label, valor, contexto })
    }
  }

  return found
}

function aplicarSubstituicoes(texto: string, subs: Substituicao[]): string {
  let resultado = texto
  for (const sub of subs) {
    if (!sub.ativo || !sub.novo.trim() || sub.novo.trim() === sub.original) continue
    resultado = resultado.split(sub.original).join(sub.novo.trim())
  }
  return resultado
}

// ── Badge styles per type ─────────────────────────────────────────────────────

const TIPO_COR: Record<string, string> = {
  cnpj:    'bg-blue-100 text-blue-800 border-blue-200',
  cpf:     'bg-green-100 text-green-800 border-green-200',
  capital: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  data:    'bg-purple-100 text-purple-800 border-purple-200',
  cep:     'bg-pink-100 text-pink-800 border-pink-200',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContratoReverse() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [textoOriginal, setTextoOriginal] = useState('')
  const [entidades, setEntidades] = useState<EntidadeDetectada[]>([])
  const [substituicoes, setSubstituicoes] = useState<Substituicao[]>([])
  const [showDiff, setShowDiff] = useState(false)

  const textoFinal = aplicarSubstituicoes(textoOriginal, substituicoes)

  // ── PDF Extraction ──────────────────────────────────────────────────────────

  async function handlePdfUpload(file: File) {
    setLoading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()

      // Dynamic import — pdfjs-dist must be in package.json
      const pdfjsLib = await import('pdfjs-dist')

      // Use CDN worker to avoid bundler complexity
      const version = (pdfjsLib as any).version as string
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const numPages = pdf.numPages
      let fullText = ''

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = (content.items as any[])
          .map((item) => (item as any).str ?? '')
          .join(' ')
        fullText += pageText + '\n\n'
      }

      const texto = fullText.trim()
      if (!texto) {
        toast.error('Não foi possível extrair texto. O PDF pode ser escaneado — cole o texto manualmente.')
        setLoading(false)
        return
      }

      setTextoOriginal(texto)
      toast.success(`PDF processado: ${numPages} página(s), ${texto.length.toLocaleString('pt-BR')} caracteres`)
    } catch (err: any) {
      toast.error('Erro ao processar PDF: ' + (err?.message ?? 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  // ── Step navigation ─────────────────────────────────────────────────────────

  function handleAnalisar() {
    if (!textoOriginal.trim()) { toast.error('Insira o texto do contrato'); return }
    const ents = detectarEntidades(textoOriginal)
    setEntidades(ents)
    setSubstituicoes(ents.map(e => ({
      id: e.id,
      tipo: e.tipo,
      label: e.label,
      original: e.valor,
      novo: '',
      ativo: true,
      contexto: e.contexto,
    })))
    setStep(2)
  }

  function setSub(id: string, campo: 'novo' | 'ativo', valor: string | boolean) {
    setSubstituicoes(prev => prev.map(s => s.id === id ? { ...s, [campo]: valor } : s))
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  async function handleGerarDocx() {
    setLoading(true)
    try {
      const { Document, Paragraph, TextRun, Packer, AlignmentType } = await import('docx')
      const { saveAs } = await import('file-saver')

      const paragrafos = textoFinal
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean)

      const doc = new Document({
        sections: [{
          properties: {
            page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
          },
          children: paragrafos.map(p => {
            const isCentro = p.length < 120 && /^(?:CONTRATO|DISTRATO|ALTERAÇÃO|INSTRUMENTO|ATA|PROCURAÇÃO)\b/i.test(p)
            return new Paragraph({
              children: [new TextRun({ text: p, size: 24, font: 'Times New Roman' })],
              alignment: isCentro ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
              spacing: { before: 200, after: 200, line: 360 },
            })
          }),
        }],
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `contrato_alterado_${new Date().toISOString().split('T')[0]}.docx`)
      toast.success('Documento Word gerado!')
    } catch (err: any) {
      toast.error('Erro ao gerar Word: ' + (err?.message ?? 'Erro'))
    } finally {
      setLoading(false)
    }
  }

  function handleGerarPdf() {
    const linhas = textoFinal.split('\n').map(l =>
      l.trim() ? `<p style="margin:0 0 6px">${l.trim()}</p>` : '<br>'
    ).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        body { font-family:'Times New Roman',serif; margin:2.5cm; line-height:1.6; font-size:12pt; }
        @media print { .no-print { display:none } }
      </style></head><body>
      <p class="no-print" style="margin-bottom:16px">
        <button onclick="window.print()" style="padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">
          Imprimir / Salvar como PDF
        </button>
      </p>
      ${linhas}
    </body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
  }

  // ── Step labels ─────────────────────────────────────────────────────────────

  const STEPS = ['Texto do Contrato', 'Identificar Alterações', 'Prévia & Exportar']

  const alteracoesAtivas = substituicoes.filter(s => s.ativo && s.novo.trim() && s.novo.trim() !== s.original)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Step indicator */}
      <div className="flex items-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i + 1 === step  ? 'bg-blue-600 text-white' :
              i + 1 < step    ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i + 1 < step ? '✓' : i + 1}
            </div>
            <span className={`ml-2 text-xs font-medium ${i + 1 === step ? 'text-gray-900' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200 mx-3" />}
          </div>
        ))}
      </div>

      {/* ═══════════════════ STEP 1 — Texto do contrato ═══════════════════════ */}
      {step === 1 && (
        <div className="space-y-4">

          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
            <span className="text-xl flex-shrink-0">🔍</span>
            <div className="text-blue-800">
              <p className="font-semibold">Análise do Contrato Original</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Faça upload do PDF ou cole o texto. O sistema detecta automaticamente CNPJs, CPFs, valores monetários,
                CEPs e datas para facilitar a substituição.
              </p>
            </div>
          </div>

          {/* Upload zone */}
          <div>
            <label className="label">Upload do PDF</label>
            <label className={`flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              loading
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'border-blue-300 bg-blue-50 hover:border-blue-400 hover:bg-blue-100'}`}>
              {loading ? (
                <div className="text-center text-gray-400 text-sm">
                  <svg className="animate-spin w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Processando PDF...
                </div>
              ) : (
                <div className="text-center text-blue-600">
                  <svg className="w-7 h-7 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm font-medium">Clique para selecionar PDF</p>
                  <p className="text-xs text-blue-400 mt-0.5">
                    Funciona para PDFs digitais. Para PDFs escaneados (imagem), cole o texto manualmente abaixo.
                  </p>
                </div>
              )}
              <input
                type="file"
                accept=".pdf"
                className="sr-only"
                disabled={loading}
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f) }}
              />
            </label>
          </div>

          {/* Manual textarea */}
          <div>
            <label className="label">
              Texto do Contrato *
              <span className="text-gray-400 font-normal ml-1">(preenchido automaticamente pelo PDF, ou cole manualmente)</span>
            </label>
            <textarea
              className="input resize-none h-72 font-mono text-xs leading-relaxed"
              placeholder="O texto do contrato aparece aqui após o upload do PDF, ou cole diretamente...&#10;&#10;Exemplo:&#10;INSTRUMENTO PARTICULAR DE ALTERAÇÃO DO CONTRATO SOCIAL&#10;Da empresa EXEMPLO LTDA, inscrita no CNPJ sob o nº 12.345.678/0001-90..."
              value={textoOriginal}
              onChange={e => setTextoOriginal(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              {textoOriginal.length.toLocaleString('pt-BR')} caracteres
            </p>
          </div>

          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={handleAnalisar}
              disabled={!textoOriginal.trim() || loading}
            >
              Analisar e Identificar →
            </button>
          </div>
        </div>
      )}

      {/* ════════════════ STEP 2 — Identificar alterações ══════════════════════ */}
      {step === 2 && (
        <div className="space-y-4">

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {entidades.length} elemento(s) detectado(s)
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Preencha apenas os campos que serão alterados. Deixe em branco para manter o valor original.
              </p>
            </div>
            <span className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-1 rounded-lg">
              Amarelo = valor encontrado no contrato
            </span>
          </div>

          {entidades.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">
              <p className="text-sm font-medium">Nenhum elemento detectado automaticamente</p>
              <p className="text-xs mt-1">Avance para a próxima etapa e edite o texto diretamente na prévia.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(['cnpj', 'cpf', 'capital', 'data', 'cep'] as const).map(tipo => {
                const grupo = substituicoes.filter(s => s.tipo === tipo)
                if (!grupo.length) return null
                return (
                  <div key={tipo} className="card p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${TIPO_COR[tipo]}`}>
                        {grupo[0].label}
                      </span>
                      <span className="text-gray-400 font-normal">{grupo.length} encontrado(s)</span>
                    </h3>
                    <div className="space-y-3">
                      {grupo.map(sub => (
                        <div key={sub.id}>
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-blue-600 flex-shrink-0"
                              checked={sub.ativo}
                              onChange={e => setSub(sub.id, 'ativo', e.target.checked)}
                            />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="font-mono text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 px-2 py-1 rounded flex-shrink-0">
                                {sub.original}
                              </span>
                              <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                              <input
                                className={`input text-sm font-mono flex-1 ${!sub.ativo ? 'opacity-40' : ''}`}
                                placeholder="Novo valor (deixe vazio para manter)"
                                value={sub.novo}
                                disabled={!sub.ativo}
                                onChange={e => setSub(sub.id, 'novo', e.target.value)}
                              />
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 pl-6 truncate" title={sub.contexto}>
                            {sub.contexto}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep(1)}>← Voltar</button>
            <button className="btn-primary" onClick={() => setStep(3)}>
              Ver Prévia ({alteracoesAtivas.length} alteração(ões)) →
            </button>
          </div>
        </div>
      )}

      {/* ════════════════ STEP 3 — Prévia & Exportar ═══════════════════════════ */}
      {step === 3 && (
        <div className="space-y-4">

          {/* Summary badge */}
          {alteracoesAtivas.length > 0 ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm font-semibold text-green-800 mb-2">
                {alteracoesAtivas.length} substituição(ões) aplicada(s):
              </p>
              <div className="flex flex-wrap gap-2">
                {alteracoesAtivas.map(s => (
                  <div key={s.id} className="flex items-center gap-1 text-xs bg-white border border-green-200 rounded-lg px-2 py-1">
                    <span className="font-mono text-red-600 line-through">{s.original}</span>
                    <span className="text-gray-400 mx-0.5">→</span>
                    <span className="font-mono text-green-700 font-medium">{s.novo}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-sm text-gray-500">
                Nenhuma substituição definida. O documento será gerado com o texto original.
              </p>
            </div>
          )}

          {/* Diff toggle */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Prévia do documento</h3>
            <button
              className="text-xs text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
              onClick={() => setShowDiff(!showDiff)}
            >
              {showDiff ? 'Ocultar comparação' : 'Comparar original ↔ alterado'}
            </button>
          </div>

          {showDiff ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Original</p>
                <div className="border rounded-xl p-4 h-96 overflow-auto bg-red-50 border-red-200">
                  <pre className="text-xs whitespace-pre-wrap font-mono text-gray-700 leading-relaxed">
                    {textoOriginal}
                  </pre>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Alterado</p>
                <div className="border rounded-xl p-4 h-96 overflow-auto bg-green-50 border-green-200">
                  <pre className="text-xs whitespace-pre-wrap font-mono text-gray-700 leading-relaxed">
                    {textoFinal}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="border rounded-xl p-4 h-96 overflow-auto bg-gray-50">
              <pre className="text-xs whitespace-pre-wrap font-mono text-gray-700 leading-relaxed">
                {textoFinal}
              </pre>
            </div>
          )}

          {/* Editar texto diretamente */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 font-medium select-none">
              Editar texto manualmente antes de exportar
            </summary>
            <div className="mt-2">
              <textarea
                className="input resize-none h-64 font-mono text-xs leading-relaxed"
                value={textoFinal}
                onChange={e => {
                  // Apply direct edit by resetting the original to the manually edited version
                  setTextoOriginal(e.target.value)
                  setSubstituicoes([])
                }}
              />
              <p className="text-xs text-yellow-600 mt-1">
                Ao editar manualmente, as substituições automáticas são removidas. Use com cautela.
              </p>
            </div>
          </details>

          {/* Export buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <button className="btn-secondary" onClick={() => setStep(2)}>← Ajustar Substituições</button>
            <div className="flex gap-2">
              <button
                className="btn-secondary flex items-center gap-2"
                onClick={handleGerarPdf}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir / PDF
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                disabled={loading}
                onClick={handleGerarDocx}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Gerando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Gerar Word (.docx)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
