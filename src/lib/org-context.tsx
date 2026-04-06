'use client'

import { createContext, useContext, ReactNode } from 'react'

export type OrgRole = 'admin' | 'operador' | 'viewer'

export interface OrgContextValue {
  orgId: string
  orgName: string
  role: OrgRole
  isAdmin: boolean
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({
  orgId,
  orgName,
  role,
  children,
}: {
  orgId: string
  orgName: string
  role: OrgRole
  children: ReactNode
}) {
  return (
    <OrgContext.Provider value={{ orgId, orgName, role, isAdmin: role === 'admin' }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg deve ser usado dentro de OrgProvider')
  return ctx
}
