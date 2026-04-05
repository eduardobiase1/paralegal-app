'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ContractTemplate, Empresa, Clausula } from '@/types'
import { formatCNPJ } from '@/lib/utils'
import {
  dataExtenso, dataExtensoCompleto, capitalExtenso, formatarReais,
  aplicarGenero, calcularCapitalSocial, formatarObjetoSocial
} from '@/lib/formatters'
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

type TipoContrato = 'constituicao' | 'distrato' | 'alteracao' | 'generico'
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
  { key: 'socios',    label: 'Sócios',              desc: 'Qualificação completa dos sócios' },
  { key: 'endereco',  label: 'Novo Endereço',        desc: 'Alteração da sede da empresa' },
  { key: 'capital',   label: 'Capital Social',       desc: 'Aumento ou redução do capital' },
  { key: 'objeto',    label: 'Objeto Social',        desc: 'Alteração das atividades da empresa' },
  { key: 'clausulas', label: 'Cláusulas Adicionais', desc: 'Incluir cláusulas especiais' },
]

// ─── Detectar tipo de contrato pelo nome do template ─────────────────────────

function detectarTipo(nomeTemplate: string): TipoContrato {
  const n = nomeTemplate.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (n.includes('distrato') || n.includes('encerramento') || n.includes('dissolucao') || n.includes('baixa')) return 'distrato'
  if (n.includes('constituic') || n.includes('abertura') || n.includes('constituic') || n.includes('formac') || n.includes('contrato social')) return 'constituicao'
  if (n.includes('alterac') || n.includes('aditivo') || n.includes('cessao') || n.includes('transferencia')) return 'alteracao'
  return 'generico'
}

const TIPO_INFO: Record<TipoContrato, { label: string; cor: string; icone: string; descricao: string }> = {
  constituicao: {
    label: 'Constituição de Empresa',
    cor: 'blue',
    icone: '🏢',
    descricao: 'Preencha os dados dos sócios fundadores, capital social e objeto da empresa.',
  },
  distrato: {
    label: 'Distrato Social',
    cor: 'red',
    icone: '📋',
    descricao: 'Preencha os dados dos sócios e o capital a ser devolvido no encerramento.',
  },
  alteracao: {
    label: 'Alteração Contratual',
    cor: 'orange',
    icone: '✏️',
    descricao: 'Selecione o que está sendo alterado e preencha apenas os campos relevantes.',
  },
  generico: {
    label: 'Documento Jurídico',
    cor: 'gray',
    icone: '📄',
    descricao: 'Preencha as informações necessárias para o documento.',
  },
}

// ─── Wizard Principal ─────────────────────────────────────────────────────────

