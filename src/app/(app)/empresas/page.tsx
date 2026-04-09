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
  const [empresaSelecionada, setEmpresaSelecionada] = useState<any | null>(null)

  const [formData, setFormData] = useState({
    razao_social: '', nome_fantasia: '', cnpj: '', logradouro: '', numero: '',
    bairro: '', municipio: '', uf: '', cep: '', situacao: '',
    cnae_principal_codigo: '', cnae_principal_descricao: '',
    data_abertura: '', capital_social: 0, telefone: '', email: ''
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
  }, [supabase])

  async function fetchData(org: string) {
    setLoading(true)
    const { data } = await supabase.from('empresas').select('*').eq('organizacao', org).order('razao_social')
    setEmpresas(data || [])
    setLoading(false)
  }

  async function consultarCNPJ() {
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) return toast.error("CNPJ inválido")
    
    setIsConsulting(true)
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)
      const data = await response.json()
      
      if (response.ok) {
        setFormData({
          ...formData,
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia || 'NÃO INFORMADO',
          logradouro: data.logradouro,
          numero: data.numero,
          bairro: data.bairro,
          municipio: data.municipio,
          uf: data.uf,
          cep: data.cep,
          situacao: data.descricao_situacao_cadastral,
          cnae_principal_codigo: String(data.cnae_fiscal),
          cnae_principal_descricao: data.cnae_fiscal_descricao,
          // Mantemos AAAA-MM-DD para o banco não dar erro, mas formatamos na tela
          data_abertura: data.data_inicio_atividade,
          capital_social: data.capital_social || 0,
          telefone: data.ddd_telefone_1,
          email: data.email
        })
        toast.success("Dossiê importado!")
      } else {
        toast.error("CNPJ não encontrado")
      }
    } catch (e) { toast.error("Erro na consulta") } finally { setIsConsulting(false) }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userOrg) return
    
    // Proteção: Garante que capital_social seja número e data esteja no padrão ISO
    const payload = { 
      ...formData, 
      organizacao: userOrg,
      capital_social: Number(formData.capital_social)
    }

    const { error } = await supabase.from('empresas').insert([payload])
    
    if (!error) { 
      setIsModalOpen(false)
      fetchData(userOrg)
      toast.success("Empresa salva com sucesso!") 
    } else {
      console.error(error)
      toast.error(`Erro ao salvar: ${error.message}`)
    }
  }

  // Função auxiliar para exibir data BR na tela sem estragar o banco
  const formatarDataBR = (dataStr: string) => {
    if (!dataStr) return ''
    if (dataStr.includes('/')) return dataStr // Já está formatada
    return dataStr.split('-').reverse().join('/')
  }

  if (loading && !userOrg) return <div className="p-10 text-slate-400 italic font-sans">Carregando carteira...</div>

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen text-left font-sans">
      <header className="flex justify-between items-center bg-white p-8 rounded-[30px] border border-slate-200 shadow-sm">
        <div className="text-left">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Carteira de Clientes</h1>
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] mt-1">{userOrg}</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200">
          + Importar CNPJ
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {empresas.map(emp => (
          <div key={emp.id} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group text-left">
            <div className="flex justify-between items-start mb-6">
              <span className={`text-[9px] font-black px-3 py-1 rounded-full border ${emp.situacao === 'ATIVA' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {emp.situacao}
              </span>
              <button onClick={() => setEmpresaSelecionada(emp)} className="text-slate-400 group-hover:text-blue-600 text-[10px] font-black uppercase tracking-widest transition-colors">Ver Dossiê →</button>
            </div>
            <h3 className="font-bold text-slate-900 text-lg leading-tight mb-2 truncate">{emp.razao_social}</h3>
            <p className="text-slate-400 font-mono text-xs">{emp.cnpj}</p>
          </div>
        ))}
      </div>

      {/* MODAL CADASTRO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-3xl rounded-[40px] p-10 shadow-2xl max-h-[90vh] overflow-y-auto border border-white text-left">
            <h2 className="text-2xl font-black mb-8 text-slate-900">Novo Cadastro via Receita</h2>
            
            <div className="flex gap-3 mb-10 bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div className="flex-1 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">CNPJ da Empresa</label>
                <input className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-mono mt-1 outline-none" placeholder="00.000.000/0000-00" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
              </div>
              <button onClick={consultarCNPJ} disabled={isConsulting} className="mt-5 bg-slate-900 text-white px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600">
                {isConsulting ? '...' : 'Consultar'}
              </button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-2 gap-6">
              <div className="col-span-2 text-left"><label className="text-[10px] font-black text-slate-400 uppercase">Razão Social</label><input readOnly className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold text-slate-800 mt-1" value={formData.razao_social} /></div>
              <div className="text-left"><label className="text-[10px] font-black text-slate-400 uppercase">Abertura</label><input readOnly className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold text-blue-600 mt-1" value={formatarDataBR(formData.data_abertura)} /></div>
              <div className="text-left"><label className="text-[10px] font-black text-slate-400 uppercase">Capital Social</label><input readOnly className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold text-slate-800 mt-1" value={`R$ ${Number(formData.capital_social).toLocaleString('pt-BR')}`} /></div>
              
              <div className="col-span-2 flex gap-4 mt-10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 text-slate-400 font-black text-[10px] uppercase">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-5 rounded-[20px] font-black text-[10px] uppercase tracking-widest shadow-xl">Efetivar Cadastro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALHES */}
      {empresaSelecionada && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-4xl rounded-[50px] p-12 shadow-2xl relative border border-white text-left">
            <button onClick={() => setEmpresaSelecionada(null)} className="absolute top-10 right-10 text-slate-300 hover:text-red-500 font-black">✕</button>
            
            <div className="mb-12">
              <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.4em]">Dossiê Estrutural</span>
              <h2 className="text-4xl font-black text-slate-900 mt-3 leading-tight">{empresaSelecionada.razao_social}</h2>
            </div>

            <div className="grid grid-cols-3 gap-12">
              <div className="text-left"><h4 className="text-[10px] font-black text-slate-300 uppercase mb-2">Fundação</h4><p className="text-lg font-bold">{formatarDataBR(empresaSelecionada.data_abertura)}</p></div>
              <div className="text-left"><h4 className="text-[10px] font-black text-slate-300 uppercase mb-2">Capital Social</h4><p className="text-lg font-bold">R$ {Number(empresaSelecionada.capital_social).toLocaleString('pt-BR')}</p></div>
              <div className="text-left"><h4 className="text-[10px] font-black text-slate-300 uppercase mb-2">Situação</h4><p className="text-emerald-500 font-black">{empresaSelecionada.situacao}</p></div>
              <div className="col-span-3 text-left"><h4 className="text-[10px] font-black text-slate-300 uppercase mb-2">CNAE Fiscal</h4><p className="text-xs font-bold text-slate-500">{empresaSelecionada.cnae_principal_codigo} - {empresaSelecionada.cnae_principal_descricao}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}