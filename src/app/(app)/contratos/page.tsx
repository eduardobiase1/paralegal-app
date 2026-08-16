'use client'

import UnipessoalWizard from '@/components/modules/UnipessoalWizard'

export default function ContratosPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
      </div>
      <div className="card p-6">
        <UnipessoalWizard />
      </div>
    </div>
  )
}
