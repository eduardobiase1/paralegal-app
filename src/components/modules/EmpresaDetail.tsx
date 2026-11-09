'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Empresa, SEFAZ_URLS } from '@/types'
import HistoricoEmpresa from '@/components/modules/HistoricoEmpresa'
import { createClient } from '@/lib/supabase/client'
import { formatCNPJ, formatCEP, formatDate } from '@/lib/utils'
import { capitalExtenso, formatarReais, calcularCapitalSocial } from '@/lib/formatters'

interface Props {
  empresa: Empresa
}

// CNAE pode vir como string ou como objeto {codigo, descricao} dependendo de como foi salvo
function cnaeStr(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object') {
    const o = val as { codigo?: string; descricao?: string }
    if (o.descricao) return o.codigo ? `${o.codigo} - ${o.descricao}` : o.descricao
    return JSON.stringify(val)
  }
  return String(val)
}

function diasAte(d?: string | null): number | null {
  if (!d) return null
  const h = new Date(); h.setHours(0, 0, 0, 0)
  return Math.round((new Date(d.slice(0, 10) + 'T00:00:00').getTime() - h.getTime()) / 86400000)
}
function prazoTexto(d: number | null) {
  if (d === null) return ''
  if (d < 0) return `venceu há ${-d} dia${d === -1 ? '' : 's'}`
  if (d === 0) return 'vence hoje'
  return `em ${d} dia${d === 1 ? '' : 's'}`
}

type Linha = {
  chave: string
  nome: string
  orgao: string
  data: string | null
  pendente?: boolean
  situacao?: string
  portal?: string | null
  acao?: { label: string; href: string }
  naoCadastrado?: { href: string }
}

// Certidões mostradas na ficha, na mesma ordem da Visão Geral
const CERTIDOES: Array<{ tipo: string; nome: string; orgao: string }> = [
  { tipo: 'Federal',     nome: 'CND Federal',      orgao: 'Receita Federal / PGFN' },
  { tipo: 'Estadual',    nome: 'CND Estadual',     orgao: 'SEFAZ' },
  { tipo: 'FGTS',        nome: 'FGTS',             orgao: 'Caixa · CRF' },
  { tipo: 'Municipal',   nome: 'CND Municipal',    orgao: 'Prefeitura' },
  { tipo: 'Trabalhista', nome: 'CNDT Trabalhista', orgao: 'TST' },
]

const PENDENCIA_LABEL: Record<string, string> = {
  em_renovacao: 'Em renovação',
  aguardando_cliente: 'Aguardando cliente',
  vencida_aguardando: 'Vencida, aguardando',
}

