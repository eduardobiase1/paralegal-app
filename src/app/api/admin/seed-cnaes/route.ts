/**
 * GET /api/admin/seed-cnaes?secret=<SEED_SECRET>
 *
 * Popula o Supabase com:
 *   1. Todos os ~1.300 CNAEs da API pública do IBGE  →  tabela `cnaes`
 *   2. Dados fiscais/licenciamento do CNAES_DB local →  tabela `cnae_fiscal`
 *
 * Variáveis de ambiente necessárias (Vercel / .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL     — URL do projeto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY    — chave service_role (bypass RLS)
 *   SEED_SECRET                  — token de proteção da rota (ex: "minha-senha-seed")
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CNAES_DB } from '@/lib/cnaeTax'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizaCodigo(codigo: string): string {
  return codigo.replace(/[^0-9]/g, '')
}

function formatarCodigo(id: string): string {
  // "8211300" → "8211-3/00"
  const s = String(id).padStart(7, '0')
  return `${s.slice(0, 4)}-${s[4]}/${s.slice(5)}`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Proteção por token
  const secret = req.nextUrl.searchParams.get('secret')
  const expectedSecret = process.env.SEED_SECRET ?? 'paralegal-seed-2026'
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Não autorizado. Informe ?secret=<SEED_SECRET>' }, { status: 401 })
  }

  // Validar env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({
      error: 'Variável SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione no Vercel → Settings → Environment Variables.',
    }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const logs: string[] = []
  const t0 = Date.now()

  try {
    // ── Etapa 1: Buscar todos os CNAEs na API do IBGE ────────────────────────
    logs.push('📥 Buscando CNAEs na API do IBGE...')

    const ibgeRes = await fetch(
      'https://servicodados.ibge.gov.br/api/v2/cnae/subclasses',
      { cache: 'no-store' }
    )
    if (!ibgeRes.ok) throw new Error(`IBGE API retornou HTTP ${ibgeRes.status}`)

    const ibgeData = (await ibgeRes.json()) as Array<{
      id: string
      descricao: string
      classe?: {
        grupo?: {
          divisao?: {
            id?: string
            secao?: { id?: string }
          }
        }
      }
    }>

    logs.push(`✅ ${ibgeData.length} subclasses CNAE recebidas`)

    const cnaeRows = ibgeData.map(item => ({
      codigo:      formatarCodigo(item.id),
      codigo_norm: normalizaCodigo(formatarCodigo(item.id)),
      descricao:   item.descricao,
      secao:       item.classe?.grupo?.divisao?.secao?.id ?? null,
      divisao:     item.classe?.grupo?.divisao?.id ?? null,
    }))

    // ── Etapa 2: Upsert em lotes de 250 ──────────────────────────────────────
    const BATCH = 250
    let totalCnaes = 0
    for (let i = 0; i < cnaeRows.length; i += BATCH) {
      const batch = cnaeRows.slice(i, i + BATCH)
      const { error } = await supabase
        .from('cnaes')
        .upsert(batch, { onConflict: 'codigo' })
      if (error) throw new Error(`Erro ao inserir CNAEs (lote ${i}): ${error.message}`)
      totalCnaes += batch.length
    }
    logs.push(`✅ ${totalCnaes} registros inseridos/atualizados em cnaes`)

    // ── Etapa 3: Popular cnae_fiscal com os dados do nosso banco ─────────────
    logs.push(`📊 Populando ${CNAES_DB.length} registros fiscais...`)

    let okFiscal = 0
    let errFiscal = 0

    for (const item of CNAES_DB) {
      // Garante que o CNAE existe na tabela base (pode não ter vindo do IBGE)
      await supabase.from('cnaes').upsert({
        codigo:      item.codigo,
        codigo_norm: normalizaCodigo(item.codigo),
        descricao:   item.descricao,
      }, { onConflict: 'codigo', ignoreDuplicates: true })

      // Insere dados fiscais
      const { error } = await supabase.from('cnae_fiscal').upsert({
        codigo:              item.codigo,
        anexo_simples:       item.anexoSimples,
        impedido_simples:    item.impedidoSimples,
        motivo_impedimento:  item.motivoImpedimento ?? null,
        fator_r_aplicavel:   item.fatorRAplicavel,
        tipo_atividade:      item.tipoAtividade,
        risco_vigilancia:    item.riscoVigilancia,
        risco_bombeiros:     item.riscoBombeiros,
        conselho_classe:     item.conselhoClasse ?? null,
        licencas:            item.licencasObrigatorias,
        observacoes:         item.observacoes ?? null,
      }, { onConflict: 'codigo' })

      if (error) {
        logs.push(`  ⚠️ ${item.codigo}: ${error.message}`)
        errFiscal++
      } else {
        okFiscal++
      }
    }

    logs.push(`✅ ${okFiscal} fiscais OK${errFiscal > 0 ? ` | ${errFiscal} com erro` : ''}`)

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    logs.push(`🎉 Seed concluído em ${elapsed}s`)

    return NextResponse.json({
      success: true,
      resumo: {
        cnaes_ibge:    totalCnaes,
        fiscais_ok:    okFiscal,
        fiscais_erro:  errFiscal,
        tempo_segundos: parseFloat(elapsed),
      },
      logs,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logs.push(`❌ Erro fatal: ${msg}`)
    return NextResponse.json({ success: false, error: msg, logs }, { status: 500 })
  }
}
