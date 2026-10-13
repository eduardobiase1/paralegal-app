'use client'

/**
 * AtividadeTracker
 * Conta sozinho o tempo de uso do sistema, por módulo e empresa, e o tempo gasto
 * em portais externos abertos a partir do sistema. Alimenta a tela de Produtividade.
 *
 * - Só conta com a aba visível e com mouse/teclado nos últimos 2 minutos.
 * - Link externo aberto pelo sistema → "tarefa externa": o tempo é medido do clique até a volta.
 *   Volta em até 20 min conta direto; acima disso, pergunta antes de registrar.
 */

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import {
  contextoAtual, diaLocal, usuarioAtual, nomeEmpresa,
  atividadeDesativada, marcarSeTabelaAusente, guardarUltimoPortal, definirOrgAtividade,
} from '@/lib/atividade'

const TICK_MS        = 15_000
const OCIOSO_MS      = 2 * 60_000   // sem mouse/teclado → para de contar
const FECHA_BLOCO_MS = 5 * 60_000   // ociosidade longa → próximo uso abre bloco novo
const FLUSH_MS       = 60_000
const MIN_BLOCO_S    = 30           // blocos menores que isso não são gravados
const LIMITE_PORTAL_S = 20 * 60
const PENDENTE_KEY   = 'atividade_portal_pendente'

type Bloco = {
  id?: string; chave: string; modulo: string; empresaId: string | null
  inicio: Date; fim: Date; segundos: number; sujo: boolean
}
type Pendente = { inicio: number; label: string; modulo: string; empresaId: string | null }

