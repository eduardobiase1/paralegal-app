'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

/* ─────────────────────────── types ─────────────────────────── */
interface Socio {
  nome: string
  genero: 'masculino' | 'feminino'
  nacionalidade: string
  naturalidade: string
  estado_civil: string
  regime_bens: string
  profissao: string
  cpf: string
  rg: string
  orgao_expedidor: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  percentual_quotas: string
  num_quotas: string
}

interface EmpresaLocal {
  id: string
  razao_social: string
  cnpj: string
  nire?: string
  sessao_junta?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  capital_social?: string
  capital_quotas?: string
  valor_quota?: string
  cnae_principal?: string
  natureza_juridica?: string
  data_abertura?: string
  qsa?: any[]
  objeto_social?: string
}

interface WizardState {
  // Step 1
  empresaId: string
  empresa: EmpresaLocal | null
  nire: string
  sessao_junta: string
  capital_social: string
  num_quotas: string
  valor_quota: string
  objeto_social: string
  data_contrato: string
  // Step 2
  socios: Socio[]
  adminTipo: 'socio' | 'nao_socio'
  adminIdx: number
  adminNaoSocio: Socio
  // Step 3
  assinatura: 'isolada' | 'conjunta'
  pro_labore: boolean
  pro_labore_valor: string
  lucros_desproporcionais: boolean
  arbitragem: boolean
  cidade_foro: string
  // Step 4
  textoContrato: string
}

const EMPTY_SOCIO: Socio = {
  nome: '', genero: 'masculino', nacionalidade: 'brasileiro(a)',
  naturalidade: '', estado_civil: 'solteiro(a)', regime_bens: '',
  profissao: '', cpf: '', rg: '', orgao_expedidor: '',
  logradouro: '', numero: '', complemento: '', bairro: '',
  cidade: '', uf: '', cep: '',
  percentual_quotas: '100', num_quotas: '',
}

const ESTADOS_CIVIS = ['solteiro(a)', 'casado(a)', 'divorciado(a)', 'viúvo(a)', 'união estável']
const REGIMES_BENS = ['comunhão parcial de bens', 'comunhão universal de bens', 'separação total de bens', 'participação final nos aquestos']
const NACIONALIDADES = ['brasileiro(a)', 'estrangeiro(a) residente no Brasil']

