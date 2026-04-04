'use client'

import Link from 'next/link'
import { Empresa } from '@/types'
import { formatCNPJ, formatCEP, endereco } from '@/lib/utils'
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
  blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  red: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
  green: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  teal: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
  pink: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100',
}

export default function EmpresaDetail({ empresa: emp }: Props) {
  const end = endereco(emp)
  const mapsUrl = end
    ? `https://www.google.com/maps?q=${encodeURIComponent(end)}`
    : null

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{emp.razao_social}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              emp.status === 'ativa' ? 'bg-green-100 text-green-700' :
              emp.status === 'em_abertura' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {emp.status === 'ativa' ? 'Ativa' : emp.status === 'em_abertura' ? 'Em Abertura' : 'Inativa'}
            </span>
          </div>
          {emp.nome_fantasia && <p className="text-gray-500 mt-0.5">{emp.nome_fantasia}</p>}
        </div>
        <div className="flex gap-2">
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
              Ver no Maps
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados cadastrais */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Dados Cadastrais</h2>
          </div>
          <div className="card-body space-y-3 text-sm">
            <Row label="Código" value={`#${emp.codigo}`} mono />
            <Row label="CNPJ" value={formatCNPJ(emp.cnpj)} mono />
            {emp.inscricao_estadual && <Row label="Insc. Estadual" value={emp.inscricao_estadual} />}
            {emp.inscricao_municipal && <Row label="Insc. Municipal" value={emp.inscricao_municipal} />}
          </div>
        </div>

        {/* Endereço */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Endereço</h2>
          </div>
          <div className="card-body space-y-3 text-sm">
            {emp.cep && <Row label="CEP" value={formatCEP(emp.cep)} mono />}
            {emp.logradouro && <Row label="Logradouro" value={[emp.logradouro, emp.numero].filter(Boolean).join(', ')} />}
            {emp.complemento && <Row label="Complemento" value={emp.complemento} />}
            {emp.bairro && <Row label="Bairro" value={emp.bairro} />}
            {emp.cidade && <Row label="Cidade/UF" value={`${emp.cidade}/${emp.uf}`} />}
          </div>
        </div>
      </div>

      {/* Acesso rápido */}
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

      {/* Links módulos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: `/certidoes?empresa=${emp.id}`, label: 'Certidões', icon: '📋' },
          { href: `/alvaras?empresa=${emp.id}`, label: 'Alvarás', icon: '🏷️' },
          { href: `/licencas?empresa=${emp.id}`, label: 'Licenças', icon: '🛡️' },
          { href: `/certificados?empresa=${emp.id}`, label: 'Certificados', icon: '🔑' },
          { href: `/societario?empresa=${emp.id}`, label: 'Societário', icon: '🏢' },
          { href: `/contratos?empresa=${emp.id}`, label: 'Contratos', icon: '📄' },
          { href: `/relatorios?empresa=${emp.id}`, label: 'Relatório PDF', icon: '📊' },
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span className={`text-gray-900 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