export default function EmpresaDetail({ empresa: emp }: Props) {
  const e = emp as any
  const [supabase] = useState(createClient)
  const [carregando, setCarregando] = useState(true)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [processos, setProcessos] = useState<any[]>([])

  const endereco = [[emp.logradouro, emp.numero].filter(Boolean).join(', '), emp.complemento].filter(Boolean).join(' · ')
  const cidadeUf = [emp.cidade || e.municipio, emp.uf].filter(Boolean).join('/')
  const enderecoMapa = [endereco, emp.bairro, cidadeUf, emp.cep].filter(Boolean).join(', ')
  const nomeFantasia = emp.nome_fantasia && /[^*\s]/.test(emp.nome_fantasia) ? emp.nome_fantasia : ''
  const telDigitos = String(e.telefone || '').replace(/\D/g, '')

  useEffect(() => {
    async function carregar() {
      const [cert, alv, lic, cd, proc] = await Promise.all([
        supabase.from('certidoes').select('*').eq('empresa_id', emp.id),
        supabase.from('alvaras').select('*').eq('empresa_id', emp.id),
        supabase.from('licencas_sanitarias').select('*').eq('empresa_id', emp.id),
        supabase.from('certificados_digitais').select('*').eq('empresa_id', emp.id),
        supabase.from('processos_societarios').select('*').eq('empresa_id', emp.id).eq('status', 'Andamento').order('created_at'),
      ])

      // O documento "atual" de cada tipo é o de vencimento mais distante
      const maisRecente = (lista: any[]) =>
        [...lista].sort((a, b) => (b.data_vencimento || '').localeCompare(a.data_vencimento || ''))[0]

      const portais: Record<string, string | null> = {
        Federal: 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj',
        Estadual: emp.uf ? SEFAZ_URLS[emp.uf] || null : null,
        FGTS: 'https://consulta-crf.caixa.gov.br',
        Municipal: emp.url_certidao_municipal || null,
        Trabalhista: 'https://cndt-certidao.tst.jus.br',
      }

      const certidoes = cert.data || []
      const novas: Linha[] = CERTIDOES.map(c => {
        const doc = maisRecente(certidoes.filter((x: any) => x.tipo === c.tipo))
        if (!doc) return { chave: c.tipo, nome: c.nome, orgao: c.tipo === 'Estadual' && emp.uf ? `SEFAZ-${emp.uf}` : c.orgao, data: null, naoCadastrado: { href: `/certidoes?empresa=${emp.id}` } }
        return {
          chave: c.tipo, nome: c.nome, orgao: doc.orgao_emissor || c.orgao, data: doc.data_vencimento,
          pendente: doc.pendencia_status === 'impossivel_renovar',
          situacao: PENDENCIA_LABEL[doc.pendencia_status] || '',
          portal: portais[c.tipo],
          acao: { label: 'Renovar', href: `/certidoes?empresa=${emp.id}&renovar=${doc.id}` },
        }
      })

      // Previdenciária só aparece se a empresa tiver uma cadastrada
      const prev = maisRecente(certidoes.filter((x: any) => x.tipo === 'Previdenciária'))
      if (prev) novas.push({
        chave: 'prev', nome: 'CND Previdenciária', orgao: prev.orgao_emissor || 'Receita Federal', data: prev.data_vencimento,
        pendente: prev.pendencia_status === 'impossivel_renovar', situacao: PENDENCIA_LABEL[prev.pendencia_status] || '',
        portal: portais.Federal, acao: { label: 'Renovar', href: `/certidoes?empresa=${emp.id}&renovar=${prev.id}` },
      })

      const alvara = maisRecente(alv.data || [])
      novas.push(alvara
        ? { chave: 'alvara', nome: 'Alvará de funcionamento', orgao: alvara.orgao_emissor || 'Prefeitura', data: alvara.data_vencimento,
            portal: emp.url_portal_alvara || null, acao: { label: 'Renovar', href: `/alvaras?empresa=${emp.id}&renovar=${alvara.id}` } }
        : { chave: 'alvara', nome: 'Alvará de funcionamento', orgao: 'Prefeitura', data: null, naoCadastrado: { href: `/alvaras?empresa=${emp.id}` } })

      const licenca = maisRecente(lic.data || [])
      novas.push(licenca
        ? { chave: 'licenca', nome: 'Licença sanitária', orgao: licenca.orgao === 'ANVISA' ? 'ANVISA' : 'VISA municipal', data: licenca.data_vencimento,
            portal: emp.url_portal_visa || null, acao: { label: 'Atualizar', href: `/licencas?empresa=${emp.id}` } }
        : { chave: 'licenca', nome: 'Licença sanitária', orgao: 'VISA municipal ou ANVISA', data: null, naoCadastrado: { href: `/licencas?empresa=${emp.id}` } })

      const certs = cd.data || []
      const emitido = maisRecente(certs.filter((x: any) => x.certificado_finalizado))
      const emProcesso = certs.find((x: any) => !x.certificado_finalizado)
      if (emitido || emProcesso) {
        const base = emitido || emProcesso
        novas.push({
          chave: 'certificado', nome: 'Certificado digital',
          orgao: [`${base.uso} ${base.tipo}`, base.autoridade_certificadora].filter(Boolean).join(' · '),
          data: emitido ? emitido.data_vencimento : null,
          situacao: emProcesso ? 'Renovação em andamento' : (emitido?.oferta_renovacao_em ? `Renovação oferecida em ${formatDate(emitido.oferta_renovacao_em)}` : ''),
          acao: { label: 'Ver certificados', href: `/certificados?empresa=${emp.id}` },
        })
      } else {
        novas.push({ chave: 'certificado', nome: 'Certificado digital', orgao: 'e-CNPJ ou e-CPF', data: null, naoCadastrado: { href: `/certificados?empresa=${emp.id}` } })
      }
      setLinhas(novas)

      // Processos em andamento, com a etapa atual e há quantos dias está parado
      const lista = proc.data || []
      let ultimaNota: Record<string, string> = {}
      if (lista.length > 0) {
        const { data: notas } = await supabase.from('processo_notas').select('processo_id, created_at')
          .in('processo_id', lista.map((p: any) => p.id)).order('created_at', { ascending: false })
        for (const n of notas || []) if (!ultimaNota[n.processo_id]) ultimaNota[n.processo_id] = n.created_at
      }
      setProcessos(lista.map((p: any) => {
        const checklist: any[] = p.checklist || []
        const feitas = checklist.filter(i => i.status === 'Concluido').length
        const proxima = checklist.find(i => i.status !== 'Concluido')?.etapa
        const ultima = [p.updated_at, ultimaNota[p.id], p.created_at].filter(Boolean).sort().reverse()[0]
        const parado = ultima ? Math.max(0, -(diasAte(String(ultima)) ?? 0)) : 0
        return { ...p, feitas, total: checklist.length, proxima, parado }
      }))
      setCarregando(false)
    }
    carregar()
  }, [emp.id])

  const atencao = linhas.filter(l => { const d = diasAte(l.data); return l.pendente || (d !== null && d <= 30) }).length
  const resumo = [
    atencao > 0 ? `${atencao} ${atencao === 1 ? 'documento vence' : 'documentos vencem'} nos próximos 30 dias ou já ${atencao === 1 ? 'venceu' : 'venceram'}` : 'Documentos em dia',
    processos.length > 0 ? `${processos.length} ${processos.length === 1 ? 'processo em andamento' : 'processos em andamento'}` : '',
  ].filter(Boolean).join(' · ')

  function copiar(texto: string, aviso: string) {
    navigator.clipboard?.writeText(texto).then(() => toast.success(aviso)).catch(() => {})
  }

  // Capital social
  const capFormatado = e.capital_social ? formatarReais(e.capital_social) : null
  const capExtenso   = e.capital_social ? capitalExtenso(e.capital_social) : null
  const quotasInfo   = e.capital_social && e.valor_quota ? calcularCapitalSocial(e.capital_social, e.valor_quota) : null
  const cnaesSecundarios: unknown[] = e.cnaes_secundarios ?? []

  const blocos: Array<{ titulo: string; campos: Array<[string, string | null | undefined]> }> = [
    { titulo: 'Dados cadastrais', campos: [
      ['Natureza jurídica', cnaeStr(e.natureza_juridica)],
      ['Abertura', e.data_abertura ? formatDate(e.data_abertura) : ''],
      ['Inscr. estadual', emp.inscricao_estadual],
      ['Inscr. municipal', emp.inscricao_municipal],
      ['NIRE', e.nire],
      ['Sessão da Junta', e.sessao_junta],
    ]},
    { titulo: 'Endereço', campos: [
      ['Logradouro', endereco],
      ['Bairro', emp.bairro],
      ['Cidade', [cidadeUf, emp.cep ? `CEP ${formatCEP(emp.cep)}` : ''].filter(Boolean).join(' · ')],
    ]},
    { titulo: 'Contato', campos: [
      ['Telefone', [e.telefone, e.telefone2].filter(Boolean).join(' · ')],
      ['E-mail', e.email],
    ]},
    { titulo: 'Capital social', campos: [
      ['Valor', capFormatado ? `${capFormatado}${capExtenso ? ` (${capExtenso})` : ''}` : ''],
      ['Quotas', quotasInfo ? `${quotasInfo.quantidade_str} quotas de ${quotasInfo.valor_quota_str}` : ''],
    ]},
  ]

  const btnSec = 'inline-flex items-center h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 whitespace-nowrap'

  return (
    <div className="p-4 md:p-6 xl:p-8 space-y-5">

      {/* Cabeçalho */}
      <div>
        <Link href="/empresas" className="text-sm font-semibold text-blue-700 hover:underline">← Carteira</Link>
        <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 break-words">{emp.razao_social}</h1>
              <span className={`text-sm font-semibold px-2 py-0.5 rounded-md border ${
                emp.status === 'ativa' ? 'text-green-800 bg-green-50 border-green-200'
                : emp.status === 'em_abertura' ? 'text-yellow-900 bg-yellow-50 border-yellow-200'
                : 'text-slate-700 bg-slate-100 border-slate-200'}`}>
                {emp.status === 'ativa' ? 'Ativa' : emp.status === 'em_abertura' ? 'Em abertura' : 'Inativa'}
              </span>
            </div>
            {nomeFantasia && <p className="text-slate-600 mt-0.5">{nomeFantasia}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-600">
              {emp.cnpj ? (
                <span className="inline-flex items-center gap-2">CNPJ <span className="font-semibold text-slate-900">{formatCNPJ(emp.cnpj)}</span>
                  <button onClick={() => copiar(emp.cnpj.replace(/\D/g, ''), 'CNPJ copiado')}
                    className="h-8 px-2 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:bg-slate-50">Copiar</button>
                </span>
              ) : <span>CNPJ ainda não disponível (em abertura)</span>}
              {emp.codigo && <span>Código {emp.codigo}</span>}
              {cidadeUf && <span>{cidadeUf}</span>}
              {e.natureza_juridica && <span>{cnaeStr(e.natureza_juridica)}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {telDigitos && (
              <a href={`https://api.whatsapp.com/send?phone=55${telDigitos}`} target="_blank" rel="noopener noreferrer" className={btnSec}>WhatsApp</a>
            )}
            {enderecoMapa && (
              <a href={`https://www.google.com/maps?q=${encodeURIComponent(enderecoMapa)}`} target="_blank" rel="noopener noreferrer" className={btnSec}>Ver no mapa</a>
            )}
            <Link href={`/empresas/${emp.id}?edit=1`} className="inline-flex items-center h-10 px-4 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800">Editar cadastro</Link>
          </div>
        </div>
        {!carregando && (
          <p className={`mt-3 px-4 py-2.5 rounded-lg border text-sm ${atencao > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-900' : 'bg-white border-slate-200 text-slate-700'}`}>
            {resumo}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-5 items-start">

        {/* Coluna principal */}
        <div className="flex-[1.6_1_32rem] min-w-0 space-y-5">

          {/* Situação dos documentos */}
          <section aria-label="Situação dos documentos" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
              <h2 className="text-base font-bold text-slate-900">Situação dos documentos</h2>
              <span className="text-sm text-slate-500">clique na data para copiar</span>
            </div>
            {carregando ? (
              <div className="px-5 pb-5 space-y-2">{[...Array(5)].map((_, k) => <div key={k} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}</div>
            ) : linhas.map(l => {
              const d = diasAte(l.data)
              const cor = l.pendente || (d !== null && d < 0)
                ? 'text-red-900 bg-red-100 border-red-300'
                : d !== null && d <= 30 ? 'text-yellow-900 bg-yellow-100 border-yellow-300'
                : 'text-green-900 bg-green-100 border-green-300'
              return (
                <div key={l.chave} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 border-t border-slate-100">
                  <div className="flex-[1_1_11rem] min-w-0">
                    <div className="font-semibold text-slate-900">{l.nome}</div>
                    <div className="text-sm text-slate-600">{l.orgao}</div>
                  </div>
                  <div className="flex-[1_1_15rem] min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {l.naoCadastrado ? (
                      <span className="text-sm text-slate-500">Não cadastrado</span>
                    ) : l.pendente ? (
                      <span className="text-sm font-bold text-red-700">Pendente · não foi possível renovar</span>
                    ) : l.data ? (
                      <>
                        <button onClick={() => copiar(formatDate(l.data), 'Data copiada')} title="Copiar data"
                          className={`text-sm font-semibold px-2.5 py-0.5 rounded-md border cursor-copy ${cor}`}>{formatDate(l.data)}</button>
                        <span className="text-sm text-slate-600">{prazoTexto(d)}</span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500">Sem data de validade</span>
                    )}
                    {l.situacao && <span className="text-sm text-slate-600">· {l.situacao}</span>}
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    {l.portal && (
                      <a href={l.portal} target="_blank" rel="noopener noreferrer"
                        onClick={() => emp.cnpj && copiar(emp.cnpj.replace(/\D/g, ''), 'CNPJ copiado: é só colar no portal')}
                        className="inline-flex items-center h-10 px-3 rounded-lg text-sm font-semibold text-blue-700 hover:bg-blue-50">
                        Abrir portal<span className="sr-only"> · {l.nome} de {emp.razao_social}</span>
                      </a>
                    )}
                    {l.naoCadastrado
                      ? <Link href={l.naoCadastrado.href} className={btnSec}>Cadastrar</Link>
                      : l.acao && <Link href={l.acao.href} className={btnSec}>{l.acao.label}</Link>}
                  </div>
                </div>
              )
            })}
          </section>

          {/* Processos em andamento */}
          <section aria-label="Processos em andamento" className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900">Processos em andamento</h2>
              <Link href={`/societario?empresa=${emp.id}`} className="text-sm font-semibold text-blue-700 hover:underline">Ver processos da empresa</Link>
            </div>
            {carregando ? null : processos.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhum processo em andamento.</p>
            ) : processos.map(p => (
              <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-slate-100 first-of-type:border-0 first-of-type:pt-0">
                <div className="flex-[1_1_16rem] min-w-0">
                  <div className="font-semibold text-slate-900">{p.titulo || String(p.tipo || '').replace(/_/g, ' ')}</div>
                  <div className="text-sm text-slate-600">
                    {p.total > 0 && <>Etapa {Math.min(p.feitas + 1, p.total)} de {p.total}{p.proxima ? ` · ${p.proxima}` : ''} · </>}
                    {p.parado === 0 ? 'movimentado hoje' : `sem movimentação há ${p.parado} dia${p.parado === 1 ? '' : 's'}`}
                  </div>
                </div>
                <Link href={`/societario?processo=${p.id}`} className={btnSec}>Abrir processo</Link>
              </div>
            ))}
          </section>

          {/* Histórico e comunicações */}
          <HistoricoEmpresa empresaId={emp.id} />
        </div>

        {/* Coluna lateral: cadastro */}
        <aside aria-label="Dados cadastrais" className="flex-[1_1_20rem] min-w-0 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          {blocos.map(b => {
            const campos = b.campos.filter(([, v]) => v)
            if (campos.length === 0) return null
            return (
              <div key={b.titulo}>
                <h2 className="text-sm font-bold text-slate-900 mb-1.5">{b.titulo}</h2>
                <dl>
                  {campos.map(([k, v]) => (
                    <div key={k} className="flex gap-3 py-1 text-sm">
                      <dt className="w-32 flex-shrink-0 text-slate-600">{k}</dt>
                      <dd className="flex-1 min-w-0 font-medium text-slate-900 break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
          {(e.cnae_principal || cnaesSecundarios.length > 0) && (
            <div>
              <h2 className="text-sm font-bold text-slate-900 mb-1.5">Atividades (CNAE)</h2>
              {e.cnae_principal && <p className="text-sm text-slate-900 py-1"><span className="text-slate-600">Principal: </span>{cnaeStr(e.cnae_principal)}</p>}
              {cnaesSecundarios.map((c, i) => <p key={i} className="text-sm text-slate-700 py-0.5">{cnaeStr(c)}</p>)}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
