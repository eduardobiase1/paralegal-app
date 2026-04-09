'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// DEFINIÇÃO TÉCNICA DOS PROCESSOS (Checklist Especialista)
const MODELOS_PROCESSOS: any = {
  "Abertura": [
    { etapa: "Viabilidade", status: "Pendente" },
    { etapa: "DBE (Receita Federal)", status: "Pendente" },
    { etapa: "Viabilidade Municipal", status: "Pendente" },
    { etapa: "FCPJ / Integrador Estadual", status: "Pendente" },
    { etapa: "Assinatura Digital / Protocolo", status: "Pendente" },
    { etapa: "Registro na Junta/Cartório", status: "Pendente" },
    { etapa: "Inscrição Municipal / Alvará", status: "Pendente" }
  ],
  "Alteração": [
    { etapa: "Viabilidade (se houver endereço/nome)", status: "Pendente" },
    { etapa: "DBE de Alteração", status: "Pendente" },
    { etapa: "Redação do Aditivo", status: "Pendente" },
    { etapa: "Protocolo Integrador", status: "Pendente" },
    { etapa: "Atualização Cadastral (Prefeitura/Órgãos)", status: "Pendente" }
  ],
  "Transformação": [
    { etapa: "Ata de Transformação / Contrato Social", status: "Pendente" },
    { etapa: "DBE de Natureza Jurídica", status: "Pendente" },
    { etapa: "Protocolo Junta Comercial", status: "Pendente" },
    { etapa: "Enquadramento ME/EPP", status: "Pendente" }
  ],
  "Encerramento": [
    { etapa: "Distrato Social", status: "Pendente" },
    { etapa: "Certidões de Baixa", status: "Pendente" },
    { etapa: "DBE de Extinção", status: "Pendente" },
    { etapa: "Protocolo de Baixa", status: "Pendente" },
    { etapa: "Baixa na Prefeitura/Estado", status: "Pendente" }
  ]
}

export default function SocietarioPage() {
  const [supabase] = useState(createClient())
  const [processos, setProcessos] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [userOrg, setUserOrg] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Inicie o tipo como 'Abertura' para bater com o primeiro item do select
  const [formData, setFormData] = useState({ empresa_id: '', tipo: 'Abertura' })

  const fetchData = useCallback(async (org: string) => {
    setLoading(true)
    const { data: proc } = await supabase.from('processos_societarios').select('*, empresas(razao_social)').eq('organizacao', org).order('created_at', { ascending: false })
    const { data: emp } = await supabase.from('empresas').select('id, razao_social').eq('organizacao', org).order('razao_social')
    setProcessos(proc || [])
    setEmpresas(emp || [])
    setLoading(false)
  }, [supabase])

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
  }, [supabase, fetchData])

  async function handleIniciar(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.empresa_id) {
      return toast.error("Selecione uma empresa para continuar")
    }

    const checklist = MODELOS_PROCESSOS[formData.tipo]
    
    const { error } = await supabase.from('processos_societarios').insert([{
      ...formData,
      organizacao: userOrg,
      checklist: checklist,
      status: 'Em Andamento'
    }])

    if (!error) {
      toast.success("Processo Iniciado com Checklist Especialista!")
      setIsModalOpen(false)
      setFormData({ empresa_id: '', tipo: 'Abertura' }) // Limpa o form
      if (userOrg) fetchData(userOrg)
    } else {
      toast.error("Erro ao iniciar processo")
    }
  }

  async function updateEtapa(procId: string, checklist: any[], index: number) {
    const statusCycle: any = { "Pendente": "Em Andamento", "Em Andamento": "Concluído", "Concluído": "Pendente" }
    const newChecklist = [...checklist]
    newChecklist[index].status = statusCycle[newChecklist[index].status]

    const concluidos = newChecklist.filter(i => i.status === "Concluído").length
    const progresso = Math.round((concluidos / newChecklist.length) * 100)

    const { error } = await supabase.from('processos_societarios').update({ 
      checklist: newChecklist,
      status: progresso === 100 ? 'Finalizado' : 'Em Andamento'
    }).eq('id', procId)

    if (!error && userOrg) fetchData(userOrg)
  }

  const getStatusColor = (status: string) => {
    if (status === "Concluído") return "bg-emerald-500 border-emerald-600 text-white"
    if (status === "Em Andamento") return "bg-blue-500 border-blue-600 text-white"
    return "bg-white border-slate-200 text-slate-400"
  }

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-left font-sans text-slate-900">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">PARALEGAL PRO <span className="text-yellow-500">| SOCIETÁRIO</span></h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{userOrg}</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-black text-yellow-400 px-8 py-3 rounded-2xl font-bold text-xs shadow-xl hover:scale-105 transition-all">
          + NOVO PROCESSO
        </button>
      </header>

      <div className="space-y-8">
        {processos.map(p => {
          const concluido = p.checklist?.filter((i:any) => i.status === "Concluído").length || 0
          const total = p.checklist?.length || 1
          const porc = Math.round((concluido / total) * 100)

          return (
            <div key={p.id} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{p.tipo}</span>
                  <h3 className="text-xl font-black text-slate-800 uppercase mt-1">{p.empresas?.razao_social}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Progresso {porc}%</p>
                  <div className="w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${porc}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-4">
                {p.checklist?.map((item: any, i: number) => (
                  <button 
                    key={i} 
                    onClick={() => updateEtapa(p.id, p.checklist, i)}
                    className={`p-3 rounded-xl border-2 text-[9px] font-black uppercase leading-tight transition-all text-left h-16 flex flex-col justify-between ${getStatusColor(item.status)} shadow-sm`}
                  >
                    <span>{item.etapa}</span>
                    <span className="opacity-60 text-[7px]">{item.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL DE CADASTRO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-[40px] w-full max-w-md border-t-8 border-yellow-400 shadow-2xl relative text-left">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 font-bold text-slate-300 hover:text-red-500">FECHAR ✕</button>
              <h2 className="text-2xl font-black mb-8 tracking-tighter">Iniciar Novo Processo</h2>
              
              <form onSubmit={handleIniciar} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Empresa</label>
                  <select 
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400 text-slate-800"
                    value={formData.empresa_id}
                    onChange={e => setFormData({...formData, empresa_id: e.target.value})}
                    required
                  >
                    <option value="">Selecione...</option>
                    {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de Serviço</label>
                  <select 
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400 text-slate-800"
                    value={formData.tipo}
                    onChange={e => setFormData({...formData, tipo: e.target.value})}
                  >
                    {Object.keys(MODELOS_PROCESSOS).map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-black text-yellow-400 py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all mt-4"
                >
                  INICIAR PROCESSO SOCIETÁRIO
                </button>
              </form>
          </div>
        </div>
      )}
    </div>
  )
}