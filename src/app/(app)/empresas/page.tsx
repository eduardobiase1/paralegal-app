'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

export default function EmpresasPage() {
  const { orgId, orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [empresas, setEmpresas] = useState<any[]>([])
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
    console.log('🔍 useOrg() →', { orgId, orgName })
    if (orgId && orgName) fetchData()
  }, [orgId, orgName])

  async function fetchData() {
    setLoading(true)

    // Tenta primeiro por org_id (UUID — registros novos e pós-migração)
    const { data: byId } = await supabase
      .from('empresas')
      .select('*')
      .eq('org_id', orgId)
      .order('razao_social')

    if (byId && byId.length > 0) {
      setEmpresas(byId)
      setLoading(false)
      return
    }

    // Fallback: filtra por nome da organização (campo texto — registros legados)
    const { data: byName } = await supabase
      .from('empresas')
      .select('*')
      .eq('organizacao', orgName)
      .order('razao_social')

    setEmpresas(byName || [])
    setLoading(false)
  }

  async function consultarCNPJ() {
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) return toast.error("CNPJ inválido (mínimo 14 números)")

    setIsConsulting(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)
      const d = await res.json()

      if (res.ok) {
        setFormData({
          ...initialForm,
          cnpj: cnpjLimpo,
          razao_social: d.razao_social || '',
          nome_fantasia: d.nome_fantasia || '********',
          situacao: d.descricao_situacao_cadastral || 'ATIVA',
          data_situacao_cadastral: d.data_situacao_cadastral || '',
          data_abertura: d.data_inicio_atividade || '',
          logradouro: d.logradouro || '',
          numero: d.numero || '',
          complemento: d.complemento || '',
          cep: d.cep || '',
          bairro: d.bairro || '',
          municipio: d.municipio || '',
          uf: d.uf || '',
          email: d.email || '',
          telefone: d.ddd_telefone_1 || '',
          natureza_juridica: d.natureza_juridica || '',
          porte: d.porte || '',
          capital_social: d.capital_social || 0,
          cnae_principal_codigo: d.cnae_fiscal || '',
          cnae_principal_descricao: d.cnae_fiscal_descricao || '',
          cnaes_secundarios: d.cnaes_secundarios || [],
          qsa: d.qsa || []
        })
        toast.success("Importação concluída!")
      } else {
        toast.error("CNPJ não encontrado")
      }
    } catch (e) {
      toast.error("Erro na consulta")
    } finally {
      setIsConsulting(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('empresas').upsert([{
      ...formData,
      org_id: orgId,
      organizacao: orgName,
    }])
    if (!error) {
      fetchData()
      setIsModalOpen(false)
      setFormData(initialForm)
      toast.success("Empresa salva!")
    } else {
      toast.error("Erro ao salvar: " + error.message)
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir empresa permanentemente?")) return
    const { error } = await supabase.from('empresas').delete().eq('id', id)
    if (!error) {
      fetchData()
      toast.success("Empresa removida")
    }
  }

  if (loading) return <div className="p-10 text-slate-400 italic font-sans">Sincronizando carteira...</div>

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen font-sans text-left">
      <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestão de Portfólio</h1>
        </div>
        <button onClick={() => { setFormData(initialForm); setIsModalOpen(true); }} className="bg-black text-yellow-400 px-6 py-3 rounded-xl text-xs font-bold transition-all hover:bg-slate-800">
          + NOVO CNPJ
        </button>
      </header>

      {/* LISTA DE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {empresas.map(emp => (
          <div key={emp.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-yellow-400 transition-all shadow-sm relative group">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-50 text-slate-500 uppercase">{emp.situacao}</span>
              <div className="flex gap-2">
                <button onClick={() => { setFormData(emp); setIsModalOpen(true); }} className="text-slate-300 hover:text-blue-500 transition-colors">✎</button>
                <button onClick={() => handleExcluir(emp.id)} className="text-slate-300 hover:text-red-500 transition-colors">✕</button>
              </div>
            </div>
            <h3 className="font-bold text-slate-800 text-sm mb-1 truncate uppercase">{emp.razao_social}</h3>
            <p className="text-slate-400 font-mono text-[10px] mb-4">{emp.cnpj}</p>
            <button onClick={() => setEmpresaSelecionada(emp)} className="w-full py-2 bg-black text-yellow-400 rounded-lg text-[10px] font-bold uppercase hover:opacity-90">
              ABRIR CARTÃO
            </button>
          </div>
        ))}
        {empresas.length === 0 && (
          <div className="col-span-4 py-20 text-center text-slate-400 italic">Nenhuma empresa cadastrada.</div>
        )}
      </div>

      {/* MODAL CARTÃO PARALEGAL PRO */}
      {empresaSelecionada && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl max-h-[95vh] overflow-y-auto border-4 border-black relative">

            {/* BOTÃO FECHAR CARTÃO */}
            <button onClick={() => setEmpresaSelecionada(null)} className="absolute top-2 right-2 z-[110] bg-red-600 text-white w-10 h-10 rounded-full font-black flex items-center justify-center shadow-lg hover:scale-110 transition-all">✕</button>

            <div className="p-6 border-b-2 border-black bg-black text-yellow-400 sticky top-0 z-[105]">
              <div className="text-center">
                <h2 className="text-3xl font-black italic tracking-tighter">PARALEGAL PRO</h2>
                <h3 className="text-[10px] font-bold uppercase text-white mt-1 tracking-[0.3em]">Gestão de Dados Empresariais</h3>
              </div>
              <div className="grid grid-cols-4 border-2 border-yellow-400 mt-4 text-[10px] bg-white text-black">
                <div className="p-2 border-r-2 border-yellow-400">
                   <p className="text-[7px] text-slate-400 font-bold uppercase">CNPJ</p>
                   {empresaSelecionada.cnpj}
                </div>
                <div className="p-2 border-r-2 border-yellow-400 col-span-2 text-center flex items-center justify-center font-black uppercase text-xs">
                   Comprovante de Situação Cadastral
                </div>
                <div className="p-2">
                   <p className="text-[7px] text-slate-400 font-bold uppercase">ABERTURA</p>
                   {empresaSelecionada.data_abertura?.split('-').reverse().join('/')}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-px bg-slate-100">
               <div className="bg-white border-2 border-black p-2"><p className="text-[7px] text-slate-400 font-bold">NOME EMPRESARIAL</p><p className="text-[11px] font-black uppercase">{empresaSelecionada.razao_social}</p></div>
               <div className="grid grid-cols-4 bg-black gap-px border-x-2 border-black">
                 <div className="bg-white p-2 col-span-3 border-b-2 border-black"><p className="text-[7px] text-slate-400 font-bold uppercase">NOME DE FANTASIA</p><p className="text-[10px] font-bold uppercase">{empresaSelecionada.nome_fantasia}</p></div>
                 <div className="bg-white p-2 border-b-2 border-black border-l-2 border-black"><p className="text-[7px] text-slate-400 font-bold uppercase">PORTE</p><p className="text-[10px] font-bold uppercase">{empresaSelecionada.porte}</p></div>
               </div>
               <div className="bg-white border-2 border-black p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">ATIVIDADE ECONÔMICA PRINCIPAL</p><p className="text-[9px] font-bold">{empresaSelecionada.cnae_principal_codigo} - {empresaSelecionada.cnae_principal_descricao}</p></div>
               <div className="bg-white border-2 border-black border-t-0 p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">ATIVIDADES ECONÔMICAS SECUNDÁRIAS</p>
                 <div className="max-h-24 overflow-y-auto mt-1">
                   {empresaSelecionada.cnaes_secundarios?.map((c: any, i: number) => (
                     <p key={i} className="text-[8px] font-medium leading-tight mb-1">{c.codigo} - {c.descricao}</p>
                   ))}
                 </div>
               </div>
               <div className="bg-white border-2 border-black border-t-0 p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">NATUREZA JURÍDICA</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.natureza_juridica}</p></div>
               <div className="grid grid-cols-6 border-2 border-black border-t-0 bg-black gap-px">
                 <div className="bg-white p-2 col-span-4"><p className="text-[7px] text-slate-400 font-bold uppercase">LOGRADOURO</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.logradouro}</p></div>
                 <div className="bg-white p-2 border-l-2 border-black"><p className="text-[7px] text-slate-400 font-bold uppercase">NÚMERO</p><p className="text-[9px] font-bold">{empresaSelecionada.numero}</p></div>
                 <div className="bg-white p-2 border-l-2 border-black"><p className="text-[7px] text-slate-400 font-bold uppercase">COMPL.</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.complemento}</p></div>
               </div>
               <div className="grid grid-cols-4 border-2 border-black border-t-0 bg-black gap-px">
                 <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">CEP</p><p className="text-[9px] font-bold">{empresaSelecionada.cep}</p></div>
                 <div className="bg-white p-2 border-l-2 border-black"><p className="text-[7px] text-slate-400 font-bold uppercase">BAIRRO</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.bairro}</p></div>
                 <div className="bg-white p-2 border-l-2 border-black"><p className="text-[7px] text-slate-400 font-bold uppercase">MUNICÍPIO</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.municipio}</p></div>
                 <div className="bg-white p-2 border-l-2 border-black"><p className="text-[7px] text-slate-400 font-bold uppercase">UF</p><p className="text-[9px] font-bold uppercase">{empresaSelecionada.uf}</p></div>
               </div>
               <div className="grid grid-cols-2 border-2 border-black border-t-0 bg-black gap-px">
                 <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">SITUAÇÃO</p><p className="text-[10px] font-black text-emerald-600">{empresaSelecionada.situacao}</p></div>
                 <div className="bg-white p-2 border-l-2 border-black"><p className="text-[7px] text-slate-400 font-bold uppercase">CAPITAL SOCIAL</p><p className="text-[10px] font-bold">R$ {Number(empresaSelecionada.capital_social || 0).toLocaleString('pt-BR')}</p></div>
               </div>
            </div>

            <div className="p-6">
              <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-4">SÓCIOS E ADMINISTRADORES</h4>
              <div className="grid grid-cols-2 gap-3">
                {empresaSelecionada.qsa?.map((s: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-50 border-l-4 border-yellow-400 rounded-r-lg">
                    <p className="text-[9px] font-black uppercase">{s.nome || s.nome_socio}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">{s.qualificacao}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CADASTRO/EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left">
          <div className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl relative">

            {/* BOTÃO FECHAR CADASTRO */}
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 font-black">FECHAR ✕</button>

            <h2 className="text-xl font-bold mb-6 text-slate-800">{formData.id ? 'Atualizar Empresa' : 'Importar Empresa'}</h2>
            <div className="flex gap-2 mb-6 text-left">
              <input className="flex-1 bg-slate-50 border p-3 rounded-xl text-sm font-mono outline-none" placeholder="00.000.000/0000-00" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
              <button onClick={consultarCNPJ} disabled={isConsulting} className="bg-black text-yellow-400 px-6 rounded-xl font-bold text-xs uppercase transition-all">{isConsulting ? '...' : 'BUSCAR'}</button>
            </div>
            {formData.razao_social && (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-yellow-400">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Identificada</p>
                  <p className="text-sm font-bold text-slate-900 uppercase truncate mt-1">{formData.razao_social}</p>
                </div>
                <button type="submit" className="w-full bg-black text-yellow-400 py-4 rounded-xl font-bold text-xs uppercase shadow-xl hover:bg-slate-800">
                  CONFIRMAR E SALVAR
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
