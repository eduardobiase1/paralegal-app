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

  const [formData, setFormData] = useState<any>({ cnpj: '' })

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
          cnpj: cnpjLimpo,
          razao_social: data.razao_social || '',
          nome_fantasia: data.nome_fantasia || 'NÃO INFORMADO',
          situacao: data.descricao_situacao_cadastral || '',
          data_abertura: data.data_inicio_atividade || '',
          capital_social: data.capital_social || 0,
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          municipio: data.municipio || '',
          uf: data.uf || '',
          cep: data.cep || '',
          email: data.email || '',
          telefone: data.ddd_telefone_1 || '',
          natureza_juridica: data.natureza_juridica || '',
          porte: data.porte || '',
          cnae_principal_codigo: String(data.cnae_fiscal || ''),
          cnae_principal_descricao: data.cnae_fiscal_descricao || '',
          cnaes_secundarios: data.cnaes_secundarios || [], 
          qsa: data.qsa || [] 
        })
        toast.success("Dados da Receita carregados!")
      }
    } catch (e) { toast.error("Erro na consulta") } finally { setIsConsulting(false) }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userOrg) return
    const { error } = await supabase.from('empresas').insert([{ ...formData, organizacao: userOrg }])
    if (!error) { 
      setIsModalOpen(false)
      fetchData(userOrg)
      toast.success("Empresa salva com sucesso!") 
    } else { toast.error(`Erro: ${error.message}`) }
  }

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-sans text-left">
      <header className="flex justify-between items-center bg-white p-8 rounded-[40px] border shadow-sm">
        <div className="text-left">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Gestão de Portfólio</h1>
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.4em] mt-1">{userOrg}</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-10 py-5 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-2xl hover:scale-105 transition-all">
          Importar Cartão CNPJ
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {empresas.map(emp => (
          <div key={emp.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group text-left">
            <span className="text-[9px] font-black px-3 py-1 rounded-full bg-slate-50 text-slate-400 border uppercase">{emp.porte}</span>
            <h3 className="font-bold text-slate-900 text-xl mt-4 leading-tight truncate">{emp.razao_social}</h3>
            <p className="text-slate-400 font-mono text-xs mt-2">{emp.cnpj}</p>
            <button onClick={() => setEmpresaSelecionada(emp)} className="mt-8 w-full py-4 bg-slate-50 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest group-hover:bg-blue-600 group-hover:text-white transition-all">
              Abrir Dossiê Completo
            </button>
          </div>
        ))}
      </div>

      {/* MODAL IMPORTAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center z-50 p-6 text-left">
          <div className="bg-white w-full max-w-4xl rounded-[50px] p-12 shadow-2xl max-h-[90vh] overflow-y-auto border border-white">
            <h2 className="text-3xl font-black mb-10 tracking-tighter">Consulta Automática Receita</h2>
            <div className="flex gap-4 mb-12 bg-slate-50 p-6 rounded-[30px] border">
              <input className="flex-1 bg-white border-none rounded-2xl p-5 text-sm font-mono outline-none shadow-inner" placeholder="00.000.000/0000-00" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
              <button onClick={consultarCNPJ} className="bg-slate-900 text-white px-10 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all">
                {isConsulting ? 'Consultando...' : 'Consultar'}
              </button>
            </div>
            {formData.razao_social && (
              <form onSubmit={handleSave} className="grid grid-cols-2 gap-8 text-left">
                <div className="col-span-2 bg-blue-50/50 p-6 rounded-[30px] border border-blue-100">
                  <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Razão Social Identificada</label>
                  <p className="text-xl font-bold text-blue-900 mt-1 uppercase">{formData.razao_social}</p>
                </div>
                <div className="col-span-2 flex gap-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-6 text-slate-400 font-black text-[10px] uppercase">Abortar</button>
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-6 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl">Gravar na Carteira</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DOSSIÊ COMPLETO (ONDE TUDO APARECE) */}
      {empresaSelecionada && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-2xl flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white w-full max-w-5xl rounded-[60px] p-16 shadow-2xl relative max-h-[90vh] overflow-y-auto border border-white">
            <button onClick={() => setEmpresaSelecionada(null)} className="absolute top-12 right-12 text-slate-300 hover:text-red-500 font-black text-2xl">✕</button>
            
            <header className="mb-16">
              <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.5em]">Cartão CNPJ Digital</span>
              <h2 className="text-5xl font-black text-slate-900 mt-4 leading-none tracking-tighter">{empresaSelecionada.razao_social}</h2>
              <div className="flex gap-4 mt-6">
                <p className="font-mono text-slate-400 bg-slate-100 px-4 py-2 rounded-xl text-sm">{empresaSelecionada.cnpj}</p>
                <p className="font-black text-emerald-500 text-[10px] uppercase bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 self-center tracking-widest">{empresaSelecionada.situacao}</p>
              </div>
            </header>

            <div className="grid grid-cols-4 gap-12 text-left mb-16">
              <div><h4 className="text-[10px] font-black text-slate-300 uppercase mb-3">Capital Social</h4><p className="text-xl font-bold text-slate-800">R$ {Number(empresaSelecionada.capital_social || 0).toLocaleString('pt-BR')}</p></div>
              <div><h4 className="text-[10px] font-black text-slate-300 uppercase mb-3">Abertura</h4><p className="text-xl font-bold text-slate-800">{empresaSelecionada.data_abertura?.split('-').reverse().join('/')}</p></div>
              <div className="col-span-2"><h4 className="text-[10px] font-black text-slate-300 uppercase mb-3">Natureza Jurídica</h4><p className="text-sm font-bold text-slate-800">{empresaSelecionada.natureza_juridica}</p></div>
            </div>

            <div className="grid grid-cols-2 gap-16 border-t pt-16 text-left">
              {/* QUADRO DE SÓCIOS */}
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3"><span className="w-2 h-2 bg-blue-600 rounded-full"></span> Quadro de Sócios (QSA)</h3>
                <div className="space-y-4">
                  {empresaSelecionada.qsa && empresaSelecionada.qsa.length > 0 ? (
                    empresaSelecionada.qsa.map((socio: any, i: number) => (
                      <div key={i} className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 text-left">
                        <p className="text-xs font-black text-slate-900 uppercase">{socio.nome || socio.nome_socio}</p>
                        <p className="text-[10px] font-bold text-blue-500 uppercase mt-1">{socio.qualificacao || socio.codigo_qualificacao_socio}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-xs italic">Nenhum sócio listado.</p>
                  )}
                </div>
              </div>

              {/* ATIVIDADES ECONÔMICAS */}
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3"><span className="w-2 h-2 bg-blue-600 rounded-full"></span> Atividades Econômicas</h3>
                <div className="bg-blue-50/30 p-6 rounded-[24px] border border-blue-100 mb-6 text-left">
                  <p className="text-[9px] font-black text-blue-400 uppercase mb-2">Principal</p>
                  <p className="text-xs font-bold text-blue-900 leading-tight">{empresaSelecionada.cnae_principal_descricao}</p>
                </div>
                <div className="space-y-3">
                   {empresaSelecionada.cnaes_secundarios?.map((c: any, i: number) => (
                     <div key={i} className="bg-slate-50 p-4 rounded-xl text-[10px] font-bold text-slate-500 text-left">{c.descricao}</div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}