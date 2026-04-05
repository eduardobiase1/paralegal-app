'use client'

import Link from 'next/link'
import { Empresa } from '@/types'
import { formatCNPJ, formatCEP, endereco } from '@/lib/utils'
import { capitalExtenso, formatarReais, calcularCapitalSocial } from '@/lib/formatters'
import { SEFAZ_URLS } from '@/types'

interface Props {
  empresa: Empresa
}

const quickLinks = (emp: Empresa) => [
  { label: 'CND Federal', url: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointer/default.aspx', color: 'blue' },
  { label: 'CNDT Trabalhista', url: 'https://cndt-certidao.tst.jus.br', color: 'purple' },
  { label: 'FGTS (CRF)', url: 'https://consulta-crf.caixa.gov.br', color: 'orange' },
  { label: 'e-CAC', url: 'https://cav.receita.fazenda.gov.br', color: 'red' },
  ...(emp.uf && SEFAZ_URLS[emp.uf] ? [{ label: `SEFAZ-${emp.uf}`, url: SEFAZ_URLS[emp.uf], color: 'green' }] : []),
  ...(emp.url_certidao_municipal ? [{ label: 'Certidão Municipal', url: emp.url_certidao_municipal, color: 'teal' }] : []),
  ...(emp.url_portal_alvara ? [{ label: 'Portal Alvará', url: emp.url_portal_alvara, color: 'yellow' }] : []),
  ...(emp.url_portal_visa ? [{ label: 'Portal VISA', url: emp.url_portal_visa, color: 'pink' }] : []),
]

const colorMap: Record<string, string> = {
  blue:   'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  red:    'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
  green:  'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  teal:   'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
  pink:   'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100',
}

export default function EmpresaDetail({ empresa: emp }: Props) {
  const end = endereco(emp)
  const mapsUrl = end
    ? `https://www.google.com/maps?q=${encodeURIComponent(end)}`
    : null

  // Capital social calculado
  const capFormatado  = (emp as any).capital_social ? formatarReais((emp as any).capital_social) : null
  const capExtenso    = (emp as any).capital_social ? capitalExtenso((emp as any).capital_social) : null
  const quotasInfo    = (emp as any).capital_social && (emp as any).valor_quota
    ? calcularCapitalSocial((emp as any).capital_social, (emp as any).valor_quota)
    : null

  // CNAEs secundários
  const cnaesSecundarios: string[] = (emp as any).cnaes_secundarios ?? []

  return (
    <div className="p-6 max-w-5xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{emp.razao_social}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              emp.status === 'ativa'        ? 'bg-green-100 text-green-700' :
              emp.status === 'em_abertura'  ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {emp.status === 'ativa' ? 'Ativa' : emp.status === 'em_abertura' ? 'Em Abertura' : 'Inativa'}
            </span>
          </div>
          {emp.nome_fantasia && <p className="text-gray-500 mt-0.5">{emp.nome_fantasia}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href={`/empresas/${emp.id}?edit=1`} className="btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </Link>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              Maps
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Dados Cadastrais ── */}
        <div className="card">
          <div className="card-header"><h2 className="font-semibold text-gray-900">Dados Cadastrais</h2></div>
          <div className="card-body space-y-3 text-sm">
            <Row label="Código" value={`#${emp.codigo}`} mono />
            {emp.cnpj
              ? <Row label="CNPJ" value={formatCNPJ(emp.cnpj)} mono />
              : <Row label="CNPJ" value="Em Abertura — ainda não disponível" muted />
            }
            {(emp as any).natureza_juridica && <Row label="Natureza Jurídica" value={(emp as any).natureza_juridica} />}
            {(emp as any).data_abertura && (
              <Row label="Data de Abertura"
                value={new Date((emp as any).data_abertura + 'T12:00:00').toLocaleDateString('pt-BR')} />
            )}
            {emp.inscricao_estadual  && <Row label="Insc. Estadual"  value={emp.inscricao_estadual} />}
            {emp.inscricao_municipal && <Row label="Insc. Municipal" value={emp.inscricao_municipal} />}
            {(emp as any).nire         && <Row label="NIRE"           value={(emp as any).nire} mono />}
            {(emp as any).sessao_junta && <Row label="Sessão Junta"   value={(emp as any).sessao_junta} />}
          </div>
        </div>

        {/* ── Endereço ── */}
        <div className="card">
          <div className="card-header"><h2 className="font-semibold text-gray-900">Endereço da Sede</h2></div>
          <div className="card-body space-y-3 text-sm">
            {emp.cep       && <Row label="CEP"        value={formatCEP(emp.cep)} mono />}
            {emp.logradouro && <Row label="Logradouro" value={[emp.logradouro, emp.numero].filter(Boolean).join(', ')} />}
            {emp.complemento && <Row label="Complemento" value={emp.complemento} />}
            {emp.bairro    && <Row label="Bairro"     value={emp.bairro} />}
            {emp.cidade    && <Row label="Cidade/UF"  value={`${emp.cidade}/${emp.uf}`} />}
          </div>
        </div>

        {/* ── CNAE ── */}
        {((emp as any).cnae_principal || cnaesSecundarios.length > 0) && (
          <div className="card lg:col-span-2">
            <div className="card-header"><h2 className="font-semibold text-gray-900">Atividades (CNAE)</h2></div>
            <div className="card-body space-y-3 text-sm">
              {(emp as any).cnae_principal && (
                <div className="flex items-start gap-2">
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex-shrink-0 mt-0.5">Principal</span>
                  <span className="text-gray-900">{(emp as any).cnae_principal}</span>
                </div>
              )}
              {cnaesSecundarios.length > 0 && (
                <div className="space-y-1.5">
                  {cnaesSecundarios.map((c: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full flex-shrink-0 mt-0.5">Secundário</span>
                      <span className="text-gray-700">{c}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Capital Social ── */}
        {capFormatado && (
          <div className="card">
            <div className="card-header"><h2 className="font-semibold text-gray-900">Capital Social</h2></div>
            <div className="card-body space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-2xl font-bold text-gray-900">{capFormatado}</p>
                  {capExtenso && <p className="text-xs text-gray-500 mt-0.5 italic">{capExtenso}</p>}
                </div>
              </div>
              {quotasInfo && (
                <>
                  <div className="h-px bg-gray-100" />
                  <Row label="Qtd. de Quotas"  value={quotasInfo.quantidade_str} />
                  <Row label="Valor por Quota" value={quotasInfo.valor_quota_str} mono />
                  <p className="text-xs text-gray-400 italic">{quotasInfo.quantidade_extenso} de {quotasInfo.valor_quota_extenso} cada</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Contatos ── */}
        {((emp as any).email || (emp as any).telefone || (emp as any).telefone2) && (
          <div className="card">
            <div className="card-header"><h2 className="font-semibold text-gray-900">Contatos</h2></div>
            <div className="card-body space-y-3 text-sm">
              {(emp as any).email && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${(emp as any).email}`}
                    className="text-primary-600 hover:underline">{(emp as any).email}</a>
                </div>
              )}
              {(emp as any).telefone && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${(emp as any).telefone}`}
                    className="text-gray-900">{(emp as any).telefone}</a>
                  {(emp as any).telefone2 && (
                    <span className="text-gray-400 mx-1">·</span>
                  )}
                  {(emp as any).telefone2 && (
                    <a href={`tel:${(emp as any).telefone2}`}
                      className="text-gray-900">{(emp as any).telefone2}</a>
                  )}
                </div>
              )}
              {/* WhatsApp direto */}
              {(emp as any).telefone && (
                <a
                  href={`https://api.whatsapp.com/send?phone=55${(emp as any).telefone.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 transition-colors w-fit"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.117 1.528 5.845L0 24l6.335-1.505A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.943 0-3.772-.524-5.337-1.438l-.383-.228-3.962.941.976-3.858-.25-.397A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                  Abrir WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Acesso rápido ── */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Acesso Rápido — Portais</h2>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap gap-2">
            {quickLinks(emp).map(link => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${colorMap[link.color]}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Links módulos ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: `/certidoes?empresa=${emp.id}`,    label: 'Certidões',    icon: '📋' },
          { href: `/alvaras?empresa=${emp.id}`,       label: 'Alvarás',      icon: '🏷️' },
          { href: `/licencas?empresa=${emp.id}`,      label: 'Licenças',     icon: '🛡️' },
          { href: `/certificados?empresa=${emp.id}`,  label: 'Certificados', icon: '🔑' },
          { href: `/societario?empresa=${emp.id}`,    label: 'Societário',   icon: '🏢' },
          { href: `/contratos?empresa=${emp.id}`,     label: 'Contratos',    icon: '📄' },
          { href: `/simulador`,                       label: 'Simulador',    icon: '🧮' },
          { href: `/relatorios?empresa=${emp.id}`,    label: 'Relatório PDF', icon: '📊' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="card p-4 text-center hover:border-primary-300 hover:shadow-md transition-all group"
          >
            <div className="text-2xl mb-2">{item.icon}</div>
            <p className="text-sm font-medium text-gray-700 group-hover:text-primary-600">{item.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Row({ label, value, mono, muted }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span className={`text-right ${mono ? 'font-mono' : ''} ${muted ? 'text-gray-400 italic text-xs' : 'text-gray-900'}`}>{value}</span>
    </div>
  )
}
