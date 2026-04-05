'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ContractTemplate, Empresa, Clausula } from '@/types'
import { formatCNPJ } from '@/lib/utils'
import { dataExtenso, dataExtensoCompleto, capitalExtenso, formatarReais, aplicarGenero, calcularCapitalSocial, formatarObjetoSocial } from '@/lib/formatters'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Socio {
  nome: string; genero: 'masculino' | 'feminino'; nacionalidade: string
  naturalidade: string; estado_civil: string; regime_bens: string
  profissao: string; cpf: string; rg: string; orgao_expedidor: string
  logradouro: string; numero: string; complemento: string
  bairro: string; cidade: string; uf: string; cep: string
  percentual_quotas: string
}

type EventKey = 'socios' | 'endereco' | 'capital' | 'objeto' | 'clausulas'

interface EmpresaDados {
  nire: string; sessao_junta: string; logradouro: string; numero: string
  complemento: string; bairro: string; cidade: string; uf: string; cep: string
  capital_social: string; valor_quota: string; data_inicio_atividades: string
}

interface Props {
  template: ContractTemplate
  empresas: Empresa[]
  defaultEmpresaId?: string
  onSuccess: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_SOCIO: Socio = {
  nome: '', genero: 'masculino', nacionalidade: 'brasileiro(a)', naturalidade: '',
  estado_civil: 'solteiro', regime_bens: '', profissao: '', cpf: '', rg: '',
  orgao_expedidor: '', logradouro: '', numero: '', complemento: '',
  bairro: '', cidade: '', uf: '', cep: '', percentual_quotas: '',
}

const ESTADOS_CIVIS = ['solteiro', 'casado', 'divorciado', 'viúvo', 'união estável']
const REGIMES = ['comunhão parcial de bens', 'comunhão universal de bens', 'separação total de bens', 'participação final nos aquestos']

const EVENTOS: { key: EventKey; label: string; desc: string }[] = [
  { key: 'socios',   label: 'Sócios',              desc: 'Qualificação completa dos sócios' },
  { key: 'endereco', label: 'Novo Endereço',        desc: 'Alteração da sede da empresa' },
  { key: 'capital',  label: 'Capital Social',       desc: 'Aumento ou redução do capital' },
  { key: 'objeto',   label: 'Objeto Social',        desc: 'Alteração das atividades da empresa' },
  { key: 'clausulas',label: 'Cláusulas Adicionais', desc: 'Incluir cláusulas especiais' },
]

// ─── Wizard Principal ─────────────────────────────────────────────────────────

export default function ContratoWizard({ template, empresas, defaultEmpresaId = '', onSuccess }: Props) {
  const [supabase] = useState(createClient)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)

  // Step 1
  const [empresaId, setEmpresaId] = useState(defaultEmpresaId)
  const [empresaObj, setEmpresaObj] = useState<Empresa | null>(null)
  const [empresaDados, setEmpresaDados] = useState<EmpresaDados>({
    nire: '', sessao_junta: '', logradouro: '', numero: '',
    complemento: '', bairro: '', cidade: '', uf: '', cep: '',
    capital_social: '', valor_quota: '1,00', data_inicio_atividades: '',
  })

  // Confirmação final (Step 3 — rodapé)
  const [dataContrato, setDataContrato] = useState(new Date().toISOString().split('T')[0])
  const [cidadeAssinatura, setCidadeAssinatura] = useState('São Paulo')
  const [cidadeForo, setCidadeForo] = useState('')

  // Step 3 — CNAEs / Objeto Social
  const [cnaes, setCnaes] = useState<string[]>([''])
  const objetoFormatado = formatarObjetoSocial(cnaes)

  // Step 2
  const [events, setEvents] = useState<Set<EventKey>>(new Set(['socios']))

  // Step 3 — Sócios
  const [socios, setSocios] = useState<Socio[]>([{ ...EMPTY_SOCIO }])

  // Step 3 — Endereço
  const [novoEnd, setNovoEnd] = useState({ logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '' })

  // Step 3 — Capital
  const [capAtual, setCapAtual] = useState('')
  const [capNovo, setCapNovo] = useState('')

  // Step 3 — Objeto
  const [objeto, setObjeto] = useState('')

  // Step 3 — Cláusulas
  const [clausulas, setClausulas] = useState<Clausula[]>([])
  const [clausulasSel, setClausulasSel] = useState<string[]>([])