function fmtMin(seg: number) {
  const m = Math.max(1, Math.round(seg / 60))
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}min`
}

export default function AtividadeTracker() {
  const { orgId } = useOrg()
  const [supabase] = useState(createClient)
  const bloco       = useRef<Bloco | null>(null)
  const ultimoUso   = useRef(Date.now())
  const ultimoFlush = useRef(Date.now())
  const gravando    = useRef(false)
  const pendente    = useRef<Pendente | null>(null)
  const [pergunta, setPergunta] = useState<{ p: Pendente; segundos: number } | null>(null)

  useEffect(() => {
    if (!orgId) return
    definirOrgAtividade(orgId)

    async function flush() {
      const b = bloco.current
      if (!b || !b.sujo || b.segundos < MIN_BLOCO_S || gravando.current || atividadeDesativada()) return
      gravando.current = true
      try {
        b.sujo = false
        if (b.id) {
          await supabase.from('atividade_blocos')
            .update({ fim: b.fim.toISOString(), segundos: b.segundos }).eq('id', b.id)
        } else {
          const eu = await usuarioAtual(supabase)
          if (!eu) return
          const { data, error } = await supabase.from('atividade_blocos').insert([{
            org_id: orgId, usuario: eu.nome, dia: diaLocal(b.inicio),
            inicio: b.inicio.toISOString(), fim: b.fim.toISOString(), segundos: b.segundos,
            tipo: 'sistema', modulo: b.modulo,
            empresa_id: b.empresaId, empresa_nome: await nomeEmpresa(supabase, b.empresaId),
          }]).select('id').single()
          if (error) marcarSeTabelaAusente(error)
          else if (data) b.id = data.id
        }
        ultimoFlush.current = Date.now()
      } catch {
        // não crítico
      } finally {
        gravando.current = false
      }
    }

    async function tick() {
      if (atividadeDesativada()) return
      const agora = Date.now()
      const ocioso = agora - ultimoUso.current

      if (document.hidden || ocioso > OCIOSO_MS) {
        await flush()
        if (ocioso > FECHA_BLOCO_MS) bloco.current = null
        return
      }

      const ctx = contextoAtual()
      if (!bloco.current || bloco.current.chave !== ctx.chave) {
        await flush()
        bloco.current = {
          chave: ctx.chave, modulo: ctx.modulo, empresaId: ctx.empresaId,
          inicio: new Date(agora - TICK_MS), fim: new Date(agora), segundos: 0, sujo: false,
        }
      }
      const b = bloco.current
      b.segundos += TICK_MS / 1000
      b.fim = new Date(agora)
      b.sujo = true
      if (agora - ultimoFlush.current > FLUSH_MS) await flush()
    }

    // ── Portais externos ──────────────────────────────────────
    async function salvarPortal(p: Pendente, segundos: number, estimado: boolean) {
      if (atividadeDesativada()) return null
      const eu = await usuarioAtual(supabase)
      if (!eu) return null
      const inicio = new Date(p.inicio)
      const { data, error } = await supabase.from('atividade_blocos').insert([{
        org_id: orgId, usuario: eu.nome, dia: diaLocal(inicio),
        inicio: inicio.toISOString(), fim: new Date(p.inicio + segundos * 1000).toISOString(),
        segundos: Math.round(segundos), tipo: 'portal', modulo: p.modulo,
        empresa_id: p.empresaId, empresa_nome: await nomeEmpresa(supabase, p.empresaId),
        descricao: p.label, estimado,
      }]).select('id').single()
      if (error) { marcarSeTabelaAusente(error); return null }
      if (data) guardarUltimoPortal(data.id, p.empresaId)
      return data?.id ?? null
    }

    function limparPendente() {
      pendente.current = null
      try { localStorage.removeItem(PENDENTE_KEY) } catch {}
    }

    async function voltouDoPortal() {
      const p = pendente.current
      if (!p || document.hidden) return
      const segundos = (Date.now() - p.inicio) / 1000
      if (segundos < 5) return // o clique ainda não tirou o foco da aba
      limparPendente()
      ultimoUso.current = Date.now()

      if (segundos > LIMITE_PORTAL_S) { setPergunta({ p, segundos }); return }

      const id = await salvarPortal(p, segundos, false)
      if (!id) return
      toast(t => (
        <span className="flex items-center gap-3 text-sm">
          <span><b>{p.label}</b>: {fmtMin(segundos)} registrados</span>
          <button
            onClick={async () => {
              await supabase.from('atividade_blocos').delete().eq('id', id)
              toast.dismiss(t.id)
            }}
            className="text-xs font-bold text-blue-600 hover:underline flex-shrink-0">
            Desfazer
          </button>
        </span>
      ), { duration: 7000 })
    }

    function onClick(e: MouseEvent) {
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || a.target !== '_blank' || !/^https?:/i.test(a.href)) return
      let host = ''
      try { host = new URL(a.href).host } catch { return }
      if (host === window.location.host) return
      const ctx = contextoAtual()
      const p: Pendente = {
        inicio: Date.now(),
        label: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60) || host,
        modulo: ctx.modulo, empresaId: ctx.empresaId,
      }
      pendente.current = p
      try { localStorage.setItem(PENDENTE_KEY, JSON.stringify(p)) } catch {}
      flush()
    }

    // Tarefa externa que ficou aberta (navegador fechado, saiu para o almoço...)
    try {
      const raw = localStorage.getItem(PENDENTE_KEY)
      if (raw) {
        const p = JSON.parse(raw) as Pendente
        const segundos = (Date.now() - p.inicio) / 1000
        if (segundos > 4 * 3600) {
          // muito antigo para perguntar — registra o teto, marcado como estimado
          localStorage.removeItem(PENDENTE_KEY)
          salvarPortal(p, LIMITE_PORTAL_S, true)
        } else if (segundos > LIMITE_PORTAL_S) {
          // voltou depois do logout por inatividade: pergunta do mesmo jeito
          localStorage.removeItem(PENDENTE_KEY)
          setPergunta({ p, segundos })
        } else {
          pendente.current = p
          voltouDoPortal()
        }
      }
    } catch {}

    const marcarUso = () => { ultimoUso.current = Date.now() }
    const onVisibility = () => { if (document.hidden) flush(); else voltouDoPortal() }

    const eventosUso = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    eventosUso.forEach(ev => window.addEventListener(ev, marcarUso, { passive: true }))
    document.addEventListener('click', onClick, true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', voltouDoPortal)
    window.addEventListener('pagehide', flush)
    const timer = setInterval(tick, TICK_MS)

    return () => {
      clearInterval(timer)
      eventosUso.forEach(ev => window.removeEventListener(ev, marcarUso))
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', voltouDoPortal)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [supabase, orgId])

  async function responder(segundos: number | null, estimado: boolean) {
    const q = pergunta
    setPergunta(null)
    if (!q || segundos === null) return
    const eu = await usuarioAtual(supabase)
    if (!eu) return
    const inicio = new Date(q.p.inicio)
    const { data } = await supabase.from('atividade_blocos').insert([{
      org_id: orgId, usuario: eu.nome, dia: diaLocal(inicio),
      inicio: inicio.toISOString(), fim: new Date(q.p.inicio + segundos * 1000).toISOString(),
      segundos: Math.round(segundos), tipo: 'portal', modulo: q.p.modulo,
      empresa_id: q.p.empresaId, empresa_nome: await nomeEmpresa(supabase, q.p.empresaId),
      descricao: q.p.label, estimado,
    }]).select('id').single()
    if (data) guardarUltimoPortal(data.id, q.p.empresaId)
  }

  if (!pergunta) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Produtividade</p>
        <h2 className="text-base font-bold text-slate-900 leading-snug">
          Você ficou {fmtMin(pergunta.segundos)} fora do sistema.
        </h2>
        <p className="text-sm text-slate-600 mt-1.5">
          Contar esse tempo para <b>{pergunta.p.label}</b>?
        </p>
        <div className="flex flex-col gap-2 mt-5">
          <button onClick={() => responder(pergunta.segundos, false)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 transition-all">
            Sim, {fmtMin(pergunta.segundos)}
          </button>
          <button onClick={() => responder(LIMITE_PORTAL_S, true)}
            className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-100 transition-all">
            Só {fmtMin(LIMITE_PORTAL_S)}
          </button>
          <button onClick={() => responder(null, false)}
            className="px-4 py-2.5 rounded-xl text-slate-500 text-sm font-semibold hover:bg-slate-50 transition-all">
            Não contar
          </button>
        </div>
      </div>
    </div>
  )
}
