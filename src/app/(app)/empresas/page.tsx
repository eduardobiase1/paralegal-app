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
  }, [])

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
          data_abertura: data.data_inicio_atividade,
          capital_social: data.capital_social,
          telefone: data.ddd_telefone_1,
          email: data.email
        })
        toast.success("Dossiê completo importado!")
      }
    } catch (e) { toast.error("Erro na consulta") } finally { setIsConsulting(false) }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('empresas').insert([{ ...formData, organizacao: userOrg }])
    if (!error) { setIsModalOpen(false); fetchData(userOrg!); toast.success("Empresa salva!"); }
  }

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen text-left font-sans">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Carteira de Clientes</h1>
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest">{userOrg}</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all">
          + Importar via Receita
        </button>
      </header>

      {/* LISTAGEM */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {empresas.map(emp => (
          <div key={emp.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-2 py-1 rounded-md uppercase border border-emerald-100">{emp.situacao}</span>
              <button onClick={() => setEmpresaSelecionada(emp)} className="text-blue-600 text-[10px] font-black uppercase hover:underline">Ver Dossiê →</button>
            </div>
            <h3 className="font-bold text-slate-900 truncate">{emp.razao_social}</h3>
            <p className="text-slate-400 font-mono text-xs mt-1">{emp.cnpj}</p>
          </div>
        ))}
      </div>

      {/* MODAL DE CADASTRO (Aquele que você viu, agora com scroll e completo) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black mb-6">Importar Cartão CNPJ</h2>
            <div className="flex gap-2 mb-8 bg-slate-50 p-4 rounded-2xl border">
              <input className="flex-1 bg-white border rounded-xl p-3 text-sm font-mono outline-none" placeholder="CNPJ" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
              <button onClick={consultarCNPJ} disabled={isConsulting} className="bg-slate-900 text-white px-6 rounded-xl font-bold text-xs uppercase">{isConsulting ? '...' : 'Consultar'}</button>
            </div>
            <form onSubmit={handleSave} className="grid grid-cols-2 gap-4 text-[10px] font-black text-slate-400 uppercase">
              <div className="col-span-2"><label>Razão Social</label><input readOnly className="w-full bg-slate-50 border p-3 rounded-xl text-sm font-bold text-slate-900 mt-1" value={formData.razao_social} /></div>
              <div><label>Data Abertura</label><input readOnly className="w-full bg-slate-50 border p-3 rounded-xl text-sm mt-1" value={formData.data_abertura} /></div>
              <div><label>Capital Social</label><input readOnly className="w-full bg-slate-50 border p-3 rounded-xl text-sm mt-1" value={formData.capital_social} /></div>
              <div className="col-span-2"><label>Atividade Principal</label><textarea readOnly className="w-full bg-slate-50 border p-3 rounded-xl text-sm mt-1 h-20" value={`${formData.cnae_principal_codigo} - ${formData.cnae_principal_descricao}`} /></div>
              <div className="col-span-2 mt-4 text-blue-600 border-t pt-4">Endereço Completo</div>
              <div className="col-span-2"><label>Logradouro</label><input readOnly className="w-full bg-slate-50 border p-3 rounded-xl text-sm mt-1" value={`${formData.logradouro}, ${formData.numero}`} /></div>
              <div><label>Bairro</label><input readOnly className="w-full bg-slate-50 border p-3 rounded-xl text-sm mt-1" value={formData.bairro} /></div>
              <div><label>Cidade/UF</label><input readOnly className="w-full bg-slate-50 border p-3 rounded-xl text-sm mt-1" value={`${formData.municipio} / ${formData.uf}`} /></div>
              <div className="col-span-2 flex gap-4 mt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg">Salvar na Base</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES (A Ficha completa que você pediu) */}
      {empresaSelecionada && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-3xl rounded-[40px] p-10 shadow-2xl relative">
            <button onClick={() => setEmpresaSelecionada(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 font-black">FECHAR ✕</button>
            <div className="mb-8">
              <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.3em]">Dossiê Empresarial</span>
              <h2 className="text-3xl font-black text-slate-900 mt-2">{empresaSelecionada.razao_social}</h2>
              <p className="font-mono text-slate-400">{empresaSelecionada.cnpj}</p>
            </div>
            <div className="grid grid-cols-3 gap-8 border-t border-slate-100 pt-8 text-left">
              <div><p className="text-[9px] font-black text-slate-400 uppercase">Capital Social</p><p className="font-bold">R$ {empresaSelecionada.capital_social?.toLocaleString()}</p></div>
              <div><p className="text-[9px] font-black text-slate-400 uppercase">Abertura</p><p className="font-bold">{new Date(empresaSelecionada.data_abertura).toLocaleDateString()}</p></div>
              <div><p className="text-[9px] font-black text-slate-400 uppercase">Situação</p><p className="text-emerald-600 font-black uppercase">{empresaSelecionada.situacao}</p></div>
              <div className="col-span-3"><p className="text-[9px] font-black text-slate-400 uppercase">CNAE Principal</p><p className="text-xs font-medium text-slate-600">{empresaSelecionada.cnae_principal_codigo} - {empresaSelecionada.cnae_principal_descricao}</p></div>
              <div className="col-span-2"><p className="text-[9px] font-black text-slate-400 uppercase">Endereço</p><p className="text-xs">{empresaSelecionada.logradouro}, {empresaSelecionada.numero} - {empresaSelecionada.bairro}, {empresaSelecionada.municipio}/{empresaSelecionada.uf}</p></div>
              <div><p className="text-[9px] font-black text-slate-400 uppercase">Contato</p><p className="text-xs font-bold">{empresaSelecionada.email || 'N/A'}</p><p className="text-xs">{empresaSelecionada.telefone || 'N/A'}</p></div>
            </div>
            <div className="mt-10 pt-8 border-t flex gap-4">
               {/* Aqui você vai inserir suas futuras funções depois */}
               <button className="bg-slate-100 text-slate-400 px-6 py-3 rounded-xl text-[10px] font-black uppercase cursor-not-allowed">Editar Dados</button>
               <button className="bg-slate-100 text-slate-400 px-6 py-3 rounded-xl text-[10px] font-black uppercase cursor-not-allowed">Gerar Relatório</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}