  // Carregar empresa ao selecionar
  useEffect(() => {
    if (!empresaId) return
    supabase.from('empresas').select('*').eq('id', empresaId).single().then(({ data }) => {
      if (!data) return
      setEmpresaObj(data as Empresa)
      setEmpresaDados({
        nire:                  (data as any).nire ?? '',
        sessao_junta:          (data as any).sessao_junta ?? '',
        logradouro:            data.logradouro ?? '',
        numero:                data.numero ?? '',
        complemento:           data.complemento ?? '',
        bairro:                data.bairro ?? '',
        cidade:                data.cidade ?? '',
        uf:                    data.uf ?? '',
        cep:                   data.cep ?? '',
        capital_social:        (data as any).capital_social ?? '',
        data_inicio_atividades:(data as any).data_inicio_atividades ?? '',
      })
    })
  }, [empresaId])

  // Carregar cláusulas
  useEffect(() => {
    supabase.from('clausulas').select('*').eq('ativo', true).order('tipo').order('titulo')
      .then(({ data }) => setClausulas((data ?? []) as Clausula[]))
  }, [])

  function toggleEvent(key: EventKey) {
    setEvents(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  function setSocioField(i: number, field: keyof Socio, v: string) {
    setSocios(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: v } : s))
  }

  // ─── Montagem dos dados para o template ───────────────────────────────────