export default function ContratoWizard({ template, empresas, defaultEmpresaId = '', onSuccess }: Props) {
  const [supabase] = useState(createClient)
  const tipo: TipoContrato = detectarTipo(template.nome)

  // Para alteração tem 3 steps; para os demais tem 2 (empresa → dados)
  const totalSteps = tipo === 'alteracao' ? 3 : 2
  const [step, setStep] = useState<number>(1)
  const [loading, setLoading] = useState(false)

  // Step 1 — Empresa
  const [empresaId, setEmpresaId] = useState(defaultEmpresaId)
  const [empresaObj, setEmpresaObj] = useState<Empresa | null>(null)
  const [empresaDados, setEmpresaDados] = useState<EmpresaDados>({
    nire: '', sessao_junta: '', logradouro: '', numero: '',
    complemento: '', bairro: '', cidade: '', uf: '', cep: '',
    capital_social: '', valor_quota: '1,00', data_inicio_atividades: '',
  })

  // Confirmação final
  const [dataContrato, setDataContrato] = useState(new Date().toISOString().split('T')[0])
  const [cidadeAssinatura, setCidadeAssinatura] = useState('São Paulo')
  const [cidadeForo, setCidadeForo] = useState('')

  // CNAEs / Objeto
  const [cnaes, setCnaes] = useState<string[]>([''])
  const objetoFormatado = formatarObjetoSocial(cnaes)
  const [objeto, setObjeto] = useState('')

  // Step alteração — eventos
  const [events, setEvents] = useState<Set<EventKey>>(new Set(['socios']))

  // Sócios
  const [socios, setSocios] = useState<Socio[]>([{ ...EMPTY_SOCIO }])

  // Novo endereço (alteração)
  const [novoEnd, setNovoEnd] = useState({ logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '' })

  // Capital alteração
  const [capAtual, setCapAtual] = useState('')
  const [capNovo, setCapNovo] = useState('')

  // Cláusulas
  const [clausulas, setClausulas] = useState<Clausula[]>([])
  const [clausulasSel, setClausulasSel] = useState<string[]>([])

  // Distrato — guardião dos livros e liquidante (índice do sócio)
  const [guardiaoIdx, setGuardiaoIdx] = useState(0)
  const [liquidanteIdx, setLiquidanteIdx] = useState(0)

  // ── Carregar empresa ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!empresaId) return
    supabase.from('empresas').select('*').eq('id', empresaId).single().then(({ data }) => {
      if (!data) return
      setEmpresaObj(data as Empresa)
      setEmpresaDados({
        nire:                   (data as any).nire ?? '',
        sessao_junta:           (data as any).sessao_junta ?? '',
        logradouro:             data.logradouro ?? '',
        numero:                 data.numero ?? '',
        complemento:            data.complemento ?? '',
        bairro:                 data.bairro ?? '',
        cidade:                 data.cidade ?? '',
        uf:                     data.uf ?? '',
        cep:                    data.cep ?? '',
        capital_social:         (data as any).capital_social ?? '',
        valor_quota:            (data as any).valor_quota || '1,00',
        data_inicio_atividades: (data as any).data_inicio_atividades ?? '',
      })
      if ((data as any).cidade) setCidadeForo((data as any).cidade)
      if ((data as any).cidade) setCidadeAssinatura((data as any).cidade)
      const cnaePrincipal = (data as any).cnae_principal ?? ''
      const cnaesSecund: string[] = (data as any).cnaes_secundarios ?? []
      const todosCnaes = [cnaePrincipal, ...cnaesSecund].filter(Boolean)
      if (todosCnaes.length > 0) setCnaes(todosCnaes)
      else setCnaes([''])
    })
  }, [empresaId])

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

  // ── buildData ────────────────────────────────────────────────────────────

  function buildData(): Record<string, any> {
    if (!empresaObj) return {}
    const dtContrato = dataContrato ? new Date(dataContrato + 'T12:00:00') : new Date()

    // Eventos automáticos por tipo
    const evAuto: Record<TipoContrato, EventKey[]> = {
      constituicao: ['socios', 'capital', 'objeto'],
      distrato:     ['socios', 'capital'],
      alteracao:    [...events] as EventKey[],
      generico:     ['socios', 'capital', 'objeto', 'clausulas'],
    }
    const evAtivos = new Set(evAuto[tipo])

    const data: Record<string, any> = {
      // Empresa
      razao_social:         empresaObj.razao_social,
      nome_fantasia:        empresaObj.nome_fantasia ?? '',
      cnpj:                 formatCNPJ(empresaObj.cnpj),
      inscricao_estadual:   empresaObj.inscricao_estadual ?? '',
      inscricao_municipal:  empresaObj.inscricao_municipal ?? '',
      nire:                 empresaDados.nire,
      sessao_junta:         empresaDados.sessao_junta,
      data_inicio_atividades: empresaDados.data_inicio_atividades
        ? new Date(empresaDados.data_inicio_atividades + 'T12:00:00').toLocaleDateString('pt-BR')
        : '',
      data_inicio_atividades_extenso: empresaDados.data_inicio_atividades
        ? dataExtenso(new Date(empresaDados.data_inicio_atividades + 'T12:00:00'))
        : '',

      // Endereço da sede
      sede_logradouro:  empresaDados.logradouro,
      sede_numero:      empresaDados.numero,
      sede_complemento: empresaDados.complemento,
      sede_bairro:      empresaDados.bairro,
      sede_cidade:      empresaDados.cidade,
      sede_uf:          empresaDados.uf,
      sede_cep:         empresaDados.cep,
      logradouro:       empresaDados.logradouro,
      numero:           empresaDados.numero,
      complemento:      empresaDados.complemento,
      bairro:           empresaDados.bairro,
      cidade:           empresaDados.cidade,
      uf:               empresaDados.uf,
      cep:              empresaDados.cep,

      // Datas
      data_contrato:         dtContrato.toLocaleDateString('pt-BR'),
      data_extenso:          dataExtenso(dtContrato),
      cidade_assinatura:     cidadeAssinatura || empresaDados.cidade || 'São Paulo',
      data_extenso_completo: dataExtensoCompleto(dtContrato, cidadeAssinatura || empresaDados.cidade || 'São Paulo'),

      // Capital
      capital_social:              empresaDados.capital_social,
      capital_social_formatado:    formatarReais(empresaDados.capital_social),
      capital_social_extenso:      capitalExtenso(empresaDados.capital_social),
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

      // Capital alteração
      capital_social_novo:           capNovo,
      capital_social_novo_formatado: formatarReais(capNovo),
      capital_social_novo_extenso:   capitalExtenso(capNovo),
      capital_social_atual:          capAtual,
      capital_social_atual_formatado: formatarReais(capAtual),
      capital_social_atual_extenso:  capitalExtenso(capAtual),

      // Objeto social
      objeto_social: tipo === 'constituicao' ? (objetoFormatado || objeto) : objeto,

      // Foro
      cidade_foro: cidadeForo || empresaDados.cidade || '',
      uf_foro:     empresaDados.uf || '',

      // Flags
      has_socios:    evAtivos.has('socios'),
      has_endereco:  evAtivos.has('endereco'),
      has_capital:   evAtivos.has('capital'),
      has_objeto:    evAtivos.has('objeto'),
      has_clausulas: evAtivos.has('clausulas'),

      // Novo endereço
      novo_logradouro:  novoEnd.logradouro,
      novo_numero:      novoEnd.numero,
      novo_complemento: novoEnd.complemento,
      novo_bairro:      novoEnd.bairro,
      novo_cidade:      novoEnd.cidade,
      novo_uf:          novoEnd.uf,
      novo_cep:         novoEnd.cep,

      // Cláusulas
      clausulas_adicionais: clausulasSel
        .map(id => clausulas.find(c => c.id === id))
        .filter(Boolean)
        .map(c => `${c!.titulo}\n\n${c!.conteudo}`)
        .join('\n\n'),

      total_socios: socios.length.toString(),
      socio_unico:  socios.length === 1 ? 'sim' : 'não',

      // Distrato — guardião dos livros e liquidante
      socio_guardiao_livros:  socios[guardiaoIdx]?.nome  ?? socios[0]?.nome ?? '',
      socio_liquidante:       socios[liquidanteIdx]?.nome ?? socios[0]?.nome ?? '',

      // Gênero societário (Sócio 1 como referência)
      ...(() => {
        const g = socios[0]?.genero ?? 'masculino'
        const f = g === 'feminino'
        return {
          // Existentes
          socio_unico_artigo:      f ? 'única sócia'          : 'único sócio',
          socio_unico_artigo_cap:  f ? 'Única Sócia'          : 'Único Sócio',
          socio_administrador:     f ? 'sócia administradora' : 'sócio administrador',
          socio_administrador_cap: f ? 'Sócia Administradora' : 'Sócio Administrador',
          o_socio:                 f ? 'a sócia'              : 'o sócio',
          O_socio:                 f ? 'A sócia'              : 'O sócio',
          // Novos — constituição e documentos gerais
          tratamento:                    f ? 'Sra.'                          : 'Sr.',
          o_abaixo_assinado:             f ? 'a abaixo assinada'             : 'o abaixo assinado',
          ao_unico_socio:                f ? 'à única sócia'                 : 'ao único sócio',
          ao_unico_socio_tratamento:     f ? 'à única sócia a Sra.'          : 'ao único sócio o Sr.',
          o_administrador:               f ? 'a administradora'              : 'o administrador',
          O_administrador:               f ? 'A administradora'              : 'O administrador',
          do_unico_socio:                f ? 'da única sócia'                : 'do único sócio',
          pelo_unico_socio:              f ? 'pela única sócia'              : 'pelo único sócio',
          ao_socio_liquidante:           f ? 'à sócia liquidante'            : 'ao sócio liquidante',
        }
      })(),
    }

    // Sócios
    const sociosArr = socios.map(s => {
      const g = s.genero
      const precisaRegime = ['casado', 'união estável'].includes(s.estado_civil)
      const estadoCivil   = aplicarGenero(s.estado_civil, g)
      const nacionalidade = aplicarGenero(s.nacionalidade, g)
      const profissao     = aplicarGenero(s.profissao, g)
      const portador      = g === 'feminino' ? 'portadora'              : 'portador'
      const residente     = g === 'feminino' ? 'residente e domiciliada' : 'residente e domiciliado'
      const artigo        = g === 'feminino' ? 'a sócia'               : 'o sócio'
      const tratamento    = g === 'feminino' ? 'Sra.'                  : 'Sr.'
      const empresario    = g === 'feminino' ? 'empresária'            : 'empresário'
      const ecCompleto    = precisaRegime && s.regime_bens
        ? `${estadoCivil} sob o regime de ${s.regime_bens}` : estadoCivil

      return {
        nome: s.nome, genero: g, artigo, tratamento, empresario, nacionalidade,
        naturalidade: s.naturalidade, estado_civil: estadoCivil,
        estado_civil_completo: ecCompleto,
        regime_bens: precisaRegime ? s.regime_bens : '',
        profissao, portador, residente,
        cpf: s.cpf, rg: s.rg, orgao_expedidor: s.orgao_expedidor,
        logradouro: s.logradouro, numero: s.numero, complemento: s.complemento,
        bairro: s.bairro, cidade: s.cidade, uf: s.uf, cep: s.cep,
        percentual_quotas: s.percentual_quotas,
      }
    })

    data['socios'] = sociosArr
    sociosArr.forEach((s, i) => {
      Object.entries(s).forEach(([k, v]) => { data[`socio_${i + 1}_${k}`] = v })
    })

    return data
  }

  // ── Geração do documento ─────────────────────────────────────────────────

  async function handleGerar(asPdf = false) {
    if (!empresaId || !empresaObj) { toast.error('Selecione uma empresa'); return }
    if (socios.some(s => !s.nome)) { toast.error('Preencha o nome de todos os sócios'); return }

    setLoading(true)
    try {
      const resp = await fetch(template.arquivo_url)
      if (!resp.ok) throw new Error('Erro ao baixar template')
      const arrayBuffer = await resp.arrayBuffer()

      const PizZip       = (await import('pizzip')).default
      const Docxtemplater = (await import('docxtemplater')).default
      const { saveAs }   = await import('file-saver')

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

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true, linebreaks: true,
        delimiters: { start: '{{', end: '}}' },
        nullGetter: () => '',
      })

      doc.render(buildData())

      const nomeArq = `${empresaObj.razao_social}_${template.nome}_${new Date().toISOString().split('T')[0]}`
        .replace(/[^a-zA-Z0-9_\-]/g, '_')

      if (asPdf) {
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

      await supabase.from('contratos').insert({
        empresa_id:    empresaId,
        template_nome: template.nome,
        dados_json:    buildData(),
        arquivo_nome:  `${nomeArq}.docx`,
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

  // ── Helpers de navegação ─────────────────────────────────────────────────

  const tipoInfo = TIPO_INFO[tipo]
  const corMap: Record<string, string> = {
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    red:    'bg-red-50 border-red-200 text-red-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    gray:   'bg-gray-50 border-gray-200 text-gray-700',
  }

  const stepLabels = tipo === 'alteracao'
    ? ['Empresa', 'O que muda', 'Dados']
    : ['Empresa', 'Dados']

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Badge do tipo de contrato */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${corMap[tipoInfo.cor]}`}>
        <span className="text-2xl">{tipoInfo.icone}</span>
        <div>
          <p className="text-sm font-semibold">{tipoInfo.label}</p>
          <p className="text-xs opacity-80">{tipoInfo.descricao}</p>
        </div>
      </div>

      {/* Indicador de passos */}
      <div className="flex items-center gap-0">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i + 1 === step  ? 'bg-blue-600 text-white' :
              i + 1 < step   ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i + 1 < step ? '✓' : i + 1}
            </div>
            <span className={`ml-2 text-xs font-medium ${i + 1 === step ? 'text-gray-900' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < stepLabels.length - 1 && <div className="flex-1 h-px bg-gray-200 mx-3" />}
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PASSO 1 — Empresa
      ══════════════════════════════════════════════════════════════ */}
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
              <div className="flex items-center gap-2 mb-1">
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
                  <input className="input bg-white text-sm" value={empresaDados.sessao_junta}
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
                  <input className="input bg-white text-sm" placeholder="Ex: 10.000,00"
                    value={empresaDados.capital_social}
                    onChange={e => setEmpresaDados(p => ({ ...p, capital_social: e.target.value }))} />
                  {empresaDados.capital_social && (
                    <p className="text-xs text-gray-400 mt-0.5">{capitalExtenso(empresaDados.capital_social)}</p>
                  )}
                </div>
                <div>
                  <label className="label text-xs">Valor por Quota (R$)</label>
                  <input className="input bg-white text-sm" placeholder="Ex: 1,00"
                    value={empresaDados.valor_quota}
                    onChange={e => setEmpresaDados(p => ({ ...p, valor_quota: e.target.value }))} />
                  {empresaDados.capital_social && empresaDados.valor_quota && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      = {calcularCapitalSocial(empresaDados.capital_social, empresaDados.valor_quota).quantidade_extenso}
                    </p>
                  )}
                </div>
                {tipo === 'constituicao' && (
                  <div>
                    <label className="label text-xs">Data de Início das Atividades</label>
                    <input type="date" className="input bg-white text-sm"
                      value={empresaDados.data_inicio_atividades}
                      onChange={e => setEmpresaDados(p => ({ ...p, data_inicio_atividades: e.target.value }))} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button className="btn-primary" disabled={!empresaId} onClick={() => setStep(tipo === 'alteracao' ? 2 : 2)}>
              Próximo →
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PASSO 2 (ALTERAÇÃO APENAS) — Selecionar o que muda
      ══════════════════════════════════════════════════════════════ */}
      {step === 2 && tipo === 'alteracao' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Selecione o que este documento irá alterar:</p>
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
            <button className="btn-primary" disabled={events.size === 0} onClick={() => setStep(3)}>Próximo →</button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PASSO 2 (CONSTITUIÇÃO) — Sócios + Capital + Objeto
      ══════════════════════════════════════════════════════════════ */}
      {step === 2 && tipo === 'constituicao' && (
        <FormConstituicao
          socios={socios} setSocios={setSocios} setSocioField={setSocioField}
          cnaes={cnaes} setCnaes={setCnaes} objetoFormatado={objetoFormatado}
          dataContrato={dataContrato} setDataContrato={setDataContrato}
          cidadeAssinatura={cidadeAssinatura} setCidadeAssinatura={setCidadeAssinatura}
          cidadeForo={cidadeForo} setCidadeForo={setCidadeForo}
          empresaDados={empresaDados} setEmpresaDados={setEmpresaDados}
          clausulas={clausulas} clausulasSel={clausulasSel} setClausulasSel={setClausulasSel}
          loading={loading}
          onBack={() => setStep(1)}
          onGerarDocx={() => handleGerar(false)}
          onGerarPdf={() => handleGerar(true)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PASSO 2 (DISTRATO) — Sócios + Capital
      ══════════════════════════════════════════════════════════════ */}
      {step === 2 && tipo === 'distrato' && (
        <FormDistrato
          socios={socios} setSocios={setSocios} setSocioField={setSocioField}
          guardiaoIdx={guardiaoIdx} setGuardiaoIdx={setGuardiaoIdx}
          liquidanteIdx={liquidanteIdx} setLiquidanteIdx={setLiquidanteIdx}
          dataContrato={dataContrato} setDataContrato={setDataContrato}
          cidadeAssinatura={cidadeAssinatura} setCidadeAssinatura={setCidadeAssinatura}
          cidadeForo={cidadeForo} setCidadeForo={setCidadeForo}
          empresaDados={empresaDados} setEmpresaDados={setEmpresaDados}
          clausulas={clausulas} clausulasSel={clausulasSel} setClausulasSel={setClausulasSel}
          loading={loading}
          onBack={() => setStep(1)}
          onGerarDocx={() => handleGerar(false)}
          onGerarPdf={() => handleGerar(true)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PASSO 2 (GENÉRICO) — Formulário completo
      ══════════════════════════════════════════════════════════════ */}
      {step === 2 && tipo === 'generico' && (
        <FormGenerico
          socios={socios} setSocios={setSocios} setSocioField={setSocioField}
          cnaes={cnaes} setCnaes={setCnaes} objetoFormatado={objetoFormatado}
          objeto={objeto} setObjeto={setObjeto}
          dataContrato={dataContrato} setDataContrato={setDataContrato}
          cidadeAssinatura={cidadeAssinatura} setCidadeAssinatura={setCidadeAssinatura}
          cidadeForo={cidadeForo} setCidadeForo={setCidadeForo}
          empresaDados={empresaDados} setEmpresaDados={setEmpresaDados}
          clausulas={clausulas} clausulasSel={clausulasSel} setClausulasSel={setClausulasSel}
          loading={loading}
          onBack={() => setStep(1)}
          onGerarDocx={() => handleGerar(false)}
          onGerarPdf={() => handleGerar(true)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PASSO 3 (ALTERAÇÃO APENAS) — Dados das alterações
      ══════════════════════════════════════════════════════════════ */}
      {step === 3 && tipo === 'alteracao' && (
        <FormAlteracao
          events={events}
          socios={socios} setSocios={setSocios} setSocioField={setSocioField}
          novoEnd={novoEnd} setNovoEnd={setNovoEnd}
          capAtual={capAtual} setCapAtual={setCapAtual}
          capNovo={capNovo} setCapNovo={setCapNovo}
          objeto={objeto} setObjeto={setObjeto}
          cnaes={cnaes} setCnaes={setCnaes} objetoFormatado={objetoFormatado}
          clausulas={clausulas} clausulasSel={clausulasSel} setClausulasSel={setClausulasSel}
          dataContrato={dataContrato} setDataContrato={setDataContrato}
          cidadeAssinatura={cidadeAssinatura} setCidadeAssinatura={setCidadeAssinatura}
          cidadeForo={cidadeForo} setCidadeForo={setCidadeForo}
          empresaDados={empresaDados}
          loading={loading}
          onBack={() => setStep(2)}
          onGerarDocx={() => handleGerar(false)}
          onGerarPdf={() => handleGerar(true)}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES DE FORMULÁRIO POR TIPO
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Shared: Painel de Sócios ────────────────────────────────────────────────

interface SociosPanelProps {
  titulo: string
  socios: Socio[]
  setSocios: React.Dispatch<React.SetStateAction<Socio[]>>
  setSocioField: (i: number, field: keyof Socio, v: string) => void
  multiSocio?: boolean
}

const EMPTY_SOCIO_LOCAL: Socio = {
  nome: '', genero: 'masculino', nacionalidade: 'brasileiro(a)', naturalidade: '',
  estado_civil: 'solteiro', regime_bens: '', profissao: '', cpf: '', rg: '',
  orgao_expedidor: '', logradouro: '', numero: '', complemento: '',
  bairro: '', cidade: '', uf: '', cep: '', percentual_quotas: '',
}

function SociosPanel({ titulo, socios, setSocios, setSocioField, multiSocio = true }: SociosPanelProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{titulo}</h3>
        {multiSocio && (
          <button type="button" onClick={() => setSocios(p => [...p, { ...EMPTY_SOCIO_LOCAL }])}
            className="btn-secondary text-xs py-1.5 px-3">+ Adicionar Sócio</button>
        )}
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
                  {['solteiro', 'casado', 'divorciado', 'viúvo', 'união estável'].map(ec =>
                    <option key={ec} value={ec}>{ec}</option>)}
                </select>
              </div>
              {['casado', 'união estável'].includes(s.estado_civil) && (
                <div>
                  <label className="label text-xs">Regime de Bens</label>
                  <select className="input bg-white text-sm" value={s.regime_bens}
                    onChange={e => setSocioField(i, 'regime_bens', e.target.value)}>
                    <option value="">Selecione...</option>
                    {['comunhão parcial de bens','comunhão universal de bens','separação total de bens','participação final nos aquestos'].map(r =>
                      <option key={r} value={r}>{r}</option>)}
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
  )
}

// ─── Shared: Painel de Confirmação ───────────────────────────────────────────

interface ConfirmacaoProps {
  dataContrato: string; setDataContrato: (v: string) => void
  cidadeAssinatura: string; setCidadeAssinatura: (v: string) => void
  cidadeForo: string; setCidadeForo: (v: string) => void
  empresaDados: EmpresaDados
  clausulas: Clausula[]; clausulasSel: string[]; setClausulasSel: (v: string[]) => void
  loading: boolean
  onBack: () => void; onGerarDocx: () => void; onGerarPdf: () => void
}

function PainelConfirmacao({ dataContrato, setDataContrato, cidadeAssinatura, setCidadeAssinatura,
  cidadeForo, setCidadeForo, empresaDados, clausulas, clausulasSel, setClausulasSel,
  loading, onBack, onGerarDocx, onGerarPdf }: ConfirmacaoProps) {
  return (
    <>
      {/* Cláusulas adicionais */}
      {clausulas.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Cláusulas Adicionais <span className="text-xs text-gray-400 font-normal">(opcional)</span></h3>
          <div className="border rounded-xl overflow-hidden divide-y">
            {clausulas.map(c => (
              <label key={c.id} className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${
                clausulasSel.includes(c.id) ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'}`}>
                <input type="checkbox" className="mt-0.5 w-4 h-4 accent-indigo-600"
                  checked={clausulasSel.includes(c.id)}
                  onChange={e => setClausulasSel(e.target.checked
                    ? [...clausulasSel, c.id]
                    : clausulasSel.filter(id => id !== c.id))} />
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.titulo}</p>
                  <p className="text-xs text-gray-400">{c.tipo}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Confirmação final */}
      <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
        <h3 className="font-semibold text-blue-800 text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Confirmação Final
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs">Data do Documento</label>
            <input type="date" className="input bg-white text-sm" value={dataContrato}
              onChange={e => setDataContrato(e.target.value)} />
            {dataContrato && (
              <p className="text-xs text-blue-600 mt-0.5 font-medium">
                {dataExtensoCompleto(new Date(dataContrato + 'T12:00:00'), cidadeAssinatura || empresaDados.cidade || 'São Paulo')}
              </p>
            )}
          </div>
          <div>
            <label className="label text-xs">Cidade da Assinatura</label>
            <input className="input bg-white text-sm" value={cidadeAssinatura}
              onChange={e => setCidadeAssinatura(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Cidade do Foro / Comarca</label>
            <input className="input bg-white text-sm" value={cidadeForo}
              onChange={e => setCidadeForo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex items-center justify-between pt-2 border-t">
        <button className="btn-secondary" onClick={onBack}>← Voltar</button>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2" disabled={loading} onClick={onGerarPdf}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Gerar PDF
          </button>
          <button className="btn-primary flex items-center gap-2" disabled={loading} onClick={onGerarDocx}>
            {loading ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>Gerando...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>Gerar Word</>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Formulário: CONSTITUIÇÃO ─────────────────────────────────────────────────

function FormConstituicao({ socios, setSocios, setSocioField, cnaes, setCnaes, objetoFormatado,
  dataContrato, setDataContrato, cidadeAssinatura, setCidadeAssinatura, cidadeForo, setCidadeForo,
  empresaDados, setEmpresaDados, clausulas, clausulasSel, setClausulasSel, loading, onBack, onGerarDocx, onGerarPdf }: any) {
  return (
    <div className="space-y-6">

      {/* Sócios Fundadores */}
      <SociosPanel titulo="Sócios Fundadores" socios={socios} setSocios={setSocios} setSocioField={setSocioField} />

      {/* Objeto Social */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Objeto Social / Atividades (CNAE)</h3>
        <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
          <p className="text-xs text-gray-500">Adicione as atividades da empresa. Elas serão formatadas automaticamente em texto jurídico.</p>
          {cnaes.map((c: string, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-right">{i + 1}.</span>
              <input className="input bg-white text-sm flex-1"
                placeholder={i === 0 ? 'Ex: Consultoria em gestão empresarial' : 'Ex: Assessoria contábil e tributária'}
                value={c}
                onChange={e => setCnaes((prev: string[]) => prev.map((v: string, idx: number) => idx === i ? e.target.value : v))} />
              {cnaes.length > 1 && (
                <button type="button" onClick={() => setCnaes((prev: string[]) => prev.filter((_: string, idx: number) => idx !== i))}
                  className="text-red-400 hover:text-red-600 p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setCnaes((prev: string[]) => [...prev, ''])}
            className="text-xs text-purple-700 hover:text-purple-900 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Adicionar atividade
          </button>
          {objetoFormatado && (
            <div className="p-3 bg-white rounded-lg border border-purple-100">
              <p className="text-xs text-purple-700 font-medium mb-1">Prévia do texto jurídico:</p>
              <p className="text-xs text-gray-700 italic leading-relaxed">{objetoFormatado}</p>
            </div>
          )}
        </div>
      </div>

      <PainelConfirmacao
        dataContrato={dataContrato} setDataContrato={setDataContrato}
        cidadeAssinatura={cidadeAssinatura} setCidadeAssinatura={setCidadeAssinatura}
        cidadeForo={cidadeForo} setCidadeForo={setCidadeForo}
        empresaDados={empresaDados} clausulas={clausulas}
        clausulasSel={clausulasSel} setClausulasSel={setClausulasSel}
        loading={loading} onBack={onBack} onGerarDocx={onGerarDocx} onGerarPdf={onGerarPdf}
      />
    </div>
  )
}

// ─── Formulário: DISTRATO ─────────────────────────────────────────────────────

function FormDistrato({ socios, setSocios, setSocioField,
  guardiaoIdx, setGuardiaoIdx, liquidanteIdx, setLiquidanteIdx,
  dataContrato, setDataContrato, cidadeAssinatura, setCidadeAssinatura,
  cidadeForo, setCidadeForo, empresaDados, setEmpresaDados,
  clausulas, clausulasSel, setClausulasSel, loading, onBack, onGerarDocx, onGerarPdf }: any) {
  return (
    <div className="space-y-6">

      {/* Aviso distrato */}
      <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
        <span className="text-lg">⚠️</span>
        <div>
          <p className="font-medium">Distrato Social — Encerramento da empresa</p>
          <p className="text-xs text-red-600 mt-0.5">
            Preencha os dados dos sócios conforme constam no contrato social vigente.
          </p>
        </div>
      </div>

      {/* Data de início das atividades — Cláusula Primeira */}
      <div className="border rounded-xl p-4 bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-mono">Cláusula 1ª</span>
          Data de Início das Atividades *
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs">Data (para o contrato)</label>
            <input
              type="date"
              className="input bg-white text-sm"
              value={empresaDados.data_inicio_atividades}
              onChange={e => setEmpresaDados((p: any) => ({ ...p, data_inicio_atividades: e.target.value }))}
            />
          </div>
          {empresaDados.data_inicio_atividades && (
            <div className="flex items-end pb-2">
              <p className="text-xs text-blue-600 font-medium">
                {new Date(empresaDados.data_inicio_atividades + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sócios */}
      <SociosPanel
        titulo="Sócios (conforme contrato vigente)"
        socios={socios} setSocios={setSocios} setSocioField={setSocioField}
      />

      {/* Responsabilidades — só aparecem se houver mais de 1 sócio */}
      {socios.length > 1 && (
        <div className="border rounded-xl p-4 bg-amber-50 border-amber-200 space-y-4">
          <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <span>📌</span> Responsabilidades no Distrato
          </h3>

          {/* Guardião dos livros — Cláusula 5ª */}
          <div>
            <label className="label text-xs">
              Cláusula 5ª — Responsável pela guarda dos livros
            </label>
            <select
              className="input bg-white text-sm"
              value={guardiaoIdx}
              onChange={e => setGuardiaoIdx(Number(e.target.value))}
            >
              {socios.map((s: Socio, i: number) => (
                <option key={i} value={i}>
                  Sócio {i + 1}{s.nome ? ` — ${s.nome}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Liquidante — Cláusula 6ª */}
          <div>
            <label className="label text-xs">
              Cláusula 6ª — Liquidante da empresa
            </label>
            <select
              className="input bg-white text-sm"
              value={liquidanteIdx}
              onChange={e => setLiquidanteIdx(Number(e.target.value))}
            >
              {socios.map((s: Socio, i: number) => (
                <option key={i} value={i}>
                  Sócio {i + 1}{s.nome ? ` — ${s.nome}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <PainelConfirmacao
        dataContrato={dataContrato} setDataContrato={setDataContrato}
        cidadeAssinatura={cidadeAssinatura} setCidadeAssinatura={setCidadeAssinatura}
        cidadeForo={cidadeForo} setCidadeForo={setCidadeForo}
        empresaDados={empresaDados} clausulas={clausulas}
        clausulasSel={clausulasSel} setClausulasSel={setClausulasSel}
        loading={loading} onBack={onBack} onGerarDocx={onGerarDocx} onGerarPdf={onGerarPdf}
      />
    </div>
  )
}

// ─── Formulário: ALTERAÇÃO ────────────────────────────────────────────────────

function FormAlteracao({ events, socios, setSocios, setSocioField, novoEnd, setNovoEnd,
  capAtual, setCapAtual, capNovo, setCapNovo, objeto, setObjeto, cnaes, setCnaes,
  objetoFormatado, clausulas, clausulasSel, setClausulasSel, dataContrato, setDataContrato,
  cidadeAssinatura, setCidadeAssinatura, cidadeForo, setCidadeForo, empresaDados,
  loading, onBack, onGerarDocx, onGerarPdf }: any) {
  return (
    <div className="space-y-6">

      {events.has('socios') && (
        <SociosPanel titulo="Sócios" socios={socios} setSocios={setSocios} setSocioField={setSocioField} />
      )}

      {events.has('endereco') && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Novo Endereço da Sede</h3>
          <div className="border rounded-xl p-4 bg-gray-50 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label text-xs">Logradouro</label>
              <input className="input bg-white text-sm" value={novoEnd.logradouro}
                onChange={e => setNovoEnd((p: any) => ({ ...p, logradouro: e.target.value }))} />
            </div>
            <div><label className="label text-xs">Número</label>
              <input className="input bg-white text-sm" value={novoEnd.numero}
                onChange={e => setNovoEnd((p: any) => ({ ...p, numero: e.target.value }))} /></div>
            <div><label className="label text-xs">Complemento</label>
              <input className="input bg-white text-sm" value={novoEnd.complemento}
                onChange={e => setNovoEnd((p: any) => ({ ...p, complemento: e.target.value }))} /></div>
            <div><label className="label text-xs">Bairro</label>
              <input className="input bg-white text-sm" value={novoEnd.bairro}
                onChange={e => setNovoEnd((p: any) => ({ ...p, bairro: e.target.value }))} /></div>
            <div><label className="label text-xs">Cidade</label>
              <input className="input bg-white text-sm" value={novoEnd.cidade}
                onChange={e => setNovoEnd((p: any) => ({ ...p, cidade: e.target.value }))} /></div>
            <div><label className="label text-xs">UF</label>
              <input className="input bg-white text-sm" value={novoEnd.uf}
                onChange={e => setNovoEnd((p: any) => ({ ...p, uf: e.target.value }))} /></div>
            <div><label className="label text-xs">CEP</label>
              <input className="input bg-white text-sm font-mono" value={novoEnd.cep}
                onChange={e => setNovoEnd((p: any) => ({ ...p, cep: e.target.value }))} /></div>
          </div>
        </div>
      )}

      {events.has('capital') && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Capital Social</h3>
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

      {events.has('objeto') && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Novo Objeto Social</h3>
          <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
            {cnaes.map((c: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-right">{i + 1}.</span>
                <input className="input bg-white text-sm flex-1" value={c}
                  placeholder="Ex: Consultoria em gestão empresarial"
                  onChange={e => setCnaes((prev: string[]) => prev.map((v: string, idx: number) => idx === i ? e.target.value : v))} />
                {cnaes.length > 1 && (
                  <button type="button" onClick={() => setCnaes((prev: string[]) => prev.filter((_: string, idx: number) => idx !== i))}
                    className="text-red-400 hover:text-red-600 p-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setCnaes((prev: string[]) => [...prev, ''])}
              className="text-xs text-purple-700 font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>Adicionar atividade
            </button>
            {objetoFormatado && (
              <div className="p-3 bg-white rounded-lg border border-purple-100">
                <p className="text-xs text-purple-700 font-medium mb-1">Prévia:</p>
                <p className="text-xs text-gray-700 italic">{objetoFormatado}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <PainelConfirmacao
        dataContrato={dataContrato} setDataContrato={setDataContrato}
        cidadeAssinatura={cidadeAssinatura} setCidadeAssinatura={setCidadeAssinatura}
        cidadeForo={cidadeForo} setCidadeForo={setCidadeForo}
        empresaDados={empresaDados} clausulas={clausulas}
        clausulasSel={clausulasSel} setClausulasSel={setClausulasSel}
        loading={loading} onBack={onBack} onGerarDocx={onGerarDocx} onGerarPdf={onGerarPdf}
      />
    </div>
  )
}

// ─── Formulário: GENÉRICO ─────────────────────────────────────────────────────

function FormGenerico({ socios, setSocios, setSocioField, cnaes, setCnaes, objetoFormatado,
  objeto, setObjeto, dataContrato, setDataContrato, cidadeAssinatura, setCidadeAssinatura,
  cidadeForo, setCidadeForo, empresaDados, clausulas, clausulasSel, setClausulasSel,
  loading, onBack, onGerarDocx, onGerarPdf }: any) {
  return (
    <div className="space-y-6">
      <SociosPanel titulo="Partes / Sócios" socios={socios} setSocios={setSocios} setSocioField={setSocioField} />
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Objeto / Conteúdo</h3>
        <div className="border rounded-xl p-4 bg-gray-50">
          <textarea className="input bg-white text-sm resize-none h-28"
            placeholder="Descreva o objeto do documento..."
            value={objeto} onChange={e => setObjeto(e.target.value)} />
        </div>
      </div>
      <PainelConfirmacao
        dataContrato={dataContrato} setDataContrato={setDataContrato}
        cidadeAssinatura={cidadeAssinatura} setCidadeAssinatura={setCidadeAssinatura}
        cidadeForo={cidadeForo} setCidadeForo={setCidadeForo}
        empresaDados={empresaDados} clausulas={clausulas}
        clausulasSel={clausulasSel} setClausulasSel={setClausulasSel}
        loading={loading} onBack={onBack} onGerarDocx={onGerarDocx} onGerarPdf={onGerarPdf}
      />
    </div>
  )
}
