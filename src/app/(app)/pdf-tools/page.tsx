'use client'

import { useState, useCallback, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import {
  FilePlus2, Scissors, Minimize2, ImagePlus, FileImage,
  Lock, Upload, X, Download, Loader2, FileText, CheckCircle2, FileType2
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Definição das ferramentas ─────────────────────────────────────────────────

const TOOLS = [
  {
    id: 'merge', title: 'JUNTAR PDF',
    description: 'Combine múltiplos arquivos PDF em um único documento unificado.',
    icon: FilePlus2, color: 'text-red-500', bg: 'bg-red-50',
    accept: '.pdf', multiple: true,
  },
  {
    id: 'split', title: 'DIVIDIR PDF',
    description: 'Extraia páginas ou intervalos específicos de um PDF.',
    icon: Scissors, color: 'text-orange-500', bg: 'bg-orange-50',
    accept: '.pdf', multiple: false,
  },
  {
    id: 'compress', title: 'COMPRIMIR PDF',
    description: 'Reduza o tamanho do arquivo PDF removendo dados desnecessários.',
    icon: Minimize2, color: 'text-yellow-600', bg: 'bg-yellow-50',
    accept: '.pdf', multiple: false,
  },
  {
    id: 'image-to-pdf', title: 'IMAGEM PARA PDF',
    description: 'Converta JPG/PNG em documentos PDF profissionais.',
    icon: ImagePlus, color: 'text-green-600', bg: 'bg-green-50',
    accept: '.jpg,.jpeg,.png', multiple: true,
  },
  {
    id: 'pdf-to-jpg', title: 'PDF PARA JPG',
    description: 'Extraia cada página do PDF como imagem JPG de alta qualidade.',
    icon: FileImage, color: 'text-blue-600', bg: 'bg-blue-50',
    accept: '.pdf', multiple: false,
  },
  {
    id: 'protect', title: 'PROTEGER PDF',
    description: 'Adicione senha ao seu PDF para restringir o acesso não autorizado.',
    icon: Lock, color: 'text-purple-600', bg: 'bg-purple-50',
    accept: '.pdf', multiple: false,
  },
  {
    id: 'pdf-to-word', title: 'PDF PARA WORD',
    description: 'Extraia o texto do PDF e gere um documento Word (.docx) editável.',
    icon: FileType2, color: 'text-indigo-600', bg: 'bg-indigo-50',
    accept: '.pdf', multiple: false,
  },
] as const

type ToolId = typeof TOOLS[number]['id']

// ── Funções de processamento ──────────────────────────────────────────────────

async function mergePDFs(files: File[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create()
  for (const file of files) {
    const doc = await PDFDocument.load(await file.arrayBuffer())
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }
  return merged.save()
}

async function splitPDF(file: File, ranges: string): Promise<{ name: string; data: Uint8Array }[]> {
  const src = await PDFDocument.load(await file.arrayBuffer())
  const total = src.getPageCount()
  const results: { name: string; data: Uint8Array }[] = []

  const groups: number[][] = []
  ranges.split(',').forEach(part => {
    const pages: number[] = []
    part = part.trim()
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(n => parseInt(n.trim()) - 1)
      for (let i = a; i <= Math.min(b, total - 1); i++) pages.push(i)
    } else {
      const n = parseInt(part.trim()) - 1
      if (n >= 0 && n < total) pages.push(n)
    }
    if (pages.length) groups.push(pages)
  })

  if (!groups.length) throw new Error('Intervalo de páginas inválido')

  for (let g = 0; g < groups.length; g++) {
    const out = await PDFDocument.create()
    const copied = await out.copyPages(src, groups[g])
    copied.forEach(p => out.addPage(p))
    results.push({ name: `split_parte${g + 1}.pdf`, data: await out.save() })
  }
  return results
}

async function compressPDF(file: File): Promise<{ data: Uint8Array; before: number; after: number }> {
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  doc.setTitle(''); doc.setAuthor(''); doc.setSubject('')
  doc.setKeywords([]); doc.setProducer(''); doc.setCreator('')
  const data = await doc.save({ objectsPerTick: 50, useObjectStreams: true })
  return { data, before: bytes.byteLength, after: data.byteLength }
}

async function imagesToPDF(files: File[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const file of files) {
    const bytes = await file.arrayBuffer()
    const img = file.type === 'image/png'
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes)
    const page = doc.addPage([img.width, img.height])
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
  }
  return doc.save()
}

async function pdfToJPGs(file: File): Promise<{ name: string; data: Blob }[]> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`

  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const results: { name: string; data: Blob }[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
    const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92))
    results.push({ name: `pagina_${i}.jpg`, data: blob })
  }
  return results
}

async function pdfToWord(file: File): Promise<Blob> {
  // 1. Extrair texto com pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`

  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const pageTexts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let lastY: number | null = null
    let pageText = ''
    for (const item of content.items as any[]) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) pageText += '\n'
      pageText += item.str
      lastY = item.transform[5]
    }
    pageTexts.push(pageText)
  }

  // 2. Criar .docx com o texto extraído
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')

  const children: InstanceType<typeof Paragraph>[] = []
  pageTexts.forEach((text, i) => {
    children.push(new Paragraph({
      text: `Página ${i + 1}`,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: i > 0 ? 400 : 0, after: 200 },
    }))
    text.split('\n').forEach(line => {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.trim(), size: 24 })],
        spacing: { after: 80 },
      }))
    })
  })

  const doc = new Document({
    sections: [{ children }],
  })

  return Packer.toBlob(doc)
}

