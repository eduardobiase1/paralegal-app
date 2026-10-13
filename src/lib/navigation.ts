// Estrutura única de navegação: o menu lateral mostra os grupos e as abas no topo
// de cada tela (SectionTabs) mostram as páginas do grupo.

import type { OrgRole } from '@/lib/org-context'

export interface NavPage { href: string; label: string }
export interface NavGroup { id: string; label: string; pages: NavPage[] }

export const NAV_GROUPS: NavGroup[] = [
  { id: 'hoje', label: 'Hoje', pages: [
    { href: '/briefing',  label: 'Briefing' },
    { href: '/dashboard', label: 'Dashboard' },
  ]},
  { id: 'visao-geral', label: 'Visão geral', pages: [
    { href: '/visao-geral', label: 'Visão geral' },
  ]},
  { id: 'carteira', label: 'Carteira', pages: [
    { href: '/empresas', label: 'Empresas' },
  ]},
  { id: 'vencimentos', label: 'Vencimentos', pages: [
    { href: '/certidoes',     label: 'Certidões' },
    { href: '/alvaras',       label: 'Alvarás' },
    { href: '/licencas',      label: 'Licenças sanitárias' },
    { href: '/certificados',  label: 'Certificados digitais' },
    { href: '/taxas-licenca', label: 'Taxas de licença' },
  ]},
  { id: 'processos', label: 'Processos', pages: [
    { href: '/societario/painel', label: 'Briefing societário' },
    { href: '/societario',        label: 'Processos' },
  ]},
  { id: 'financeiro', label: 'Financeiro', pages: [
    { href: '/financeiro', label: 'Financeiro' },
  ]},
  { id: 'ferramentas', label: 'Ferramentas', pages: [
    { href: '/contratos',  label: 'Contratos' },
    { href: '/simulador',  label: 'Simulador de taxas' },
    { href: '/tributario', label: 'Estrategista tributário' },
    { href: '/relatorios', label: 'Relatórios PDF' },
    { href: '/pdf-tools',  label: 'PDF Expert' },
  ]},
  { id: 'equipe', label: 'Equipe', pages: [
    { href: '/produtividade', label: 'Produtividade' },
    { href: '/usuarios',      label: 'Usuários' },
  ]},
]

// Perfis restritos enxergam só a própria área (mesma regra do ViewerGuard)
export function gruposDoPerfil(role: OrgRole): NavGroup[] {
  if (role === 'viewer') {
    return NAV_GROUPS.filter(g => g.id === 'processos')
      .map(g => ({ ...g, pages: g.pages.filter(p => p.href === '/societario') }))
  }
  if (role === 'financeiro') return NAV_GROUPS.filter(g => g.id === 'financeiro')
  return NAV_GROUPS
}

// Grupo e página ativos para um caminho — a página de href mais longo que casa vence
export function navAtiva(pathname: string, grupos: NavGroup[]) {
  let melhor: { group: NavGroup; page: NavPage } | null = null
  for (const group of grupos) {
    for (const page of group.pages) {
      const casa = pathname === page.href || pathname.startsWith(page.href + '/')
      if (casa && (!melhor || page.href.length > melhor.page.href.length)) melhor = { group, page }
    }
  }
  return melhor
}
