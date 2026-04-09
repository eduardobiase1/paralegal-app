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

  const initialForm = {
    cnpj: '', razao_social: '', nome_fantasia: '', situacao: '', data_situacao_cadastral: '',
    data_abertura: '', logradouro: '', numero: '', complemento: '', cep: '',
    bairro: '', municipio: '', uf: '', email: '', telefone: '',
    cnae_principal_codigo: '', cnae_principal_descricao: '', cnaes_secundarios: [],
    natureza_juridica: '', porte: '', capital_social: 0, qsa: []
  }

  const [formData, setFormData] = useState<any>(initialForm)

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
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)
      const d = await res.json()
      if (res.ok) {
        setFormData({
          ...initialForm,
          cnpj: cnpjLimpo,
          razao_social: d.razao_social,
          nome_fantasia: d.nome_fantasia || '********',
          situacao: d.descricao_situacao_cadastral,
          data_situacao_cadastral: d.data_situacao_cadastral,
          data_abertura: d.data_inicio_atividade,
          logradouro: d.logradouro,
          numero: d.numero,
          complemento: d.complemento || '',
          cep: d.cep,
          bairro: d.bairro,
          municipio: d.municipio,
          uf: d.uf,
          email: d.email || '',
          telefone: d.ddd_telefone_1 || '',
          natureza_juridica: d.natureza_juridica,
          porte: d.porte,
          capital_social: d.capital_social,
          cnae_principal_codigo: d.cnae_fiscal,
          cnae_principal_descricao: d.cnae_fiscal_descricao,
          cnaes_secundarios: d.cnaes_secundarios || [],
          qsa: d.qsa || []
        })
        toast.success("Dados importados!")
      }
    } catch (e) { toast.error("Erro na consulta") } finally { setIsConsulting(false) }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('empresas').upsert([{ ...formData, organizacao: userOrg }])
    if (!error) { fetchData(userOrg!); setIsModalOpen(false); setFormData(initialForm); toast.success("Salvo!"); }
  }

  async function handleExcluir(id: string) {
    if (!confirm("Deseja realmente excluir esta empresa?")) return
    const { error } = await supabase.from('empresas').delete().eq('id', id)
    if (!error) { fetchData(userOrg!); toast.success("Excluída!"); }
  }

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen font-sans text-left">
      <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestão de Portfólio</h1>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{userOrg}</p>
        </div>
        <button onClick={() => { setFormData(initialForm); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-100">
          + NOVO CNPJ
        </button>
      </header>

      {/* LISTAGEM COMPACTA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {empresas.map(emp => (
          <div key={emp.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all shadow-sm relative group">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">{emp.situacao}</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setFormData(emp); setIsModalOpen(true); }} className="text-blue-500 hover:text-blue-700">✎</button>
                <button onClick={() => handleExcluir(emp.id)} className="text-red-400 hover:text-red-600">✕</button>
              </div>
            </div>
            <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1 truncate uppercase">{emp.razao_social}</h3>
            <p className="text-slate-400 font-mono text-[10px] mb-4">{emp.cnpj}</p>
            <button onClick={() => setEmpresaSelecionada(emp)} className="w-full py-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg text-[10px] font-bold uppercase transition-all">
              Ver Cartão CNPJ
            </button>
          </div>
        ))}
      </div>

      {/* MODAL CARTÃO CNPJ (ESTILO RECEITA FEDERAL) */}
      {empresaSelecionada && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl max-h-[95vh] overflow-y-auto border-4 border-slate-800 relative">
            <button onClick={() => setEmpresaSelecionada(null)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 text-2xl font-bold">✕</button>
            
            {/* CABEÇALHO ESTILO RECEITA */}
            <div className="p-6 border-b-2 border-slate-800 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-[8px] text-center uppercase">Brasão<br/>República</div>
                <div className="text-center flex-1 mr-12">
                  <h2 className="text-lg font-bold uppercase leading-tight">República Federativa do Brasil</h2>
                  <h3 className="text-md font-bold uppercase border-t border-slate-300 mt-1 pt-1">Cadastro Nacional da Pessoa Jurídica</h3>
                </div>
              </div>
              <div className="grid grid-cols-4 border-2 border-slate-800 text-[9px] font-bold">
                <div className="p-2 border-r-2 border-slate-800"><p className="text-slate-500 uppercase text-[7px] mb-1">NÚMERO DE INSCRIÇÃO</p>{empresaSelecionada.cnpj}</div>
                <div className="p-2 border-r-2 border-slate-800 col-span-2 text-center flex items-center justify-center font-black text-[11px] uppercase tracking-tighter">Comprovante de Inscrição e de Situação Cadastral</div>
                <div className="p-2"><p className="text-slate-500 uppercase text-[7px] mb-1">DATA DE ABERTURA</p>{empresaSelecionada.data_abertura?.split('-').reverse().join('/')}</div>
              </div>
            </div>

            {/* CORPO DO CARTÃO */}
            <div className="p-6 space-y-px bg-slate-100">
               <div className="bg-white border-2 border-slate-800 p-2"><p className="text-[7px] text-slate-500 uppercase">NOME EMPRESARIAL</p><p className="text-[11px] font-bold uppercase">{empresaSelecionada.razao_social}</p></div>
               
               <div className="grid grid-cols-4 gap-px bg-slate-800 border-x-2 border-slate-800">
                 <div className="bg-white p-2 col-span-3 border-b-2 border-slate-800"><p className="text-[7px] text-slate-500 uppercase">TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA)</p><p className="text-[10px] font-bold uppercase">{empresaSelecionada.nome_fantasia}</p></div>
                 <div className="bg-white p-2 border-b-2 border-slate-800 border-l-2 border-slate-800"><p className="text-[7px] text-slate-500 uppercase">PORTE</p><p className="text-[10px] font-bold uppercase">{empresaSelecionada.porte}</p></div>
               </div>

               <div className="bg-white border-2 border-slate-800 p-2"><p className="text-[7px] text-slate-500 uppercase">CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL</p><p className="text-[9px] font-bold">{empresaSelecionada.cnae_principal_codigo} - {empresaSelecionada.cnae_principal_descricao}</p></div>
               
               <div className="bg-white border-2 border-slate-800 border-t-0 p-2"><p className="text-[7px] text-slate-500 uppercase">CÓDIGO E DESCRIÇÃO DAS ATIVIDADES ECONÔMICAS SECUNDÁRIAS</p>
                 <div className="max-h-32 overflow-y-auto mt-1">
                   {empresaSelecionada.cnaes_secundarios?.map((c: any, i: number) => (
                     <p key={i} className="text-[8px] font-medium leading-tight mb-1">{c.codigo} - {c.descricao}</p>
                   ))}
                 </div>
               </div>

               <div className="bg-white border-2 border-slate-800 border-t-0 p-2"><p className="text-[7px] text-slate-500 uppercase">CÓDIGO E DESCRIÇÃO DA NATUREZA JURÍDICA</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.natureza_juridica}</p></div>

               <div className="grid grid-cols-6 border-2 border-slate-800 border-t-0 bg-slate-800 gap-px">
                 <div className="bg-white p-2 col-span-4"><p className="text-[7px] text-slate-500 uppercase">LOGRADOURO</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.logradouro}</p></div>
                 <div className="bg-white p-2 border-l-2 border-slate-800"><p className="text-[7px] text-slate-500 uppercase">NÚMERO</p><p className="text-[9px] font-bold">{empresaSelecionada.numero}</p></div>
                 <div className="bg-white p-2 border-l-2 border-slate-800"><p className="text-[7px] text-slate-500 uppercase">COMPLEMENTO</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.complemento}</p></div>
               </div>

               <div className="grid grid-cols-4 border-2 border-slate-800 border-t-0 bg-slate-800 gap-px">
                 <div className="bg-white p-2"><p className="text-[7px] text-slate-500 uppercase">CEP</p><p className="text-[9px] font-bold">{empresaSelecionada.cep}</p></div>
                 <div className="bg-white p-2 border-l-2 border-slate-800"><p className="text-[7px] text-slate-500 uppercase">BAIRRO/DISTRITO</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.bairro}</p></div>
                 <div className="bg-white p-2 border-l-2 border-slate-800"><p className="text-[7px] text-slate-500 uppercase">MUNICÍPIO</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.municipio}</p></div>
                 <div className="bg-white p-2 border-l-2 border-slate-800"><p className="text-[7px] text-slate-500 uppercase">UF</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.uf}</p></div>
               </div>

               <div className="grid grid-cols-2 border-2 border-slate-800 border-t-0 bg-slate-800 gap-px">
                 <div className="bg-white p-2"><p className="text-[7px] text-slate-500 uppercase">ENDEREÇO ELETRÔNICO</p><p className="text-[9px] font-bold text-blue-600">{empresaSelecionada.email}</p></div>
                 <div className="bg-white p-2 border-l-2 border-slate-800"><p className="text-[7px] text-slate-500 uppercase">TELEFONE</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.telefone}</p></div>
               </div>

               <div className="grid grid-cols-2 border-2 border-slate-800 border-t-0 bg-slate-800 gap-px">
                 <div className="bg-white p-2"><p className="text-[7px] text-slate-500 uppercase">SITUAÇÃO CADASTRAL</p><p className="text-[10px] font-black text-emerald-600">{empresaSelecionada.situacao}</p></div>
                 <div className="bg-white p-2 border-l-2 border-slate-800"><p className="text-[7px] text-slate-500 uppercase">DATA DA SITUAÇÃO CADASTRAL</p><p className="text-[10px] font-bold">{empresaSelecionada.data_situacao_cadastral || empresaSelecionada.data_abertura}</p></div>
               </div>
            </div>

            {/* SEÇÃO DE SÓCIOS (EXTRA) */}
            <div className="p-6">
              <h4 className="text-[10px] font-black uppercase mb-4 text-slate-400">Quadro de Sócios e Administradores (QSA)</h4>
              <div className="grid grid-cols-2 gap-2">
                {empresaSelecionada.qsa?.map((s: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-50 border rounded-lg">
                    <p className="text-[9px] font-black text-slate-800 uppercase">{s.nome || s.nome_socio}</p>
                    <p className="text-[8px] font-bold text-blue-500 uppercase">{s.qualificacao}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO/EDITAR CNPJ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl">
            <h2 className="text-xl font-bold mb-6">{formData.id ? 'Editar Empresa' : 'Importar Empresa'}</h2>
            <div className="flex gap-2 mb-6">
              <input className="flex-1 bg-slate-50 border p-3 rounded-xl text-sm font-mono outline-none" placeholder="CNPJ" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
              <button onClick={consultarCNPJ} disabled={isConsulting} className="bg-slate-900 text-white px-6 rounded-xl font-bold text-xs uppercase transition-all">{isConsulting ? '...' : 'Importar'}</button>
            </div>
            {formData.razao_social && (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <p className="text-[8px] font-bold text-blue-400 uppercase">Empresa Identificada</p>
                  <p className="text-sm font-bold text-blue-900 uppercase truncate">{formData.razao_social}</p>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-xs uppercase shadow-lg shadow-blue-100">Confirmar e Salvar</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase">Cancelar</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}