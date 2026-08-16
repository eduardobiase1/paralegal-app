'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function EmpresaError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Empresa page error:', error)
  }, [error])

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Erro ao carregar empresa</h2>
      <p className="text-gray-500 text-sm mb-6 max-w-sm">
        Ocorreu um erro inesperado. Tente novamente ou volte para a lista de empresas.
      </p>
      <p className="text-xs text-gray-400 mb-6 font-mono">
        {error.message || 'Erro desconhecido'}
        {error.digest && ` · ${error.digest}`}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          Tentar novamente
        </button>
        <Link
          href="/empresas"
          className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Voltar para empresas
        </Link>
      </div>
    </div>
  )
}
