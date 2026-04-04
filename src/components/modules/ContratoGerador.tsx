'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ContractTemplate, Empresa } from '@/types'
import { formatCNPJ } from '@/lib/utils'
import toast from 'react-hot-toast'

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
}

const EMPTY_SOCIO: Socio = {
  nome: '', genero: 'masculino', nacionalidade: 'brasileiro(a)',
  naturalidade: '', estado_civil: 'solteiro(a)', regime_bens: '',
  profissao: '', cpf: '', rg: '', orgao_expedidor: '',
  logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '',
  percentual_quotas: '',
}

const ESTADOS_CIVIS = ['solteiro(a)', 'casado(a)', 'divorciado(a)', 'viúvo(a)', 'união estável']
const REGIMES = ['comunhão parcial de bens', 'comunhão universal de bens', 'separação total de bens', 'participação final nos aquestos']

interface Props {
  template: ContractTemplate
  empresas: Empresa[]
  defaultEmpresaId?: string
  onSuccess: () => void
}

interface EmpresaDados {
  nire: string
  sessao_junta: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
}

export default function ContratoGerador({ template, empresas, defaultEmpresaId, onSuccess }: Props) {
  const [supabase] = useState(createClient)
  const [loading, setLoading] = useState(false)
  const [empresaId, setEmpresaId] = useState(defaultEmpresaId || '')
  const [socios, setSocios] = useState<Socio[]>([{ ...EMPTY_SOCIO }])
  const [empresaDados, setEmpresaDados] = useState<EmpresaDados>({
    nire: '', sessao_junta: '', logradouro: '', numero: '',
    complemento: '', bairro: '', cidade: '', uf: '', cep: '',
  })

  const empresa = empresas.find(e => e.id === empresaId)

  function handleEmpresaChange(id: string) {
    setEmpresaId(id)
    const emp = empresas.find(e => e.id === id)
    if (emp) {
      setEmpresaDados({
        nire: (emp as any).nire ?? '',
        sessao_junta: (emp as any).sessao_junta ?? '',
        logradouro: emp.logradouro ?? '',
        numero: emp.numero ?? '',
        complemento: emp.complemento ?? '',
        bairro: emp.bairro ?? '',
        cidade: emp.cidade ?? '',
        uf: emp.uf ?? '',
        cep: emp.cep ?? '',
      })
    }
  }

  function setEmpresaField(field: keyof EmpresaDados, value: string) {
    setEmpresaDados(prev => ({ ...prev, [field]: value }))
  }

  function addSocio() { setSocios(prev => [...prev, { ...EMPTY_SOCIO }]) }
  function removeSocio(i: number) { setSocios(prev => prev.filter((_, idx) => idx !== i)) }
  function setSocioField(i: number, field: keyof Socio, value: string) {
    setSocios(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  function buildVariaveis(): Record<string, string> {
    if (!empresa) return {}

    const vars: Record<string, string> = {
      razao_social: empresa.razao_social,
      nome_fantasia: empresa.nome_fantasia ?? '',
      cnpj: formatCNPJ(empresa.cnpj),
      inscricao_estadual: empresa.inscricao_estadual ?? '',
      inscricao_municipal: empresa.inscricao_municipal ?? '',
      logradouro: empresaDados.logradouro,
      numero: empresaDados.numero,
      complemento: empresaDados.complemento,
      bairro: empresaDados.bairro,
      cidade: empresaDados.cidade,
      uf: empresaDados.uf,
      cep: empresaDados.cep,
      nire: empresaDados.nire,
      sessao_junta: empresaDados.sessao_junta,
    }

    // Sócios
    socios.forEach((s, i) => {
      const n = i + 1
      const generoStr = s.genero === 'feminino' ? 'feminino' : 'masculino'
      const artigo = s.genero === 'feminino' ? 'a sócia' : 'o sócio'
      const nac = s.nacionalidade.replace('(a)', s.genero === 'feminino' ? 'a' : 'o')

      vars[`socio_${n}_nome`] = s.nome
      vars[`socio_${n}_genero`] = generoStr
      vars[`socio_${n}_artigo`] = artigo
      vars[`socio_${n}_nacionalidade`] = nac
      vars[`socio_${n}_naturalidade`] = s.naturalidade
      vars[`socio_${n}_estado_civil`] = s.estado_civil
      vars[`socio_${n}_regime_bens`] = ['casado(a)', 'união estável'].includes(s.estado_civil) ? s.regime_bens : ''
      vars[`socio_${n}_profissao`] = s.profissao
      vars[`socio_${n}_cpf`] = s.cpf
      vars[`socio_${n}_rg`] = s.rg
      vars[`socio_${n}_orgao_expedidor`] = s.orgao_expedidor
      vars[`socio_${n}_logradouro`] = s.logradouro
      vars[`socio_${n}_numero`] = s.numero
      vars[`socio_${n}_complemento`] = s.complemento
      vars[`socio_${n}_bairro`] = s.bairro
      vars[`socio_${n}_cidade`] = s.cidade
      vars[`socio_${n}_uf`] = s.uf
      vars[`socio_${n}_cep`] = s.cep
      vars[`socio_${n}_percentual`] = s.percentual_quotas

      // estado civil completo com regime
      const ecCompleto = ['casado(a)', 'união estável'].includes(s.estado_civil) && s.regime_bens
        ? `${s.estado_civil} sob o regime de ${s.regime_bens}`
        : s.estado_civil
      vars[`socio_${n}_estado_civil_completo`] = ecCompleto
    })

    vars['total_socios'] = socios.length.toString()
    vars['socio_unico'] = socios.length === 1 ? 'sim' : 'não'

    return vars
  }

  async function handleGerar() {
    if (!empresaId) { toast.error('Selecione uma empresa'); return }
    if (socios.some(s => !s.nome)) { toast.error('Preencha o nome de todos os sócios'); return }

    setLoading(true)

    try {
      // Baixar o template
      const resp = await fetch(template.arquivo_url)
      if (!resp.ok) throw new Error('Erro ao baixar template')
      const arrayBuffer = await resp.arrayBuffer()

      const JSZip = (await import('jszip')).default
      const { saveAs } = await import('file-saver')

      const variaveis = buildVariaveis()

      // Abrir o docx como ZIP e substituir marcadores no XML
      const zip = await JSZip.loadAsync(arrayBuffer)

      const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml',
                        'word/header2.xml', 'word/footer2.xml', 'word/header3.xml', 'word/footer3.xml']

      for (const fileName of xmlFiles) {
        const file = zip.file(fileName)
        if (!file) continue
        let xml = await file.async('string')

        // 1. Remover tags de verificação ortográfica do Word (proofErr)
        //    que dividem marcadores {{...}} em runs XML separados
        xml = xml.replace(/<w:proofErr[^>]*\/>/g, '')

        // 2. Mesclar runs adjacentes sem formatação
        //    Isso une os fragmentos: {{ + variavel + }} que ficaram em runs separados
        let prev: string
        do {
          prev = xml
          xml = xml.replace(/<\/w:t><\/w:r><w:r><w:t(?:\s+xml:space="preserve")?>/g, '')
        } while (xml !== prev)

        // 3. Substituir os marcadores {{variavel}} pelos valores reais
        for (const [key, value] of Object.entries(variaveis)) {
          const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          xml = xml.split(`{{${key}}}`).join(escaped)
        }
        zip.file(fileName, xml)
      }

      const newDocx = await zip.generateAsync({ type: 'arraybuffer' })
      const blob = new Blob([newDocx], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      const nomeArquivo = `${empresa?.razao_social ?? 'contrato'}_${template.nome}_${new Date().toISOString().split('T')[0]}.docx`
        .replace(/[^a-zA-Z0-9_.\-]/g, '_')

      saveAs(blob, nomeArquivo)

      // Salvar no histórico
      await supabase.from('contratos').insert({
        empresa_id: empresaId,
        template_nome: template.nome,
        dados_json: variaveis,
        arquivo_nome: nomeArquivo,
      })

      toast.success('Contrato gerado e baixado!')
      onSuccess()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao gerar contrato: ' + (err.message ?? 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  const precisaRegime = (s: Socio) => ['casado(a)', 'união estável'].includes(s.estado_civil)

  return (
    <div className="space-y-6">
      {/* Empresa */}
      <div>
        <label className="label">Empresa *</label>
        <select className="input" value={empresaId} onChange={e => handleEmpresaChange(e.target.value)}>
          <option value="">Selecione...</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
        </select>
      </div>

      {/* Dados da Empresa */}
      {empresaId && empresa && (
        <div className="border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Dados da Empresa</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Razão Social</label>
              <input className="input bg-gray-50" readOnly value={empresa.razao_social} />
            </div>
            <div>
              <label className="label text-xs">CNPJ</label>
              <input className="input bg-gray-50 font-mono" readOnly value={formatCNPJ(empresa.cnpj)} />
            </div>
            <div>
              <label className="label text-xs">NIRE</label>
              <input className="input" value={empresaDados.nire}
                onChange={e => setEmpresaField('nire', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Sessão da Junta</label>
              <input className="input" placeholder="Ex: 10/03/2021"
                value={empresaDados.sessao_junta}
                onChange={e => setEmpresaField('sessao_junta', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label text-xs">Logradouro</label>
              <input className="input" value={empresaDados.logradouro}
                onChange={e => setEmpresaField('logradouro', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Número</label>
              <input className="input" value={empresaDados.numero}
                onChange={e => setEmpresaField('numero', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Complemento</label>
              <input className="input" value={empresaDados.complemento}
                onChange={e => setEmpresaField('complemento', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Bairro</label>
              <input className="input" value={empresaDados.bairro}
                onChange={e => setEmpresaField('bairro', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Cidade</label>
              <input className="input" value={empresaDados.cidade}
                onChange={e => setEmpresaField('cidade', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">UF</label>
              <input className="input" value={empresaDados.uf}
                onChange={e => setEmpresaField('uf', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">CEP</label>
              <input className="input" value={empresaDados.cep}
                onChange={e => setEmpresaField('cep', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Sócios */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Sócios</h3>
          <button type="button" onClick={addSocio} className="btn-secondary text-xs py-1.5 px-3">
            + Adicionar Sócio
          </button>
        </div>

        <div className="space-y-4">
          {socios.map((socio, i) => (
            <div key={i} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-700">Sócio {i + 1}</h4>
                {socios.length > 1 && (
                  <button type="button" onClick={() => removeSocio(i)}
                    className="text-xs text-red-500 hover:text-red-700">Remover</button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label text-xs">Nome completo *</label>
                  <input className="input" required value={socio.nome}
                    onChange={e => setSocioField(i, 'nome', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Gênero</label>
                  <select className="input" value={socio.genero}
                    onChange={e => setSocioField(i, 'genero', e.target.value as any)}>
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Nacionalidade</label>
                  <input className="input" value={socio.nacionalidade}
                    onChange={e => setSocioField(i, 'nacionalidade', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Naturalidade (Cidade/UF)</label>
                  <input className="input" placeholder="Ex: São Paulo/SP" value={socio.naturalidade}
                    onChange={e => setSocioField(i, 'naturalidade', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Estado Civil</label>
                  <select className="input" value={socio.estado_civil}
                    onChange={e => setSocioField(i, 'estado_civil', e.target.value)}>
                    {ESTADOS_CIVIS.map(ec => <option key={ec} value={ec}>{ec}</option>)}
                  </select>
                </div>
                {precisaRegime(socio) && (
                  <div>
                    <label className="label text-xs">Regime de Bens</label>
                    <select className="input" value={socio.regime_bens}
                      onChange={e => setSocioField(i, 'regime_bens', e.target.value)}>
                      <option value="">Selecione...</option>
                      {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label text-xs">Profissão</label>
                  <input className="input" value={socio.profissao}
                    onChange={e => setSocioField(i, 'profissao', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">CPF</label>
                  <input className="input font-mono" value={socio.cpf}
                    onChange={e => setSocioField(i, 'cpf', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">RG</label>
                  <input className="input font-mono" value={socio.rg}
                    onChange={e => setSocioField(i, 'rg', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Órgão Expedidor</label>
                  <input className="input" placeholder="Ex: SSP/SP" value={socio.orgao_expedidor}
                    onChange={e => setSocioField(i, 'orgao_expedidor', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">% de Quotas</label>
                  <input className="input" placeholder="Ex: 50%" value={socio.percentual_quotas}
                    onChange={e => setSocioField(i, 'percentual_quotas', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">Logradouro</label>
                  <input className="input" placeholder="Ex: Rua das Flores" value={socio.logradouro}
                    onChange={e => setSocioField(i, 'logradouro', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Número</label>
                  <input className="input" value={socio.numero}
                    onChange={e => setSocioField(i, 'numero', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Complemento</label>
                  <input className="input" placeholder="Apto, sala..." value={socio.complemento}
                    onChange={e => setSocioField(i, 'complemento', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Bairro</label>
                  <input className="input" value={socio.bairro}
                    onChange={e => setSocioField(i, 'bairro', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Cidade</label>
                  <input className="input" value={socio.cidade}
                    onChange={e => setSocioField(i, 'cidade', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">UF</label>
                  <input className="input" placeholder="SP" value={socio.uf}
                    onChange={e => setSocioField(i, 'uf', e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">CEP</label>
                  <input className="input font-mono" placeholder="00000-000" value={socio.cep}
                    onChange={e => setSocioField(i, 'cep', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={handleGerar} className="btn-primary" disabled={loading}>
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Gerando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Gerar e Baixar .docx
            </>
          )}
        </button>
      </div>
    </div>
  )
}
