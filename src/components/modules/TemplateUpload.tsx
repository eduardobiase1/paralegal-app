'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

interface Props {
  onSuccess: () => void
}

export default function TemplateUpload({ onSuccess }: Props) {
  const { orgId } = useOrg()
  const [supabase] = useState(createClient)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { toast.error('Selecione um arquivo .docx'); return }
    if (!nome) { toast.error('Digite um nome para o template'); return }

    setLoading(true)

    const safeName = file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
      .replace(/[^a-zA-Z0-9._-]/g, '_')                  // substitui espaços e especiais por _
    const fileName = `${Date.now()}_${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('contratos-templates')
      .upload(fileName, file)

    if (uploadError) {
      toast.error('Erro ao fazer upload: ' + uploadError.message)
      setLoading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('contratos-templates')
      .getPublicUrl(fileName)

    const { error: dbError } = await supabase
      .from('contract_templates')
      .insert({
        nome,
        descricao: descricao || null,
        arquivo_url: publicUrl,
        arquivo_nome: file.name,
        org_id: orgId,
      })

    setLoading(false)

    if (dbError) {
      toast.error('Erro ao salvar template: ' + dbError.message)
      return
    }

    toast.success('Template cadastrado!')
    setFile(null)
    setNome('')
    setDescricao('')
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="label">Nome do Template *</label>
        <input className="input" required placeholder="Ex: Contrato Social Ltda" value={nome}
          onChange={e => setNome(e.target.value)} />
      </div>
      <div>
        <label className="label">Descrição</label>
        <input className="input" placeholder="Ex: Contrato para abertura de Ltda simples" value={descricao}
          onChange={e => setDescricao(e.target.value)} />
      </div>
      <div>
        <label className="label">Arquivo Word (.docx) *</label>
        <div className="border-2 border-dashed rounded-xl p-6 text-center hover:border-primary-400 transition-colors">
          {file ? (
            <div>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
              <button type="button" onClick={() => setFile(null)} className="text-sm text-red-500 mt-2">
                Remover
              </button>
            </div>
          ) : (
            <label className="cursor-pointer">
              <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600">Arraste ou clique para selecionar</p>
              <p className="text-xs text-gray-400 mt-1">Use marcadores {"{{variavel}}"} no texto do Word</p>
              <input type="file" accept=".docx" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
        <strong>Como usar variáveis no Word:</strong> Escreva {"{{razao_social}}"}, {"{{cnpj}}"}, {"{{socio_1_nome}}"} etc.
        no texto do documento. O sistema substituirá automaticamente pelos dados preenchidos.
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Enviando...' : 'Cadastrar Template'}
      </button>
    </form>
  )
}
