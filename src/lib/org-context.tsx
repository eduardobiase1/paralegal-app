'use client'

import { createContext, useContext, ReactNode } from 'react'

export type OrgRole = 'admin' | 'operador' | 'viewer'

export interface OrgInfo {
  id: string
  name: string
  role: OrgRole
}

export interface OrgContextValue {
  orgId: string
  orgName: string
  role: OrgRole
  isAdmin: boolean
  mustChangePassword: boolean
  allOrgs: OrgInfo[]
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({
  orgId,
  orgName,
  role,
  mustChangePassword = false,
  allOrgs = [],
  children,
}: {
  orgId: string
  orgName: string
  role: OrgRole
  mustChangePassword?: boolean
  allOrgs?: OrgInfo[]
  children: ReactNode
}) {
  return (
    <OrgContext.Provider value={{ orgId, orgName, role, isAdmin: role === 'admin', mustChangePassword, allOrgs }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg deve ser usado dentro de OrgProvider')
  return ctx
}