function downloadBlob(data: Uint8Array | Blob, filename: string) {
  const isWord = filename.endsWith('.docx')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = data instanceof Uint8Array ? new Blob([data as any], { type: isWord ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf' }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function PDFToolsPage() {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<{ name: string; data: Uint8Array | Blob }[]>([])
  const [pageRange, setPageRange] = useState('1')
  const [password, setPassword] = useState('')
  const [totalPages, setTotalPages] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const tool = TOOLS.find(t => t.id === activeTool)

  function reset() {
    setFiles([]); setResults([]); setPageRange('1')
    setPassword(''); setTotalPages(null)
  }

  const addFiles = useCallback((incoming: File[]) => {
    setResults([])
    setFiles(prev => tool?.multiple ? [...prev, ...incoming] : [incoming[0]])
    // Read page count for PDFs
    if (activeTool === 'split' && incoming[0]) {
      incoming[0].arrayBuffer().then(async buf => {
        const doc = await PDFDocument.load(buf)
        setTotalPages(doc.getPageCount())
      }).catch(() => {})
    }
  }, [tool, activeTool])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  async function handleProcess() {
    if (!files.length || !activeTool) return
    setProcessing(true); setResults([])
    try {
      if (activeTool === 'merge') {
        if (files.length < 2) throw new Error('Selecione pelo menos 2 arquivos PDF')
        const data = await mergePDFs(files)
        setResults([{ name: 'unificado.pdf', data }])

      } else if (activeTool === 'split') {
        const parts = await splitPDF(files[0], pageRange || '1')
        setResults(parts)

      } else if (activeTool === 'compress') {
        const { data, before, after } = await compressPDF(files[0])
        const pct = Math.max(0, Math.round((1 - after / before) * 100))
        toast.success(`Reduzido em ~${pct}% (${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB)`)
        setResults([{ name: `comprimido_${files[0].name}`, data }])

      } else if (activeTool === 'image-to-pdf') {
        const data = await imagesToPDF(files)
        setResults([{ name: 'imagens.pdf', data }])

      } else if (activeTool === 'pdf-to-jpg') {
        toast.loading('Renderizando páginas...', { id: 'render' })
        const imgs = await pdfToJPGs(files[0])
        toast.dismiss('render')
        setResults(imgs)

      } else if (activeTool === 'protect') {
        toast('Proteção com senha requer servidor. Em breve!', { icon: '🔒' })
        setProcessing(false); return

      } else if (activeTool === 'pdf-to-word') {
        toast.loading('Extraindo texto...', { id: 'word' })
        const blob = await pdfToWord(files[0])
        toast.dismiss('word')
        const name = files[0].name.replace(/\.pdf$/i, '.docx')
        setResults([{ name, data: blob }])
      }

      toast.success('Processamento concluído!')
    } catch (err: any) {
      toast.error(err.message || 'Erro no processamento')
    } finally {
      setProcessing(false)
    }
  }

  const done = results.length > 0

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen font-sans text-slate-900">

      {/* ── Header ── */}
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase">
          PARALEGAL PRO <span className="text-yellow-500">| PDF EXPERT</span>
        </h1>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          Processamento 100% local · Sem envio de dados · Segurança total
        </p>
      </header>

      {/* ── Grid de ferramentas ── */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 ${activeTool ? 'mb-8' : ''}`}>
        {TOOLS.map(t => {
          const Icon = t.icon
          const isActive = activeTool === t.id
          return (
            <button
              key={t.id}
              onClick={() => { setActiveTool(t.id); reset() }}
              className={`group relative bg-white rounded-2xl border-2 p-4 md:p-6 text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] ${
                isActive
                  ? 'border-yellow-400 shadow-lg shadow-yellow-100 scale-[1.02]'
                  : 'border-slate-200 hover:border-yellow-400'
              }`}
            >
              {isActive && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full" />
              )}
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${t.bg} flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-5 h-5 md:w-6 md:h-6 ${t.color}`} />
              </div>
              <h3 className="font-black text-xs md:text-sm text-slate-900 uppercase tracking-wide mb-1 md:mb-2">{t.title}</h3>
              <p className="text-[10px] md:text-xs text-slate-500 leading-relaxed hidden sm:block">{t.description}</p>
            </button>
          )
        })}
      </div>

      {/* ── Painel ativo ── */}
      {activeTool && tool && (
        <div className="max-w-xl mx-auto">

          {/* Header da ferramenta */}
          <div className="bg-black text-white rounded-2xl p-4 md:p-5 mb-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${tool.bg} flex items-center justify-center flex-shrink-0`}>
              <tool.icon className={`w-5 h-5 ${tool.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-black uppercase text-yellow-400">{tool.title}</h2>
              <p className="text-[11px] text-slate-400 truncate">{tool.description}</p>
            </div>
            <button onClick={() => { setActiveTool(null); reset() }} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Upload + opções */}
          {!done && (
            <>
              {/* Drag & Drop */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 md:p-10 text-center cursor-pointer transition-all ${
                  isDragging ? 'border-yellow-400 bg-yellow-50' : 'border-slate-300 hover:border-yellow-400 hover:bg-yellow-50/30 bg-white'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={tool.accept}
                  multiple={tool.multiple}
                  className="hidden"
                  onChange={e => addFiles(Array.from(e.target.files || []))}
                />
                <Upload className={`w-10 h-10 mx-auto mb-3 transition-colors ${isDragging ? 'text-yellow-500' : 'text-slate-400'}`} />
                <p className="font-black text-slate-700 uppercase text-sm tracking-wide">
                  {isDragging ? 'Solte aqui!' : 'Arraste ou clique para selecionar'}
                </p>
                <p className="text-xs text-slate-400 mt-1.5">
                  {tool.accept === '.pdf' ? 'Somente arquivos PDF' : 'Formatos: JPG, PNG'}
                  {tool.multiple ? ' · múltiplos permitidos' : ''}
                </p>
              </div>

              {/* Lista de arquivos */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 group">
                      <FileText className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium text-slate-700 truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                      <button
                        onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Opções: Split */}
              {files.length > 0 && activeTool === 'split' && (
                <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Páginas a extrair {totalPages ? `(total: ${totalPages})` : ''}
                  </label>
                  <input
                    type="text"
                    value={pageRange}
                    onChange={e => setPageRange(e.target.value)}
                    placeholder="Ex: 1-3, 5, 7-9"
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-yellow-400 rounded-xl px-4 py-2.5 text-sm outline-none font-mono transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5">Separe com vírgulas · Use hífen para intervalos</p>
                </div>
              )}

              {/* Opções: Protect */}
              {files.length > 0 && activeTool === 'protect' && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">Recurso em desenvolvimento</p>
                      <p className="text-xs text-amber-600 mt-0.5">A proteção por senha requer processamento server-side. Será disponibilizado em breve.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botão processar */}
              {files.length > 0 && activeTool !== 'protect' && (
                <button
                  onClick={handleProcess}
                  disabled={processing}
                  className="mt-5 w-full bg-black text-yellow-400 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-lg"
                >
                  {processing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</>
                  ) : (
                    <><tool.icon className="w-5 h-5" /> {tool.title}</>
                  )}
                </button>
              )}
            </>
          )}

          {/* Resultado */}
          {done && (
            <div className="bg-white border-2 border-yellow-400 rounded-2xl p-6 shadow-lg">
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                  <CheckCircle2 className="w-7 h-7 text-black" />
                </div>
                <h3 className="font-black text-lg uppercase text-slate-900">Concluído!</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {results.length === 1 ? '1 arquivo gerado' : `${results.length} arquivos gerados`}
                </p>
              </div>

              <div className="space-y-2 mb-5">
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => downloadBlob(r.data, r.name)}
                    className="w-full flex items-center gap-3 bg-slate-50 hover:bg-yellow-50 border border-slate-200 hover:border-yellow-400 rounded-xl px-4 py-3 transition-all group"
                  >
                    <Download className="w-4 h-4 text-yellow-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="flex-1 text-sm font-bold text-slate-700 text-left truncate">{r.name}</span>
                    <span className="text-[10px] font-black text-yellow-600 uppercase flex-shrink-0">Baixar</span>
                  </button>
                ))}
              </div>

              <button
                onClick={reset}
                className="w-full py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:border-yellow-400 hover:text-yellow-600 transition-all"
              >
                Processar outro arquivo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