  function buildData(): Record<string, any> {
    if (!empresaObj) return {}

    // Data do contrato para formatters
    const dtContrato = dataContrato ? new Date(dataContrato + 'T12:00:00') : new Date()

    const data: Record<string, any> = {
      // Empresa
      razao_social:        empresaObj.razao_social,
      nome_fantasia:       empresaObj.nome_fantasia ?? '',
      cnpj:                formatCNPJ(empresaObj.cnpj),
      inscricao_estadual:  empresaObj.inscricao_estadual ?? '',
      inscricao_municipal: empresaObj.inscricao_municipal ?? '',
      nire:                empresaDados.nire,
      sessao_junta:        empresaDados.sessao_junta,
      data_inicio_atividades: empresaDados.data_inicio_atividades,

      // Endereço da sede — prefixo {{sede_*}}
      sede_logradouro:  empresaDados.logradouro,
      sede_numero:      empresaDados.numero,
      sede_complemento: empresaDados.complemento,
      sede_bairro:      empresaDados.bairro,
      sede_cidade:      empresaDados.cidade,
      sede_uf:          empresaDados.uf,
      sede_cep:         empresaDados.cep,

      // Retrocompatibilidade com templates antigos ({{logradouro}} etc.)
      logradouro:  empresaDados.logradouro,
      numero:      empresaDados.numero,
      complemento: empresaDados.complemento,
      bairro:      empresaDados.bairro,
      cidade:      empresaDados.cidade,
      uf:          empresaDados.uf,
      cep:         empresaDados.cep,

      // ── Formatters automáticos ──────────────────────────────────────────
      // Data do contrato
      data_contrato:        dtContrato.toLocaleDateString('pt-BR'),
      data_extenso:         dataExtenso(dtContrato),
      cidade_assinatura:    cidadeAssinatura || empresaDados.cidade || 'São Paulo',
      data_extenso_completo:dataExtensoCompleto(dtContrato, cidadeAssinatura || empresaDados.cidade || 'São Paulo'),

      // ── Motor de Capital Social ─────────────────────────────────────────
      capital_social:           empresaDados.capital_social,
      capital_social_formatado: formatarReais(empresaDados.capital_social),
      capital_social_extenso:   capitalExtenso(empresaDados.capital_social),
      ...(() => {
        const c = calcularCapitalSocial(empresaDados.capital_social, empresaDados.valor_quota)
        return {
          capital_quotas:         c.quantidade_str,
          capital_quotas_extenso: c.quantidade_extenso,
          valor_quota:            empresaDados.valor_quota,
          valor_quota_formatado:  c.valor_quota_str,
          valor_quota_extenso:    c.valor_quota_extenso,
        }
      })(),

      // Capital novo (se alteração)
      capital_social_novo:           capNovo,
      capital_social_novo_formatado: formatarReais(capNovo),
      capital_social_novo_extenso:   capitalExtenso(capNovo),

      // ── Objeto Social (CNAEs) ───────────────────────────────────────────
      objeto_social: objetoFormatado || objeto,

      // ── Foro / comarca ──────────────────────────────────────────────────
      cidade_foro: cidadeForo || empresaDados.cidade || '',

      // ── Flags condicionais ──────────────────────────────────────────────
      has_socios:   events.has('socios'),
      has_endereco: events.has('endereco'),
      has_capital:  events.has('capital'),
      has_objeto:   events.has('objeto'),
      has_clausulas:events.has('clausulas'),

      // Novo endereço
      novo_logradouro:  novoEnd.logradouro,
      novo_numero:      novoEnd.numero,
      novo_complemento: novoEnd.complemento,
      novo_bairro:      novoEnd.bairro,
      novo_cidade:      novoEnd.cidade,
      novo_uf:          novoEnd.uf,
      novo_cep:         novoEnd.cep,

      // Objeto
      objeto_social: objeto,

      // Cláusulas adicionais
      clausulas_adicionais: clausulasSel
        .map(id => clausulas.find(c => c.id === id))
        .filter(Boolean)
        .map(c => `${c!.titulo}\n\n${c!.conteudo}`)
        .join('\n\n'),

      total_socios: socios.length.toString(),
      socio_unico:  socios.length === 1 ? 'sim' : 'não',

      // ── Gênero societário (Sócio 1 como referência) ─────────────────────
      ...(() => {
        const g = socios[0]?.genero ?? 'masculino'
        return {
          socio_unico_artigo:       g === 'feminino' ? 'única sócia'          : 'único sócio',
          socio_unico_artigo_cap:   g === 'feminino' ? 'Única Sócia'          : 'Único Sócio',
          socio_administrador:      g === 'feminino' ? 'sócia administradora' : 'sócio administrador',
          socio_administrador_cap:  g === 'feminino' ? 'Sócia Administradora' : 'Sócio Administrador',
          o_socio:                  g === 'feminino' ? 'a sócia'              : 'o sócio',
          O_socio:                  g === 'feminino' ? 'A sócia'              : 'O sócio',
        }
      })(),
    }

    // Sócios — array para {{#socios}} loop
    const sociosArr = socios.map(s => {
      const g = s.genero
      const precisaRegime = ['casado', 'união estável'].includes(s.estado_civil)

      const estadoCivil   = aplicarGenero(s.estado_civil, g)
      const nacionalidade = aplicarGenero(s.nacionalidade, g)
      const profissao     = aplicarGenero(s.profissao, g)
      const portador      = g === 'feminino' ? 'portadora' : 'portador'
      const residente     = g === 'feminino' ? 'residente e domiciliada' : 'residente e domiciliado'
      const artigo        = g === 'feminino' ? 'a sócia' : 'o sócio'

      const ecCompleto = precisaRegime && s.regime_bens
        ? `${estadoCivil} sob o regime de ${s.regime_bens}`
        : estadoCivil

      return {
        nome: s.nome, genero: g,
        artigo,
        nacionalidade,
        naturalidade:  s.naturalidade,
        estado_civil:  estadoCivil,
        estado_civil_completo: ecCompleto,
        regime_bens:   precisaRegime ? s.regime_bens : '',
        profissao,
        portador,
        residente,
        cpf:           s.cpf,
        rg:            s.rg,
        orgao_expedidor: s.orgao_expedidor,
        logradouro:    s.logradouro,
        numero:        s.numero,
        complemento:   s.complemento,
        bairro:        s.bairro,
        cidade:        s.cidade,
        uf:            s.uf,
        cep:           s.cep,
        percentual_quotas: s.percentual_quotas,
      }
    })

    data['socios'] = sociosArr

    // Retrocompatibilidade: {{socio_1_nome}}, {{socio_2_cpf}}, etc.
    sociosArr.forEach((s, i) => {
      Object.entries(s).forEach(([k, v]) => { data[`socio_${i + 1}_${k}`] = v })
    })

    return data
  }

  // ─── Geração do documento ─────────────────────────────────────────────────

