'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

export default function AlvarasPage() {
  const { orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [dados, setDados] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    empresa_id: '',
    tipo: 'fixo',
    orgao_emissor: '',
    numero: '',
    data_emissao: '',
    data_vencimento: '',
    observacoes: '',
  })

  const load = useCallback(async () => {
    const [res, empRes] = await Promise.all([
      supabase.from('alvaras').select('*, empresas(razao_social)').order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social').order('razao_social'),
    ])
    setDados(res.data || [])
    setEmpresas(empRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('alvaras').insert([{
      empresa_id: form.empresa_id,
      tipo: form.tipo,
      orgao_emissor: form.orgao_emissor,
      numero: form.numero || null,
      data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null,
      observacoes: form.observacoes || null,
    }])
    if (!error) {
      toast.success('Alvará cadastrado!')
      setModal(false)
      setForm({ empresa_id: '', tipo: 'fixo', orgao_emissor: '', numero: '', data_emissao: '', data_vencimento: '', observacoes: '' })
      load()
    } else {
      toast.error(`Erro: ${error.message}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este alvará?')) return
    await supabase.from('alvaras').delete().eq('id', id)
    setDados(prev => prev.filter(i => i.id !== id))
    toast.success('Alvará excluído.')
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
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen font-sans">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alvarás de Funcionamento</h1>
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mt-1">{orgName}</p>
        </div>
        <button onClick={() => setModal(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all">
          + Novo Alvará
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
            <tr>
              <th className="px-6 py-4">Empresa</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Órgão Emissor</th>
              <th className="px-6 py-4">Número</th>
              <th className="px-6 py-4">Vencimento</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dados.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-slate-800">{item.empresas?.razao_social || '—'}</td>
                <td className="px-6 py-4 text-xs uppercase text-slate-600">{item.tipo}</td>
                <td className="px-6 py-4 text-xs text-slate-500">{item.orgao_emissor}</td>
                <td className="px-6 py-4 text-sm font-mono text-slate-600">{item.numero || '—'}</td>
                <td className={`px-6 py-4 text-sm font-mono ${vencColor(item.data_vencimento)}`}>
                  {item.data_vencimento ? new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => handleDelete(item.id)} className="text-red-300 hover:text-red-500 text-xs transition-colors">✕</button>
                </td>
              </tr>
            ))}
            {dados.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Nenhum alvará cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-lg rounded-3xl p-8 border border-slate-200 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 text-slate-900">Novo Alvará de Funcionamento</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Empresa *</label>
                <select required value={form.empresa_id} onChange={e => setForm({ ...form, empresa_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                  <option value="">Selecione...</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Tipo *</label>
                  <select required value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    <option value="fixo">Fixo</option>
                    <option value="temporario">Temporário</option>
                    <option value="provisorio">Provisório</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Órgão Emissor *</label>
                  <input required value={form.orgao_emissor} onChange={e => setForm({ ...form, orgao_emissor: e.target.value })}
                    placeholder="Ex: Prefeitura Municipal"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Número do Alvará</label>
                  <input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Data de Emissão</label>
                  <input type="date" value={form.data_emissao} onChange={e => setForm({ ...form, data_emissao: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div className="col-span-2">
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
