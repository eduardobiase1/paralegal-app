'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function EmpresasPage() {
  const [supabase] = useState(createClient())
  const [empresas, setEmpresas] = useState<any[]>([])
  const [userOrg, setUserOrg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isConsulting, setIsConsulting] = useState(false)

  // Estado do Formulário com os campos da Receita
  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    logradouro: '',
    numero: '',
    bairro: '',
    municipio: '',
    uf: '',
    cep: '',
    situacao: ''
  })

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('organizacao').eq('id', user.id).single()
        if (profile?.organizacao) {
          setUserOrg(profile.organizacao)
          fetchData(profile.organizacao)
        }
      }
    }
    init()
  }, [])

  async function fetchData(org: string) {
    setLoading(true)
    const { data } = await supabase.from('empresas').select('*').eq('organizacao', org).order('razao_social')
    setEmpresas(data || [])
    setLoading(false)
  }

  // FUNÇÃO MÁGICA: Consulta o CNPJ na API
  async function consultarCNPJ() {
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) {
      return toast.error("Digite um CNPJ válido com 14 dígitos")
    }

    setIsConsulting(true)
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)
      const data = await response.json()

      if (response.ok) {
        setFormData({
          ...formData,
          razao_social: data.razao_social || '',
          nome_fantasia: data.nome_fantasia || '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          bairro: data.bairro || '',
          municipio: data.municipio || '',
          uf: data.uf || '',
          cep: data.cep || '',
          situacao: data.descricao_situacao_cadastral || 'ATIVA'
        })
        toast.success("Dados importados da Receita Federal!")
      } else {
        toast.error("CNPJ não encontrado ou API instável")
      }
    } catch (error) {
      toast.error("Erro ao conectar com o serviço da Receita")
    } finally {
      setIsConsulting(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userOrg) return
    
    // Salva com todos os dados da receita + carimbo da organização
    const { error } = await supabase.from('empresas').insert([{ ...formData, organizacao: userOrg }])
    
    if (!error) {
      toast.success("Empresa cadastrada com sucesso!")
      setIsModalOpen(false)
      fetchData(userOrg)
    } else {
      toast.error("Erro ao salvar no banco de dados")
    }
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-left font-sans">
      <header className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Carteira de Clientes</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{userOrg}</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition-all">
          + Nova Empresa (Auto)
        </button>
      </header>

      {/* Tabela de exibição */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b text-[10px] font-black uppercase text-slate-500 tracking-widest">
            <tr>
              <th className="px-6 py-4">Razão Social / CNPJ</th>
              <th className="px-6 py-4">Localização</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {empresas.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-slate-800">{emp.razao_social}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{emp.cnpj}</p>
                </td>
                <td className="px-6 py-4 text-xs text-slate-600 uppercase">
                  {emp.municipio} - {emp.uf}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black px-2 py-1 rounded-full italic">
                    {emp.situacao || 'ATIVA'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CADASTRO AUTOMÁTICO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-8 border shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="bg-blue-600 w-2 h-6 rounded-full inline-block"></span>
              Importar Empresa via Receita
            </h2>
            
            <div className="flex gap-2 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 text-left">Digite o CNPJ</label>
                <input 
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={e => setFormData({...formData, cnpj: e.target.value})}
                />
              </div>
              <button 
                type="button"
                onClick={consultarCNPJ}
                disabled={isConsulting}
                className="mt-5 bg-slate-800 text-white px-6 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-black disabled:opacity-50"
              >
                {isConsulting ? 'Consultando...' : 'Consultar'}
              </button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase">Razão Social (Importado)</label>
                <input required readOnly className="w-full bg-slate-50 border p-3 rounded-lg text-sm font-bold text-slate-600 outline-none" value={formData.razao_social} />
              </div>
              
              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase">Cidade</label>
                <input readOnly className="w-full bg-slate-50 border p-3 rounded-lg text-sm text-slate-600 outline-none" value={formData.municipio} />
              </div>
              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase">Estado / UF</label>
                <input readOnly className="w-full bg-slate-50 border p-3 rounded-lg text-sm text-slate-600 outline-none" value={formData.uf} />
              </div>

              <div className="col-span-2 flex gap-4 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-xs uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700"
                >
                  Cadastrar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}