  async function handleGerar(asPdf = false) {
    if (!empresaId || !empresaObj) { toast.error('Selecione uma empresa'); return }
    if (events.has('socios') && socios.some(s => !s.nome)) { toast.error('Preencha o nome de todos os sócios'); return }

    setLoading(true)
    try {
      const resp = await fetch(template.arquivo_url)
      if (!resp.ok) throw new Error('Erro ao baixar template')
      const arrayBuffer = await resp.arrayBuffer()

      const PizZip      = (await import('pizzip')).default
      const Docxtemplater = (await import('docxtemplater')).default
      const { saveAs }  = await import('file-saver')

      // Pré-processar XML para corrigir marcadores divididos pelo Word
      const zip = new PizZip(arrayBuffer)
      const xmlFiles = ['word/document.xml','word/header1.xml','word/footer1.xml',
                        'word/header2.xml','word/footer2.xml','word/header3.xml','word/footer3.xml']
      for (const fn of xmlFiles) {
        const f = zip.file(fn); if (!f) continue
        let xml = f.asText()
        xml = xml.replace(/<w:proofErr[^>]*\/>/g, '')
        let prev: string
        do { prev = xml; xml = xml.replace(/<\/w:t><\/w:r><w:r><w:t(?:\s+xml:space="preserve")?>/g, '') } while (xml !== prev)
        zip.file(fn, xml)
      }

      // Renderizar com docxtemplater (suporte a {{#cond}}, {{#loop}})
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{{', end: '}}' },
        nullGetter: () => '',
      })

      doc.render(buildData())

      const nomeArq = `${empresaObj.razao_social}_${template.nome}_${new Date().toISOString().split('T')[0]}`
        .replace(/[^a-zA-Z0-9_\-]/g, '_')

