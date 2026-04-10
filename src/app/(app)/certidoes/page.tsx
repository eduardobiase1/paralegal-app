'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

export default function CertidoesPage() {
  const { orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [data, setData] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    empresa_id: '',
    tipo: '',
    orgao_emissor: '',
    data_emissao: '',
    data_vencimento: '',
    observacoes: '',
  })

  const load = useCallback(async () => {
    const [res, empRes] = await Promise.all([
      supabase.from('certidoes').select('*, empresas(razao_social)').order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social').order('razao_social'),
    ])
    setData(res.data || [])
    setEmpresas(empRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('certidoes').insert([{
      empresa_id: form.empresa_id,
      tipo: form.tipo,
      orgao_emissor: form.orgao_emissor,
      data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null,
      observacoes: form.observacoes || null,
    }])
    if (!error) {
      toast.success('Certidão cadastrada!')
      setModal(false)
      setForm({ empresa_id: '', tipo: '', orgao_emissor: '', data_emissao: '', data_vencimento: '', observacoes: '' })
      load()
    } else {
      toast.error(`Erro: ${error.message}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta certidão?')) return
    await supabase.from('certidoes').delete().eq('id', id)
    setData(prev => prev.filter(i => i.id !== id))
    toast.success('Certidão excluída.')
  }

  const hoje = new Date()
  function vencColor(data_venc: string) {
    if (!data_venc) return 'text-slate-500'
    const diff = Math.ceil((new Date(data_venc).getTime() - hoje.getTime()) / 86400000)
    if (diff < 0) return 'text-red-600 font-bold'
    if (diff <= 30) return 'text-orange-500 font-bold'
    return 'text-slate-700'
  }

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 bg-slate-50 min-h-screen font-sans">
      <header className="flex flex-wrap justify-between items-center gap-3 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Certidões Negativas</h1>
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mt-1">{orgName}</p>
        </div>
        <button onClick={() => setModal(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all whitespace-nowrap">
          + Nova Certidão
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
            <tr>
              <th className="px-6 py-4">Empresa</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Órgão Emissor</th>
              <th className="px-6 py-4">Emissão</th>
              <th className="px-6 py-4">Vencimento</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map(i => (
              <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-slate-800">{i.empresas?.razao_social}</td>
                <td className="px-6 py-4 text-xs uppercase text-slate-600">{i.tipo}</td>
                <td className="px-6 py-4 text-xs text-slate-500">{i.orgao_emissor}</td>
                <td className="px-6 py-4 text-sm font-mono">{i.data_emissao ? new Date(i.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td className={`px-6 py-4 text-sm font-mono ${vencColor(i.data_vencimento)}`}>
                  {i.data_vencimento ? new Date(i.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => handleDelete(i.id)} className="text-red-300 hover:text-red-500 text-xs transition-colors">✕</button>
                </td>
              </tr>
            ))}
            {data.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Nenhuma certidão cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-900">Nova Certidão Negativa</h2>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase">Tipo *</label>
                  <input required value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    placeholder="Ex: Federal, Estadual, Municipal"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Órgão Emissor *</label>
                  <input required value={form.orgao_emissor} onChange={e => setForm({ ...form, orgao_emissor: e.target.value })}
                    placeholder="Ex: Receita Federal"
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
