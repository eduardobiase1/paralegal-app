'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// Ícones
const IconPlus = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
const IconSearch = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>

export default function EmpresasPage() {
  const [supabase] = useState(createClient())
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userOrg, setUserOrg] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    razao_social: '',
    cnpj: '',
    status: 'Ativa'
  })

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase
          .from('perfis')
          .select('organizacao')
          .eq('id', user.id)
          .single()

        if (perfil) {
          setUserOrg(perfil.organizacao)
          fetchEmpresas(perfil.organizacao)
        }
      }
    }
    init()
  }, [])

  async function fetchEmpresas(org: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .eq('organizacao', org)
      .order('razao_social', { ascending: true })

    if (!error) setEmpresas(data || [])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userOrg) return toast.error("Organização não identificada")

    const payload = {
      ...formData,
      organizacao: userOrg // Carimbo automático da empresa logada
    }

    const { error } = await supabase.from('empresas').insert([payload])

    if (!error) {
      setIsModalOpen(false)
      fetchEmpresas(userOrg)
      setFormData({ razao_social: '', cnpj: '', status: 'Ativa' })
      toast.success("Empresa cadastrada com sucesso!")
    } else {
      toast.error("Erro ao cadastrar empresa")
    }
  }

  const filteredEmpresas = empresas.filter(emp => 
    emp.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cnpj.includes(searchTerm)
  )

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans text-left">
      <header className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Carteira de Clientes</h1>
          <p className="text-slate-500 text-sm">Escritório Responsável: <span className="font-bold text-slate-800 uppercase">{userOrg || 'Carregando...'}</span></p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
        >
          <IconPlus /> Nova Empresa
        </button>
      </header>

      {/* Barra de Busca */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
          <IconSearch />
        </span>
        <input 
          type="text" 
          placeholder="Buscar por Razão Social ou CNPJ..." 
          className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-600 text-[11px] font-bold uppercase tracking-wider">
              <th className="px-6 py-4">Razão Social / Identificação</th>
              <th className="px-6 py-4">Documento (CNPJ)</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEmpresas.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-slate-800">{emp.razao_social}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">ID: {emp.id.split('-')[0]}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 font-mono tracking-tighter">
                  {emp.cnpj}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
                    emp.status === 'Ativa' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {emp.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredEmpresas.length === 0 && !loading && (
          <div className="p-20 text-center text-slate-400 italic">Nenhuma empresa encontrada para este escritório.</div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 text-left">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6 text-left">Adicionar à base: {userOrg}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Razão Social</label>
                <input 
                  required 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/10 outline-none" 
                  onChange={(e) => setFormData({...formData, razao_social: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">CNPJ</label>
                <input 
                  required 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/10" 
                  onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 text-slate-400 font-bold text-xs uppercase">Cancelar</button>
                <button type="submit" className="flex-[2] bg-blue-600 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-md shadow-blue-500/20">Cadastrar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}