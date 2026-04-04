import EmpresaForm from '@/components/modules/EmpresaForm'

export default function NovaEmpresaPage() {
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova Empresa</h1>
      <div className="card">
        <EmpresaForm />
      </div>
    </div>
  )
}
