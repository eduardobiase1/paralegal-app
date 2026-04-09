'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function SocietarioPage() {
  const [supabase] = useState(createClient())
  const [processos, setProcessos] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [userOrg, setUserOrg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [formData, setFormData] = useState({ empresa_id: '', tipo: 'Abertura', status: 'Iniciado' })

  // Checklist que você já usava
  const checklistPadrao = [
    { item: "Viabilidade Deferida", feito: false },
    { item: "DBE Transmitido", feito: false },
    { item: "Protocolo na Junta", feito: false },
    { item: "CNPJ Liberado", feito: false }
  ]

  const fetchData = useCallback(async (org: string) => {
    setLoading(true)
    const { data: proc } = await supabase.from('processos_societarios').select('*, empresas(razao_social)').eq('organizacao', org)
    const { data: emp } = await supabase.from('empresas').select('id, razao_social').eq('organizacao', org)
    setProcessos(proc || [])
    setEmpresas(emp || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('organizacao').eq('id', user.id).single()
        if (prof?.organizacao) {
          setUserOrg(prof.organizacao)
          fetchData(prof.organizacao)
        }
      }
    }
    init()
  }, [supabase, fetchData])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('processos_societarios').insert([{
      ...formData,
      organizacao: userOrg,
      checklist: checklistPadrao
    }])
    if (!error) {
      toast.success("Processo criado!");
      setIsModalOpen(false);
      fetchData(userOrg!);
    }
  }

  if (loading) return <div className="p-10">Carregando Módulo Societário...</div>

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-left">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-black italic">PARALEGAL PRO <span className="text-yellow-500">| SOCIETÁRIO</span></h1>
        <button onClick={() => setIsModalOpen(true)} className="bg-black text-yellow-400 px-6 py-2 rounded-lg font-bold text-xs uppercase">
          + NOVO PROCESSO
        </button>
      </header>

      {/* Grid de Processos */}
      <div className="space-y-4">
        {processos.map(p => (
          <div key={p.id} className="bg-white p-6 rounded-2xl border shadow-sm">
            <h3 className="font-bold uppercase text-slate-800">{p.empresas?.razao_social}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              {p.checklist?.map((item: any, i: number) => (
                <div key={i} className={`p-2 rounded border text-[10px] font-bold uppercase ${item.feito ? 'bg-green-50 border-green-500 text-green-700' : 'bg-slate-50 text-slate-400'}`}>
                  {item.feito ? '✓ ' : '○ '}{item.item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-md relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 font-bold">✕</button>
            <h2 className="text-xl font-bold mb-4">Novo Processo</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <select className="w-full border p-3 rounded-xl" onChange={e => setFormData({...formData, empresa_id: e.target.value})} required>
                <option value="">Selecione a Empresa...</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
              </select>
              <input className="w-full border p-3 rounded-xl" placeholder="Tipo de Processo" onChange={e => setFormData({...formData, tipo: e.target.value})} required />
              <button className="w-full bg-black text-yellow-400 py-3 rounded-xl font-bold uppercase text-xs">Iniciar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}