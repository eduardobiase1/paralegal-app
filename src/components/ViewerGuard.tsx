'use client'

/**
 * ViewerGuard
 * Garante que usuários com role='viewer' só acessem o Módulo Societário.
 * Qualquer outra rota é redirecionada para /societario automaticamente.
 */

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useOrg } from '@/lib/org-context'

export default function ViewerGuard() {
  const { role } = useOrg()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (role === 'viewer' && !pathname.startsWith('/societario')) {
      router.replace('/societario')
    }
  }, [role, pathname, router])

  return null
}
