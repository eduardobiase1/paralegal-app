'use client'

/**
 * PasswordChangeGuard
 * Se o usuário tem must_change_password = true, redireciona para /change-password.
 * Não faz nada se o usuário já está na página de troca de senha.
 */

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useOrg } from '@/lib/org-context'

export default function PasswordChangeGuard() {
  const { mustChangePassword } = useOrg()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (mustChangePassword && pathname !== '/change-password') {
      router.replace('/change-password')
    }
  }, [mustChangePassword, pathname, router])

  return null
}