/* ─────────────────────────── helpers ─────────────────────────── */
function fmtCNPJ(v: string) {
  const d = v.replace(/\D/g, '')
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function fmtCPF(v: string) {
  const d = v.replace(/\D/g, '')
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

function fmtBRL(v: string | number | undefined) {
  if (!v) return 'R$ 0,00'
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^\d,]/g, '').replace(',', '.')) : v
  return isNaN(n) ? String(v) : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataExtenso(iso?: string): string {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${a}`
}

function numeroExtenso(n: number): string {
  const u = ['','um','dois','três','quatro','cinco','seis','sete','oito','nove',
             'dez','onze','doze','treze','catorze','quinze','dezesseis','dezessete','dezoito','dezenove']
  const d = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa']
  const c = ['','cem','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos']
  if (n === 0) return 'zero'
  if (n === 100) return 'cem'
  if (n < 20) return u[n]
  if (n < 100) {
    const dz = Math.floor(n/10), un = n%10
    return d[dz] + (un ? ' e ' + u[un] : '')
  }
  if (n < 1000) {
    const ct = Math.floor(n/100), rest = n%100
    const ctStr = n === 100 ? 'cem' : c[ct]
    return ctStr + (rest ? ' e ' + numeroExtenso(rest) : '')
  }
  if (n < 1000000) {
    const mil = Math.floor(n/1000), rest = n%1000
    const milStr = mil === 1 ? 'mil' : numeroExtenso(mil) + ' mil'
    return milStr + (rest ? (rest < 100 ? ' e ' : ', ') + numeroExtenso(rest) : '')
  }
  return n.toLocaleString('pt-BR')
}

function capitalExtenso(valor: string): string {
  const v = parseFloat(valor?.replace(/[^\d,]/g, '').replace(',', '.') || '0')
  if (isNaN(v) || v === 0) return ''
  const inteiro = Math.floor(v)
  const centavos = Math.round((v - inteiro) * 100)
  let texto = numeroExtenso(inteiro) + (inteiro === 1 ? ' real' : ' reais')
  if (centavos > 0) texto += ' e ' + numeroExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos')
  return texto
}

/* ─────────────────────────── contract assembly ─────────────────────────── */
function montarTextoContrato(s: WizardState): string {
  const { empresa, socios, nire, sessao_junta, capital_social, num_quotas, valor_quota,
          objeto_social, data_contrato, adminTipo, adminIdx, adminNaoSocio,
          assinatura, pro_labore, pro_labore_valor, lucros_desproporcionais, arbitragem, cidade_foro } = s

  if (!empresa) return ''

  const cnpjFmt = fmtCNPJ(empresa.cnpj)
  const capitalFmt = fmtBRL(capital_social)
  const capitalPorExtenso = capitalExtenso(capital_social)
  const qtdQuotas = parseInt(num_quotas) || 0
  const quotasPorExtenso = numeroExtenso(qtdQuotas)
  const valorQuotaFmt = fmtBRL(valor_quota)
  const dataFmt = dataExtenso(data_contrato)
  const cidadeSede = empresa.cidade || ''
  const ufSede = empresa.uf || ''

  const admin = adminTipo === 'socio' ? socios[adminIdx] : adminNaoSocio
  const adminNome = admin?.nome || '_______________'
  const adminCPF = admin?.cpf ? fmtCPF(admin.cpf) : '_______________'

  const enderecoSede = [
    empresa.logradouro, empresa.numero && `nº ${empresa.numero}`,
    empresa.complemento, empresa.bairro, empresa.cidade, empresa.uf,
  ].filter(Boolean).join(', ')

  // Qualificação dos sócios
  const qualificacaoSocios = socios.map((sc, i) => {
    const artigoSocio = sc.genero === 'feminino' ? 'a sócia' : 'o sócio'
    const regimeBens = sc.estado_civil === 'casado(a)' && sc.regime_bens
      ? `, casado(a) sob o regime de ${sc.regime_bens}` : ''
    const qtdSc = parseInt(sc.num_quotas) || 0
    const percSc = parseFloat(sc.percentual_quotas) || 100
    return `${artigoSocio} ${sc.nome || '_______________'}, ${sc.nacionalidade}, ${sc.estado_civil}${regimeBens}, ${sc.profissao || 'empresário(a)'}, inscrito(a) no CPF sob nº ${sc.cpf ? fmtCPF(sc.cpf) : '_____________'}, portador(a) do RG nº ${sc.rg || '_____________'} ${sc.orgao_expedidor ? `expedido pela(o) ${sc.orgao_expedidor}` : ''}, residente e domiciliado(a) na ${[sc.logradouro, sc.numero && `nº ${sc.numero}`, sc.bairro, sc.cidade, sc.uf].filter(Boolean).join(', ') || '_______________'}, detentor(a) de ${numeroExtenso(qtdSc)} (${qtdSc}) quotas, correspondentes a ${percSc}% do capital social`
  }).join(';\n')

  // Administrador não sócio
  const adminNaoSocioQualif = adminTipo === 'nao_socio' && admin ? `\n\nO administrador não sócio ${admin.nome}, ${admin.nacionalidade}, ${admin.estado_civil}, ${admin.profissao || 'administrador'}, inscrito(a) no CPF sob nº ${admin.cpf ? fmtCPF(admin.cpf) : '_______________'}, portador(a) do RG nº ${admin.rg || '_______________'}, residente e domiciliado(a) na ${[admin.logradouro, admin.numero && `nº ${admin.numero}`, admin.bairro, admin.cidade, admin.uf].filter(Boolean).join(', ') || '_______________'}.` : ''

  // Assinatura
  const assinaturaTexto = assinatura === 'conjunta'
    ? 'A administração da sociedade será exercida de forma conjunta, sendo necessária a assinatura de todos os administradores para a prática de quaisquer atos em nome da sociedade.'
    : 'A administração da sociedade será exercida de forma isolada pelo administrador, podendo o mesmo praticar todos os atos necessários à gestão da sociedade de forma individual.'

  // Pró-labore
  const proLaboreClausula = pro_labore ? `

CLÁUSULA NONA – DA REMUNERAÇÃO DO ADMINISTRADOR

Pelo exercício das funções de administrador, ${adminNome} receberá a título de pró-labore o valor mensal de ${fmtBRL(pro_labore_valor)} (${capitalExtenso(pro_labore_valor || '0')}), sujeito às contribuições previdenciárias e tributárias cabíveis.` : ''

  // Lucros desproporcionais
  const lucrosClausula = lucros_desproporcionais ? `

CLÁUSULA ${pro_labore ? 'DÉCIMA' : 'NONA'} – DA DISTRIBUIÇÃO DESPROPORCIONAL DE LUCROS

Os sócios poderão deliberar pela distribuição desproporcional de lucros, independentemente do percentual de participação no capital social, desde que aprovada em reunião ou assembleia de sócios, nos termos do art. 1.007 do Código Civil.` : ''

  // Arbitragem
  const arbitragemClausula = arbitragem ? `

CLÁUSULA DE ARBITRAGEM

As partes elegem a arbitragem como método preferencial para a solução de controvérsias oriundas ou relacionadas ao presente contrato social, nos termos da Lei nº 9.307/1996. O procedimento arbitral será conduzido conforme regulamento a ser acordado entre as partes, sendo competente a Câmara de Arbitragem com sede em ${cidade_foro || cidadeSede || 'São Paulo'}.` : ''

  const foroClausula = !arbitragem ? `O foro da Comarca de ${cidade_foro || cidadeSede || '_______________'}, ${ufSede}, será o competente para dirimir quaisquer dúvidas ou litígios oriundos do presente contrato.` : `Subsidiariamente, fica eleito o foro da Comarca de ${cidade_foro || cidadeSede || '_______________'}, ${ufSede}.`

  return `CONTRATO SOCIAL
SOCIEDADE LIMITADA UNIPESSOAL

${empresa.razao_social}
CNPJ: ${cnpjFmt}


CLÁUSULA PRIMEIRA – DA DENOMINAÇÃO, TIPO SOCIETÁRIO, SEDE E PRAZO DE DURAÇÃO

${socios[0]?.nome ? socios[0].nome.toUpperCase() : '_______________'}, por meio deste instrumento, constitui uma Sociedade Limitada Unipessoal, que se regerá pelas disposições do Código Civil Brasileiro (Lei nº 10.406/2002) e pelas cláusulas a seguir estipuladas.

A sociedade adotará a denominação ${empresa.razao_social.toUpperCase()}, com sede e domicílio principal na ${enderecoSede || '_______________'}, inscrita no CNPJ sob nº ${cnpjFmt}${nire ? `, com NIRE nº ${nire}` : ''}${sessao_junta ? `, registrada na ${sessao_junta}` : ''}.

O prazo de duração da sociedade é indeterminado.


CLÁUSULA SEGUNDA – DO OBJETO SOCIAL

A sociedade tem por objeto social: ${objeto_social || empresa.cnae_principal || '_______________'}.


CLÁUSULA TERCEIRA – DO CAPITAL SOCIAL

O capital social é de ${capitalFmt} (${capitalPorExtenso}), dividido em ${qtdQuotas > 0 ? `${qtdQuotas.toLocaleString('pt-BR')} (${quotasPorExtenso})` : '___'} quotas de valor nominal de ${valorQuotaFmt} cada uma, totalmente integralizadas em moeda corrente nacional neste ato.


CLÁUSULA QUARTA – DO SÓCIO ÚNICO

O capital social pertence integralmente ao sócio único:

${qualificacaoSocios}.${adminNaoSocioQualif}


CLÁUSULA QUINTA – DA ADMINISTRAÇÃO

A administração da sociedade será exercida pelo(a) sócio(a) ${adminNome}, inscrito(a) no CPF sob nº ${adminCPF}, com poderes para representar a sociedade ativa e passivamente, judicial e extrajudicialmente, podendo, para tanto, praticar todos os atos necessários à gestão social.

${assinaturaTexto}

O mandato do administrador é por prazo indeterminado, podendo ser revogado a qualquer tempo mediante ato escrito.


CLÁUSULA SEXTA – DOS PODERES DO ADMINISTRADOR

O administrador tem poderes para, em nome da sociedade: (i) assinar contratos e documentos; (ii) abrir, movimentar e encerrar contas bancárias; (iii) emitir, aceitar, endossar e descontar títulos de crédito; (iv) contratar e dispensar empregados; (v) representar a sociedade em juízo ou fora dele; (vi) adquirir, alienar e onerar bens; (vii) praticar todos os demais atos de gestão.


CLÁUSULA SÉTIMA – DOS LUCROS E RETIRADAS

Os lucros e perdas apurados no balanço anual serão distribuídos proporcionalmente às quotas detidas pelo sócio único, salvo deliberação em contrário nos termos da lei.${lucrosClausula}


CLÁUSULA OITAVA – DA RESPONSABILIDADE DO SÓCIO

A responsabilidade do sócio único é limitada ao valor de suas quotas, nos termos do art. 1.052 do Código Civil, exceto nas hipóteses legais de desconsideração da personalidade jurídica.${proLaboreClausula}${arbitragemClausula}

CLÁUSULA SOBRE O FORO

${foroClausula}


CLÁUSULA TRANSITÓRIA

Este contrato social entra em vigor na data de seu registro na Junta Comercial competente.


E, por estarem assim justos e acordados, firmam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença de 2 (duas) testemunhas.


${cidadeSede || '_______________'}, ${dataFmt || '___ de ___ de ____'}.



________________________________________
${socios[0]?.nome?.toUpperCase() || '_______________'}
Sócio(a) Único(a) e Administrador(a)
CPF: ${socios[0]?.cpf ? fmtCPF(socios[0].cpf) : '_______________'}


TESTEMUNHAS:

1. ______________________________    2. ______________________________
   Nome:                                Nome:
   CPF:                                 CPF:
`
}

/* ─────────────────────────── export helpers ─────────────────────────── */
async function exportarDOCX(texto: string, razaoSocial: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')

  const linhas = texto.split('\n')
  const paragrafos = linhas.map(linha => {
    const isHeading = /^CLÁUSULA\s+[A-Z]/.test(linha) || linha === 'CONTRATO SOCIAL' || linha === 'SOCIEDADE LIMITADA UNIPESSOAL'
    return new Paragraph({
      children: [new TextRun({
        text: linha,
        bold: isHeading,
        size: 24,
        font: 'Times New Roman',
      })],
      alignment: isHeading ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
      spacing: { after: linha === '' ? 0 : 160 },
      heading: isHeading && linha === 'CONTRATO SOCIAL' ? HeadingLevel.HEADING_1 : undefined,
    })
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 907, bottom: 1134, left: 1134 },
        },
      },
      children: paragrafos,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Contrato_Social_${razaoSocial.replace(/\s+/g, '_')}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

async function exportarPDF(texto: string, razaoSocial: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = 210, marginL = 25, marginR = 25, marginT = 25, marginB = 25
  const usableW = pageW - marginL - marginR
  let y = marginT

  doc.setFont('times', 'normal')
  doc.setFontSize(12)

  const linhas = texto.split('\n')
  for (const linha of linhas) {
    if (y > 280 - marginB) { doc.addPage(); y = marginT }

    const isHeading = /^CLÁUSULA\s+[A-Z]/.test(linha) || linha === 'CONTRATO SOCIAL' || linha === 'SOCIEDADE LIMITADA UNIPESSOAL'
    if (isHeading) doc.setFont('times', 'bold')
    else doc.setFont('times', 'normal')

    if (linha === '') { y += 4; continue }

    const splitLines = doc.splitTextToSize(linha, usableW)
    for (const sl of splitLines) {
      if (y > 280 - marginB) { doc.addPage(); y = marginT }
      doc.text(sl, isHeading ? pageW / 2 : marginL, y, { align: isHeading ? 'center' : 'left' })
      y += 6
    }
    y += 2
  }

  doc.save(`Contrato_Social_${razaoSocial.replace(/\s+/g, '_')}.pdf`)
}

/* ─────────────────────────── step components ─────────────────────────── */
function StepIndicator({ step, total }: { step: number; total: number }) {
  const steps = ['Empresa', 'Sócios', 'Cláusulas', 'Preview', 'Exportar']
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-2">
      {steps.slice(0, total).map((label, i) => (
        <div key={i} className="flex items-center flex-shrink-0">
          <div className={`flex flex-col items-center gap-1`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i + 1 < step ? 'bg-green-500 text-white' :
              i + 1 === step ? 'bg-slate-900 text-white' :
              'bg-slate-100 text-slate-400'
            }`}>
              {i + 1 < step ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] font-medium ${i + 1 === step ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
          </div>
          {i < total - 1 && <div className={`h-0.5 w-8 md:w-16 mx-1 mb-4 flex-shrink-0 ${i + 1 < step ? 'bg-green-500' : 'bg-slate-100'}`} />}
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────── main wizard ─────────────────────────── */
export default function SLUWizard() {
  const [supabase] = useState(createClient)
  const [step, setStep] = useState(1)
  const [empresas, setEmpresas] = useState<EmpresaLocal[]>([])
  const [loadingEmpresas, setLoadingEmpresas] = useState(true)
  const [exporting, setExporting] = useState<'docx' | 'pdf' | null>(null)

  const [state, setState] = useState<WizardState>({
    empresaId: '',
    empresa: null,
    nire: '',
    sessao_junta: '',
    capital_social: '',
    num_quotas: '',
    valor_quota: '',
    objeto_social: '',
    data_contrato: new Date().toISOString().split('T')[0],
    socios: [{ ...EMPTY_SOCIO }],
    adminTipo: 'socio',
    adminIdx: 0,
    adminNaoSocio: { ...EMPTY_SOCIO },
    assinatura: 'isolada',
    pro_labore: false,
    pro_labore_valor: '',
    lucros_desproporcionais: false,
    arbitragem: false,
    cidade_foro: '',
    textoContrato: '',
  })

  function upd(partial: Partial<WizardState>) {
    setState(p => ({ ...p, ...partial }))
  }

  useEffect(() => {
    supabase.from('empresas')
      .select('id,razao_social,cnpj,nire,sessao_junta,logradouro,numero,complemento,bairro,cidade,uf,capital_social,capital_quotas,valor_quota,cnae_principal,natureza_juridica,data_abertura,qsa,objeto_social')
      .order('razao_social')
      .then(({ data }) => {
        setEmpresas((data as any[]) ?? [])
        setLoadingEmpresas(false)
      })
  }, [])

  function selecionarEmpresa(id: string) {
    const emp = empresas.find(e => e.id === id)
    if (!emp) { upd({ empresaId: id, empresa: null }); return }

    // Pre-populate socios from QSA
    let socios = state.socios
    if (emp.qsa && emp.qsa.length > 0) {
      socios = emp.qsa.map((q: any) => ({
        ...EMPTY_SOCIO,
        nome: q.nome || q.nome_socio || '',
      }))
    }

    upd({
      empresaId: id,
      empresa: emp,
      nire: emp.nire || '',
      sessao_junta: emp.sessao_junta || '',
      capital_social: emp.capital_social || '',
      num_quotas: emp.capital_quotas || '',
      valor_quota: emp.valor_quota || '',
      objeto_social: (emp as any).objeto_social || '',
      socios,
    })
  }

  function updateSocio(idx: number, field: keyof Socio, value: string) {
    const updated = [...state.socios]
    updated[idx] = { ...updated[idx], [field]: value }
    upd({ socios: updated })
  }

  function gerarPreview() {
    const texto = montarTextoContrato(state)
    upd({ textoContrato: texto })
    setStep(4)
  }

  async function handleExportDOCX() {
    if (!state.empresa) return
    setExporting('docx')
    try {
      await exportarDOCX(state.textoContrato, state.empresa.razao_social)
      toast.success('DOCX exportado com sucesso!')
    } catch (e) {
      console.error(e); toast.error('Erro ao exportar DOCX')
    }
    setExporting(null)
  }

  async function handleExportPDF() {
    if (!state.empresa) return
    setExporting('pdf')
    try {
      await exportarPDF(state.textoContrato, state.empresa.razao_social)
      toast.success('PDF exportado com sucesso!')
    } catch (e) {
      console.error(e); toast.error('Erro ao exportar PDF')
    }
    setExporting(null)
  }

  /* ── STEP 1 ── */
  const renderStep1 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Selecione a Empresa</h2>
        <p className="text-sm text-slate-500">Os dados cadastrais serão preenchidos automaticamente.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Empresa *</label>
        {loadingEmpresas ? (
          <div className="input flex items-center gap-2 text-slate-400"><span className="animate-spin text-base">⟳</span> Carregando...</div>
        ) : (
          <select className="input" value={state.empresaId} onChange={e => selecionarEmpresa(e.target.value)}>
            <option value="">— Selecione —</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.razao_social}</option>
            ))}
          </select>
        )}
      </div>

      {state.empresa && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">CNPJ</label>
              <input className="input bg-slate-50" readOnly value={fmtCNPJ(state.empresa.cnpj)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Natureza Jurídica</label>
              <input className="input bg-slate-50" readOnly value={state.empresa.natureza_juridica || 'Sociedade Limitada Unipessoal'} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">NIRE</label>
              <input className="input" placeholder="Nº de Identificação do Registro de Empresa" value={state.nire}
                onChange={e => upd({ nire: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Sessão da Junta Comercial</label>
              <input className="input" placeholder="Ex: JUCESP – 1ª Seção" value={state.sessao_junta}
                onChange={e => upd({ sessao_junta: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Objeto Social</label>
            <textarea className="input resize-none h-20" placeholder="Descreva as atividades da empresa..."
              value={state.objeto_social}
              onChange={e => upd({ objeto_social: e.target.value })} />
            {!state.objeto_social && state.empresa.cnae_principal && (
              <button className="text-xs text-blue-600 hover:underline mt-1"
                onClick={() => upd({ objeto_social: state.empresa!.cnae_principal! })}>
                ← Usar CNAE principal: {state.empresa.cnae_principal}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Capital Social (R$)</label>
              <input className="input" placeholder="Ex: 10000.00" value={state.capital_social}
                onChange={e => upd({ capital_social: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Nº de Quotas</label>
              <input className="input" type="number" min="1" placeholder="Ex: 100" value={state.num_quotas}
                onChange={e => upd({ num_quotas: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Valor por Quota (R$)</label>
              <input className="input" placeholder="Ex: 100.00" value={state.valor_quota}
                onChange={e => upd({ valor_quota: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Data do Contrato</label>
            <input className="input" type="date" value={state.data_contrato}
              onChange={e => upd({ data_contrato: e.target.value })} />
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600">
            <p className="font-semibold text-slate-700 mb-1">Endereço da Sede (do cadastro)</p>
            <p>{[state.empresa.logradouro, state.empresa.numero && `nº ${state.empresa.numero}`, state.empresa.bairro, state.empresa.cidade, state.empresa.uf].filter(Boolean).join(', ') || '—'}</p>
          </div>
        </>
      )}

      <div className="flex justify-end pt-2">
        <button className="btn-primary" disabled={!state.empresaId}
          onClick={() => setStep(2)}>
          Próximo: Sócios →
        </button>
      </div>
    </div>
  )

  /* ── STEP 2 ── */
  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Qualificação do Sócio Único</h2>
        <p className="text-sm text-slate-500">Preencha os dados pessoais completos que constarão no contrato.</p>
      </div>

      {state.socios.map((socio, i) => (
        <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-700 text-sm">Sócio {i + 1}</h3>
            {state.socios.length > 1 && (
              <button className="text-xs text-red-500 hover:text-red-700"
                onClick={() => upd({ socios: state.socios.filter((_, j) => j !== i) })}>
                Remover
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Nome Completo *</label>
              <input className="input" placeholder="Nome completo conforme RG" value={socio.nome}
                onChange={e => updateSocio(i, 'nome', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Gênero</label>
              <select className="input" value={socio.genero} onChange={e => updateSocio(i, 'genero', e.target.value)}>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Nacionalidade</label>
              <select className="input" value={socio.nacionalidade} onChange={e => updateSocio(i, 'nacionalidade', e.target.value)}>
                {NACIONALIDADES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Naturalidade (cidade/UF)</label>
              <input className="input" placeholder="Ex: São Paulo/SP" value={socio.naturalidade}
                onChange={e => updateSocio(i, 'naturalidade', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Estado Civil</label>
              <select className="input" value={socio.estado_civil} onChange={e => updateSocio(i, 'estado_civil', e.target.value)}>
                {ESTADOS_CIVIS.map(ec => <option key={ec} value={ec}>{ec}</option>)}
              </select>
            </div>
            {(socio.estado_civil === 'casado(a)' || socio.estado_civil === 'união estável') && (
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Regime de Bens</label>
                <select className="input" value={socio.regime_bens} onChange={e => updateSocio(i, 'regime_bens', e.target.value)}>
                  <option value="">— Selecione —</option>
                  {REGIMES_BENS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Profissão</label>
              <input className="input" placeholder="Ex: empresário(a)" value={socio.profissao}
                onChange={e => updateSocio(i, 'profissao', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">CPF</label>
              <input className="input" placeholder="000.000.000-00" value={socio.cpf}
                onChange={e => updateSocio(i, 'cpf', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">RG</label>
              <input className="input" placeholder="Número do RG" value={socio.rg}
                onChange={e => updateSocio(i, 'rg', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Órgão Expedidor</label>
              <input className="input" placeholder="Ex: SSP/SP" value={socio.orgao_expedidor}
                onChange={e => updateSocio(i, 'orgao_expedidor', e.target.value)} />
            </div>
          </div>

          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide pt-1">Endereço Residencial</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <input className="input" placeholder="Logradouro" value={socio.logradouro}
                onChange={e => updateSocio(i, 'logradouro', e.target.value)} />
            </div>
            <div>
              <input className="input" placeholder="Número" value={socio.numero}
                onChange={e => updateSocio(i, 'numero', e.target.value)} />
            </div>
            <div>
              <input className="input" placeholder="Complemento" value={socio.complemento}
                onChange={e => updateSocio(i, 'complemento', e.target.value)} />
            </div>
            <div>
              <input className="input" placeholder="Bairro" value={socio.bairro}
                onChange={e => updateSocio(i, 'bairro', e.target.value)} />
            </div>
            <div>
              <input className="input" placeholder="Cidade" value={socio.cidade}
                onChange={e => updateSocio(i, 'cidade', e.target.value)} />
            </div>
            <div>
              <input className="input" placeholder="UF" value={socio.uf} maxLength={2}
                onChange={e => updateSocio(i, 'uf', e.target.value.toUpperCase())} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Nº de Quotas</label>
              <input className="input" type="number" min="0" placeholder="Ex: 100" value={socio.num_quotas}
                onChange={e => updateSocio(i, 'num_quotas', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">% do Capital</label>
              <input className="input" type="number" min="0" max="100" placeholder="100" value={socio.percentual_quotas}
                onChange={e => updateSocio(i, 'percentual_quotas', e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      <div>
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Administrador(a)</p>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="adminTipo" value="socio" checked={state.adminTipo === 'socio'}
              onChange={() => upd({ adminTipo: 'socio' })} className="accent-slate-800" />
            <span className="text-sm text-slate-700">O próprio sócio único</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="adminTipo" value="nao_socio" checked={state.adminTipo === 'nao_socio'}
              onChange={() => upd({ adminTipo: 'nao_socio' })} className="accent-slate-800" />
            <span className="text-sm text-slate-700">Administrador não sócio</span>
          </label>
        </div>
      </div>

      {state.adminTipo === 'nao_socio' && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-bold text-blue-800">Dados do Administrador Não Sócio</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(['nome', 'nacionalidade', 'estado_civil', 'profissao', 'cpf', 'rg', 'logradouro', 'cidade', 'uf'] as (keyof Socio)[]).map(f => (
              <div key={f}>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">{f.replace('_', ' ')}</label>
                <input className="input" value={state.adminNaoSocio[f] as string}
                  onChange={e => upd({ adminNaoSocio: { ...state.adminNaoSocio, [f]: e.target.value } })} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button className="btn-secondary" onClick={() => setStep(1)}>← Anterior</button>
        <button className="btn-primary" disabled={!state.socios[0]?.nome}
          onClick={() => setStep(3)}>
          Próximo: Cláusulas →
        </button>
      </div>
    </div>
  )

  /* ── STEP 3 ── */
  const Toggle = ({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-slate-800' : 'bg-slate-200'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'left-7' : 'left-1'}`} />
      </button>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Configurações do Contrato</h2>
        <p className="text-sm text-slate-500">Defina as cláusulas opcionais e modalidades.</p>
      </div>

      <div className="space-y-3">
        <div className="p-4 border border-slate-200 rounded-xl">
          <p className="text-sm font-semibold text-slate-800 mb-3">Assinatura do Administrador</p>
          <div className="flex gap-4">
            {(['isolada', 'conjunta'] as const).map(op => (
              <label key={op} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="assinatura" value={op} checked={state.assinatura === op}
                  onChange={() => upd({ assinatura: op })} className="accent-slate-800" />
                <div>
                  <span className="text-sm font-medium text-slate-700 capitalize">{op}</span>
                  <p className="text-xs text-slate-400">{op === 'isolada' ? 'Administrador age individualmente' : 'Requer todos os administradores'}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Toggle
          label="Pró-Labore"
          desc="Incluir cláusula de remuneração do administrador"
          value={state.pro_labore}
          onChange={v => upd({ pro_labore: v })}
        />
        {state.pro_labore && (
          <div className="pl-4">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Valor Mensal do Pró-Labore (R$)</label>
            <input className="input max-w-xs" placeholder="Ex: 3000.00" value={state.pro_labore_valor}
              onChange={e => upd({ pro_labore_valor: e.target.value })} />
          </div>
        )}

        <Toggle
          label="Distribuição Desproporcional de Lucros"
          desc="Permite distribuir lucros em percentual diferente da participação societária"
          value={state.lucros_desproporcionais}
          onChange={v => upd({ lucros_desproporcionais: v })}
        />

        <Toggle
          label="Cláusula de Arbitragem"
          desc="Inclui arbitragem como método preferencial de resolução de conflitos (Lei 9.307/96)"
          value={state.arbitragem}
          onChange={v => upd({ arbitragem: v })}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Cidade do Foro (opcional)</label>
          <input className="input" placeholder={state.empresa?.cidade || 'Cidade para eleição de foro'}
            value={state.cidade_foro}
            onChange={e => upd({ cidade_foro: e.target.value })} />
          <p className="text-xs text-slate-400 mt-1">Se vazio, usa a cidade da sede da empresa.</p>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button className="btn-secondary" onClick={() => setStep(2)}>← Anterior</button>
        <button className="btn-primary" onClick={gerarPreview}>
          Gerar Preview →
        </button>
      </div>
    </div>
  )

  /* ── STEP 4 ── */
  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Preview do Contrato</h2>
          <p className="text-sm text-slate-500">Você pode editar o texto diretamente abaixo antes de exportar.</p>
        </div>
        <button className="text-xs text-blue-600 hover:underline flex-shrink-0"
          onClick={() => { upd({ textoContrato: montarTextoContrato(state) }); toast.success('Texto regenerado') }}>
          ↺ Regenerar
        </button>
      </div>

      <textarea
        className="w-full h-[500px] font-mono text-xs border border-slate-200 rounded-xl p-4 resize-y focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
        value={state.textoContrato}
        onChange={e => upd({ textoContrato: e.target.value })}
        spellCheck={false}
      />

      <div className="flex justify-between pt-2">
        <button className="btn-secondary" onClick={() => setStep(3)}>← Anterior</button>
        <button className="btn-primary" onClick={() => setStep(5)}>
          Próximo: Exportar →
        </button>
      </div>
    </div>
  )

  /* ── STEP 5 ── */
  const renderStep5 = () => {
    const emp = state.empresa
    const socio1 = state.socios[0]
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Resumo & Exportação</h2>
          <p className="text-sm text-slate-500">Revise o resumo e exporte o contrato no formato desejado.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Empresa</p>
            <p className="font-bold text-slate-800">{emp?.razao_social}</p>
            <p className="text-sm text-slate-600">CNPJ: {emp ? fmtCNPJ(emp.cnpj) : ''}</p>
            <p className="text-sm text-slate-600">Capital: {fmtBRL(state.capital_social)}</p>
            {state.nire && <p className="text-sm text-slate-600">NIRE: {state.nire}</p>}
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Sócio Único</p>
            <p className="font-bold text-slate-800">{socio1?.nome || '—'}</p>
            <p className="text-sm text-slate-600">CPF: {socio1?.cpf ? fmtCPF(socio1.cpf) : '—'}</p>
            <p className="text-sm text-slate-600">Estado civil: {socio1?.estado_civil || '—'}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Administração</p>
            <p className="text-sm text-slate-800">
              {state.adminTipo === 'socio' ? `Sócio único (${socio1?.nome || '—'})` : `Não sócio (${state.adminNaoSocio.nome || '—'})`}
            </p>
            <p className="text-sm text-slate-600">Assinatura: {state.assinatura}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cláusulas Opcionais</p>
            <p className="text-sm text-slate-600">Pró-labore: {state.pro_labore ? `Sim (${fmtBRL(state.pro_labore_valor)})` : 'Não'}</p>
            <p className="text-sm text-slate-600">Lucros desproporcionais: {state.lucros_desproporcionais ? 'Sim' : 'Não'}</p>
            <p className="text-sm text-slate-600">Arbitragem: {state.arbitragem ? 'Sim' : 'Não'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <button
            onClick={handleExportDOCX}
            disabled={exporting !== null}
            className="flex items-center justify-center gap-3 p-5 border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors disabled:opacity-50">
            {exporting === 'docx' ? (
              <span className="animate-spin text-xl">⟳</span>
            ) : (
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            <div className="text-left">
              <p className="font-bold text-blue-800">Exportar Word (.docx)</p>
              <p className="text-xs text-blue-600">Editável no Microsoft Word e LibreOffice</p>
            </div>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exporting !== null}
            className="flex items-center justify-center gap-3 p-5 border-2 border-red-200 bg-red-50 hover:bg-red-100 rounded-xl transition-colors disabled:opacity-50">
            {exporting === 'pdf' ? (
              <span className="animate-spin text-xl">⟳</span>
            ) : (
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
            <div className="text-left">
              <p className="font-bold text-red-800">Exportar PDF</p>
              <p className="text-xs text-red-600">Pronto para impressão e assinatura digital</p>
            </div>
          </button>
        </div>

        <div className="flex justify-between pt-2">
          <button className="btn-secondary" onClick={() => setStep(4)}>← Editar Texto</button>
          <button className="btn-secondary" onClick={() => {
            setState({
              empresaId: '', empresa: null, nire: '', sessao_junta: '',
              capital_social: '', num_quotas: '', valor_quota: '', objeto_social: '',
              data_contrato: new Date().toISOString().split('T')[0],
              socios: [{ ...EMPTY_SOCIO }], adminTipo: 'socio', adminIdx: 0,
              adminNaoSocio: { ...EMPTY_SOCIO }, assinatura: 'isolada',
              pro_labore: false, pro_labore_valor: '', lucros_desproporcionais: false,
              arbitragem: false, cidade_foro: '', textoContrato: '',
            })
            setStep(1)
            toast.success('Novo contrato iniciado')
          }}>Novo Contrato</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator step={step} total={5} />
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}
    </div>
  )
}
