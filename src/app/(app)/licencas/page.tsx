'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

export default function LicencasPage() {
  const { orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [dados, setDados] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    empresa_id: '',
    orgao: 'VISA_MUNICIPAL',
    numero_licenca: '',
    atividade_sanitaria: '',
    data_emissao: '',
    data_vencimento: '',
    observacoes: '',
  })

  const load = useCallback(async () => {
    const [res, empRes] = await Promise.all([
      supabase.from('licencas_sanitarias').select('*, empresas(razao_social)').order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social').order('razao_social'),
    ])
    setDados(res.data || [])
    setEmpresas(empRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('licencas_sanitarias').insert([{
      empresa_id: form.empresa_id,
      orgao: form.orgao,
      numero_licenca: form.numero_licenca || null,
      atividade_sanitaria: form.atividade_sanitaria || null,
      data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null,
      observacoes: form.observacoes || null,
    }])
    if (!error) {
      toast.success('Licença cadastrada!')
      setModal(false)
      setForm({ empresa_id: '', orgao: 'VISA_MUNICIPAL', numero_licenca: '', atividade_sanitaria: '', data_emissao: '', data_vencimento: '', observacoes: '' })
      load()
    } else {
      toast.error(`Erro: ${error.message}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta licença?')) return
    await supabase.from('licencas_sanitarias').delete().eq('id', id)
    setDados(prev => prev.filter(i => i.id !== id))
    toast.success('Licença excluída.')
  }

  const hoje = new Date()
  function vencColor(data_venc: string) {
    if (!data_venc) return 'text-slate-500'
    const diff = Math.ceil((new Date(data_venc).getTime() - hoje.getTime()) / 86400000)
    if (diff < 0) return 'text-red-600 font-bold'
    if (diff <= 30) return 'text-orange-500 font-bold'
    return 'text-slate-700'
  }

  if (loading) return <div className="p-10 font-sans text-slate-400">Carregando...</div>

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 bg-slate-50 min-h-screen font-sans">
      <header className="flex flex-wrap justify-between items-center gap-3 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Licenças Sanitárias</h1>
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mt-1">{orgName}</p>
        </div>
        <button onClick={() => setModal(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all whitespace-nowrap">
          + Nova Licença
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
            <tr>
              <th className="px-6 py-4">Empresa</th>
              <th className="px-6 py-4">Órgão</th>
              <th className="px-6 py-4">Nº Licença</th>
              <th className="px-6 py-4">Atividade</th>
              <th className="px-6 py-4">Vencimento</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dados.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-slate-800">{item.empresas?.razao_social || '—'}</td>
                <td className="px-6 py-4 text-xs uppercase text-slate-600">{item.orgao}</td>
                <td className="px-6 py-4 text-sm font-mono text-slate-600">{item.numero_licenca || '—'}</td>
                <td className="px-6 py-4 text-xs text-slate-500">{item.atividade_sanitaria || '—'}</td>
                <td className={`px-6 py-4 text-sm font-mono ${vencColor(item.data_vencimento)}`}>
                  {item.data_vencimento ? new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => handleDelete(item.id)} className="text-red-300 hover:text-red-500 text-xs transition-colors">✕</button>
                </td>
              </tr>
            ))}
            {dados.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Nenhuma licença sanitária cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-900">Nova Licença Sanitária</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Empresa *</label>
                <select required value={form.empresa_id} onChange={e => setForm({ ...form, empresa_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                  <option value="">Selecione...</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Órgão *</label>
                  <select required value={form.orgao} onChange={e => setForm({ ...form, orgao: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    <option value="VISA_MUNICIPAL">VISA Municipal</option>
                    <option value="ANVISA">ANVISA</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Nº da Licença</label>
                  <input value={form.numero_licenca} onChange={e => setForm({ ...form, numero_licenca: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Atividade Sanitária</label>
                  <input value={form.atividade_sanitaria} onChange={e => setForm({ ...form, atividade_sanitaria: e.target.value })}
                    placeholder="Ex: Manipulação de alimentos"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Data de Emissão</label>
                  <input type="date" value={form.data_emissao} onChange={e => setForm({ ...form, data_emissao: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Data de Vencimento</label>
                  <input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Observações</label>
                <input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancelar</button>
                <button type="submit" className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