      if (asPdf) {
        // Converter para HTML e abrir para impressão/PDF
        const docxBuf = doc.getZip().generate({ type: 'arraybuffer' })
        const mammoth = await import('mammoth')
        const { value: html } = await (mammoth as any).convertToHtml({ arrayBuffer: docxBuf })
        const win = window.open('', '_blank')
        if (win) {
          win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
            <title>${nomeArq}</title>
            <style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.6;max-width:800px}
            @media print{.no-print{display:none}}</style></head>
            <body><p class="no-print"><button onclick="window.print()" style="padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">
            Imprimir / Salvar como PDF</button></p>${html}</body></html>`)
          win.document.close()
        }
      } else {
        const blob = doc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
        saveAs(blob, `${nomeArq}.docx`)
      }

      // Salvar no histórico
      await supabase.from('contratos').insert({
        empresa_id: empresaId,
        template_nome: template.nome,
        dados_json: buildData(),
        arquivo_nome: `${nomeArq}.docx`,
      })

      toast.success(asPdf ? 'PDF aberto para impressão!' : 'Contrato gerado!')
      onSuccess()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro: ' + (err.message ?? 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Indicador de passos */}
      <div className="flex items-center gap-0">
        {(['1', '2', '3'] as const).map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              Number(s) === step ? 'bg-blue-600 text-white' :
              Number(s) < step  ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
              {Number(s) < step ? '✓' : s}
            </div>
            <span className={`ml-2 text-xs font-medium ${Number(s) === step ? 'text-gray-900' : 'text-gray-400'}`}>
              {s === '1' ? 'Empresa' : s === '2' ? 'Eventos' : 'Dados'}
            </span>
            {i < 2 && <div className="flex-1 h-px bg-gray-200 mx-3" />}
          </div>
        ))}
      </div>

      {/* ── PASSO 1: Empresa ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label">Empresa *</label>
            <select className="input" value={empresaId} onChange={e => setEmpresaId(e.target.value)}>
              <option value="">Selecione...</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
            </select>
          </div>

          {empresaObj && (
            <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <h3 className="text-sm font-semibold text-gray-700">Dados da Empresa</h3>
                <span className="text-xs text-gray-400">(editáveis para este contrato)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Razão Social</label>
                  <input className="input bg-white text-sm" readOnly value={empresaObj.razao_social} />
                </div>
                <div>
                  <label className="label text-xs">CNPJ</label>
                  <input className="input bg-white font-mono text-sm" readOnly value={formatCNPJ(empresaObj.cnpj)} />
                </div>
                <div>
                  <label className="label text-xs">NIRE</label>
                  <input className="input bg-white text-sm" value={empresaDados.nire}
                    onChange={e => setEmpresaDados(p => ({ ...p, nire: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Sessão da Junta</label>
                  <input className="input bg-white text-sm" placeholder="Ex: 10/03/2021" value={empresaDados.sessao_junta}
                    onChange={e => setEmpresaDados(p => ({ ...p, sessao_junta: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">Logradouro</label>
                  <input className="input bg-white text-sm" value={empresaDados.logradouro}
                    onChange={e => setEmpresaDados(p => ({ ...p, logradouro: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Número</label>
                  <input className="input bg-white text-sm" value={empresaDados.numero}
                    onChange={e => setEmpresaDados(p => ({ ...p, numero: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Complemento</label>
                  <input className="input bg-white text-sm" value={empresaDados.complemento}
                    onChange={e => setEmpresaDados(p => ({ ...p, complemento: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Bairro</label>
                  <input className="input bg-white text-sm" value={empresaDados.bairro}
                    onChange={e => setEmpresaDados(p => ({ ...p, bairro: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Cidade</label>
                  <input className="input bg-white text-sm" value={empresaDados.cidade}
                    onChange={e => setEmpresaDados(p => ({ ...p, cidade: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">UF</label>
                  <input className="input bg-white text-sm" value={empresaDados.uf}
                    onChange={e => setEmpresaDados(p => ({ ...p, uf: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">CEP</label>
                  <input className="input bg-white text-sm font-mono" value={empresaDados.cep}
                    onChange={e => setEmpresaDados(p => ({ ...p, cep: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Capital Social (R$)</label>
                  <input className="input bg-white text-sm" placeholder="Ex: 10.000,00" value={empresaDados.capital_social}
                    onChange={e => setEmpresaDados(p => ({ ...p, capital_social: e.target.value }))} />
                  {empresaDados.capital_social && (
                    <p className="text-xs text-gray-400 mt-0.5">{capitalExtenso(empresaDados.capital_social)}</p>
                  )}
                </div>
                <div>
                  <label className="label text-xs">Valor por Quota (R$)</label>
                  <input className="input bg-white text-sm" placeholder="Ex: 1,00" value={empresaDados.valor_quota}
                    onChange={e => setEmpresaDados(p => ({ ...p, valor_quota: e.target.value }))} />
                  {empresaDados.capital_social && empresaDados.valor_quota && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      = {calcularCapitalSocial(empresaDados.capital_social, empresaDados.valor_quota).quantidade_extenso}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label text-xs">Início das Atividades</label>
                  <input type="date" className="input bg-white text-sm" value={empresaDados.data_inicio_atividades}
                    onChange={e => setEmpresaDados(p => ({ ...p, data_inicio_atividades: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button className="btn-primary" disabled={!empresaId} onClick={() => setStep(2)}>
              Próximo →
            </button>
          </div>
        </div>
      )}

      {/* ── PASSO 2: Eventos ── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Selecione o que este documento abordará:</p>

          <div className="grid grid-cols-1 gap-2">
            {EVENTOS.map(ev => (
              <label key={ev.key}
                className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                  events.has(ev.key) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <input type="checkbox" className="w-4 h-4 accent-blue-600"
                  checked={events.has(ev.key)}
                  onChange={() => toggleEvent(ev.key)} />
                <div>
                  <p className={`text-sm font-medium ${events.has(ev.key) ? 'text-blue-700' : 'text-gray-800'}`}>{ev.label}</p>
                  <p className="text-xs text-gray-500">{ev.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep(1)}>← Voltar</button>
            <button className="btn-primary" disabled={events.size === 0} onClick={() => setStep(3)}>
              Próximo →
            </button>
          </div>
        </div>
      )}

      {/* ── PASSO 3: Dados ── */}
      {step === 3 && (
        <div className="space-y-5">

          {/* Sócios */}
          {events.has('socios') && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">1</span>
                  Sócios
                </h3>
                <button type="button" onClick={() => setSocios(p => [...p, { ...EMPTY_SOCIO }])}
                  className="btn-secondary text-xs py-1.5 px-3">+ Adicionar Sócio</button>
              </div>

              <div className="space-y-4">
                {socios.map((s, i) => (
                  <div key={i} className="border rounded-xl p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-700">Sócio {i + 1}</h4>
                      {socios.length > 1 && (
                        <button onClick={() => setSocios(p => p.filter((_, idx) => idx !== i))}
                          className="text-xs text-red-500 hover:text-red-700">Remover</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="label text-xs">Nome completo *</label>
                        <input className="input bg-white text-sm" value={s.nome}
                          onChange={e => setSocioField(i, 'nome', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Gênero</label>
                        <select className="input bg-white text-sm" value={s.genero}
                          onChange={e => setSocioField(i, 'genero', e.target.value as any)}>
                          <option value="masculino">Masculino</option>
                          <option value="feminino">Feminino</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">Nacionalidade</label>
                        <input className="input bg-white text-sm" value={s.nacionalidade}
                          onChange={e => setSocioField(i, 'nacionalidade', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Naturalidade (Cidade/UF)</label>
                        <input className="input bg-white text-sm" placeholder="Ex: São Paulo/SP" value={s.naturalidade}
                          onChange={e => setSocioField(i, 'naturalidade', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Estado Civil</label>
                        <select className="input bg-white text-sm" value={s.estado_civil}
                          onChange={e => setSocioField(i, 'estado_civil', e.target.value)}>
                          {ESTADOS_CIVIS.map(ec => <option key={ec} value={ec}>{ec}</option>)}
                        </select>
                      </div>
                      {['casado', 'união estável'].includes(s.estado_civil) && (
                        <div>
                          <label className="label text-xs">Regime de Bens</label>
                          <select className="input bg-white text-sm" value={s.regime_bens}
                            onChange={e => setSocioField(i, 'regime_bens', e.target.value)}>
                            <option value="">Selecione...</option>
                            {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="label text-xs">Profissão</label>
                        <input className="input bg-white text-sm" value={s.profissao}
                          onChange={e => setSocioField(i, 'profissao', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">CPF</label>
                        <input className="input bg-white text-sm font-mono" value={s.cpf}
                          onChange={e => setSocioField(i, 'cpf', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">RG</label>
                        <input className="input bg-white text-sm font-mono" value={s.rg}
                          onChange={e => setSocioField(i, 'rg', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Órgão Expedidor</label>
                        <input className="input bg-white text-sm" placeholder="SSP/SP" value={s.orgao_expedidor}
                          onChange={e => setSocioField(i, 'orgao_expedidor', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">% de Quotas</label>
                        <input className="input bg-white text-sm" placeholder="100%" value={s.percentual_quotas}
                          onChange={e => setSocioField(i, 'percentual_quotas', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="label text-xs">Logradouro</label>
                        <input className="input bg-white text-sm" value={s.logradouro}
                          onChange={e => setSocioField(i, 'logradouro', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Número</label>
                        <input className="input bg-white text-sm" value={s.numero}
                          onChange={e => setSocioField(i, 'numero', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Complemento</label>
                        <input className="input bg-white text-sm" value={s.complemento}
                          onChange={e => setSocioField(i, 'complemento', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Bairro</label>
                        <input className="input bg-white text-sm" value={s.bairro}
                          onChange={e => setSocioField(i, 'bairro', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Cidade</label>
                        <input className="input bg-white text-sm" value={s.cidade}
                          onChange={e => setSocioField(i, 'cidade', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">UF</label>
                        <input className="input bg-white text-sm" value={s.uf}
                          onChange={e => setSocioField(i, 'uf', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">CEP</label>
                        <input className="input bg-white text-sm font-mono" value={s.cep}
                          onChange={e => setSocioField(i, 'cep', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Novo endereço */}
          {events.has('endereco') && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs">◎</span>
                Novo Endereço da Sede
              </h3>
              <div className="border rounded-xl p-4 bg-gray-50 grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label text-xs">Logradouro</label>
                  <input className="input bg-white text-sm" value={novoEnd.logradouro}
                    onChange={e => setNovoEnd(p => ({ ...p, logradouro: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Número</label>
                  <input className="input bg-white text-sm" value={novoEnd.numero}
                    onChange={e => setNovoEnd(p => ({ ...p, numero: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Complemento</label>
                  <input className="input bg-white text-sm" value={novoEnd.complemento}
                    onChange={e => setNovoEnd(p => ({ ...p, complemento: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Bairro</label>
                  <input className="input bg-white text-sm" value={novoEnd.bairro}
                    onChange={e => setNovoEnd(p => ({ ...p, bairro: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Cidade</label>
                  <input className="input bg-white text-sm" value={novoEnd.cidade}
                    onChange={e => setNovoEnd(p => ({ ...p, cidade: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">UF</label>
                  <input className="input bg-white text-sm" value={novoEnd.uf}
                    onChange={e => setNovoEnd(p => ({ ...p, uf: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">CEP</label>
                  <input className="input bg-white text-sm font-mono" value={novoEnd.cep}
                    onChange={e => setNovoEnd(p => ({ ...p, cep: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* Capital Social */}
          {events.has('capital') && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs">$</span>
                Capital Social
              </h3>
              <div className="border rounded-xl p-4 bg-gray-50 grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Capital Atual (R$)</label>
                  <input className="input bg-white text-sm" placeholder="Ex: 10.000,00" value={capAtual}
                    onChange={e => setCapAtual(e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Novo Capital (R$)</label>
                  <input className="input bg-white text-sm" placeholder="Ex: 50.000,00" value={capNovo}
                    onChange={e => setCapNovo(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Objeto Social */}
          {events.has('objeto') && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">≡</span>
                Objeto Social
              </h3>
              <div className="border rounded-xl p-4 bg-gray-50">
                <label className="label text-xs">Novo Objeto Social</label>
                <textarea className="input bg-white text-sm resize-none h-28"
                  placeholder="Descreva as atividades da empresa..."
                  value={objeto} onChange={e => setObjeto(e.target.value)} />
              </div>
            </div>
          )}

          {/* Cláusulas Adicionais */}
          {events.has('clausulas') && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">+</span>
                Cláusulas Adicionais
              </h3>
              {clausulas.length === 0 ? (
                <div className="border rounded-xl p-4 bg-gray-50 text-sm text-gray-500 text-center">
                  Nenhuma cláusula cadastrada. Acesse a aba <strong>Cláusulas</strong> para adicionar.
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden divide-y">
                  {clausulas.map(c => (
                    <label key={c.id} className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${
                      clausulasSel.includes(c.id) ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'}`}>
                      <input type="checkbox" className="mt-0.5 w-4 h-4 accent-indigo-600"
                        checked={clausulasSel.includes(c.id)}
                        onChange={e => setClausulasSel(prev =>
                          e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.titulo}</p>
                        <p className="text-xs text-gray-400">{c.tipo}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.conteudo}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Confirmação Final ── */}
          <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
            <h3 className="font-semibold text-blue-800 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Confirmação Final — Revisar antes de gerar
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Data do Documento</label>
                <input type="date" className="input bg-white text-sm" value={dataContrato}
                  onChange={e => setDataContrato(e.target.value)} />
                {dataContrato && (
                  <p className="text-xs text-blue-600 mt-0.5 font-medium">
                    {dataExtensoCompleto(new Date(dataContrato + 'T12:00:00'), empresaDados.cidade || 'São Paulo')}
                  </p>
                )}
              </div>
              <div>
                <label className="label text-xs">Sessão da Junta</label>
                <input className="input bg-white text-sm" placeholder="Ex: 10/03/2021"
                  value={empresaDados.sessao_junta}
                  onChange={e => setEmpresaDados(p => ({ ...p, sessao_junta: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">Início das Atividades</label>
                <input type="date" className="input bg-white text-sm" value={empresaDados.data_inicio_atividades}
                  onChange={e => setEmpresaDados(p => ({ ...p, data_inicio_atividades: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">Capital Social (R$)</label>
                <input className="input bg-white text-sm" placeholder="Ex: 10.000,00"
                  value={empresaDados.capital_social}
                  onChange={e => setEmpresaDados(p => ({ ...p, capital_social: e.target.value }))} />
                {empresaDados.capital_social && (
                  <p className="text-xs text-blue-600 mt-0.5">{capitalExtenso(empresaDados.capital_social)}</p>
                )}
              </div>
              <div>
                <label className="label text-xs">Cidade da Assinatura</label>
                <input className="input bg-white text-sm" placeholder="Ex: São Paulo"
                  value={cidadeAssinatura}
                  onChange={e => setCidadeAssinatura(e.target.value)} />
              </div>
            </div>
            {dataContrato && (
              <p className="text-xs text-blue-700 font-medium">
                Linha de assinatura: <span className="italic">{cidadeAssinatura || empresaDados.cidade || 'São Paulo'}, {dataExtenso(new Date(dataContrato + 'T12:00:00'))}.</span>
              </p>
            )}
          </div>

          {/* Botões finais */}
          <div className="flex items-center justify-between pt-2 border-t">
            <button className="btn-secondary" onClick={() => setStep(2)}>← Voltar</button>
            <div className="flex gap-2">
              <button
                className="btn-secondary flex items-center gap-2"
                disabled={loading}
                onClick={() => handleGerar(true)}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Gerar PDF
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                disabled={loading}
                onClick={() => handleGerar(false)}
              >
                {loading ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                )}
                Baixar .docx
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
