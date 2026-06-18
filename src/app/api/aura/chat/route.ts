// src/app/api/aura/chat/route.ts
// Endpoint de "Aura" — copiloto pedagógico conversacional.
// Usa Claude Haiku para respuestas rápidas y de bajo costo.
//
// Aura tiene acceso contextual a:
//  1) Perfil del docente + institución
//  2) Últimas planificaciones del historial (resumen)
//  3) Listado de materiales de la biblioteca del docente
//  4) Contenido completo de 1-2 planificaciones si el mensaje las referencia
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

interface PlanSummary {
  id: string
  title: string
  subject: string | null
  grade: string | null
  topic: string | null
  trimestre?: number | null
  parcial?: number | null
  semana?: number | null
  created_at: string
}

interface LibraryDoc {
  titulo: string | null
  asignatura?: string | null
  grado?: string | null
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Detecta referencias a una planificación concreta en el último mensaje del docente.
 * Heurísticas:
 *  - "S6", "semana 6", "sem 6" → match por metadata.semana
 *  - "T1-P1-S6" → trimestre/parcial/semana
 *  - Coincidencia por subject y/o topic (palabras clave del título)
 */
function pickRelevantPlans(lastUserText: string, plans: PlanSummary[]): PlanSummary[] {
  if (!plans.length || !lastUserText) return []
  const text = stripAccents(lastUserText)

  // Patrones T/P/S
  const semMatch = text.match(/\bs(?:em(?:ana)?)?\s*(\d{1,2})\b/)
  const triMatch = text.match(/\bt(?:rimestre)?\s*(\d)\b/)
  const parMatch = text.match(/\bp(?:arcial)?\s*(\d)\b/)

  const sem = semMatch ? Number(semMatch[1]) : null
  const tri = triMatch ? Number(triMatch[1]) : null
  const par = parMatch ? Number(parMatch[1]) : null

  const scored = plans.map(p => {
    let score = 0
    if (sem != null && p.semana === sem)      score += 5
    if (tri != null && p.trimestre === tri)   score += 3
    if (par != null && p.parcial === par)     score += 3

    const hay = stripAccents(`${p.title || ''} ${p.subject || ''} ${p.topic || ''}`)
    // Palabras clave relevantes del texto (> 3 letras, no muy comunes)
    const kws = text.split(/\W+/).filter(w => w.length > 3)
    for (const kw of kws) {
      if (hay.includes(kw)) score += 1
    }
    return { p, score }
  })
    .filter(x => x.score >= 3)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, 2).map(x => x.p)
}

function buildContextBlock(args: {
  teacherName?: string
  institutionName?: string
  plan?: string
  pathname?: string
  plans: PlanSummary[]
  fullPlans: Array<{ p: PlanSummary; content: string }>
  library: LibraryDoc[]
}): string {
  const { teacherName, institutionName, plan, pathname, plans, fullPlans, library } = args

  const lines: string[] = []
  lines.push('=== CONTEXTO DEL DOCENTE ===')
  if (teacherName)     lines.push(`Docente: ${teacherName}`)
  if (institutionName) lines.push(`Institución: ${institutionName}`)
  if (plan)            lines.push(`Plan: ${plan}`)
  if (pathname)        lines.push(`Pantalla actual: ${pathname}`)
  lines.push('')

  if (plans.length > 0) {
    lines.push('=== HISTORIAL DE PLANIFICACIONES (resumen, más recientes primero) ===')
    lines.push('Usa esta lista cuando el docente mencione una semana, parcial, asignatura o tema ya planificado.')
    lines.push('')
    plans.forEach((p, i) => {
      const tps = [
        p.trimestre != null ? `T${p.trimestre}` : null,
        p.parcial   != null ? `P${p.parcial}`   : null,
        p.semana    != null ? `S${p.semana}`    : null,
      ].filter(Boolean).join('-')
      const tpsLabel = tps ? ` [${tps}]` : ''
      lines.push(`${i + 1}. ${p.title}${tpsLabel}  ·  ${p.subject ?? '—'} / ${p.grade ?? '—'}  ·  tema: ${p.topic ?? '—'}`)
    })
    lines.push('')
  } else {
    lines.push('=== HISTORIAL DE PLANIFICACIONES ===')
    lines.push('(El docente aún no tiene planificaciones guardadas.)')
    lines.push('')
  }

  if (fullPlans.length > 0) {
    lines.push('=== PLANIFICACIÓN(ES) REFERENCIADA(S) — CONTENIDO COMPLETO ===')
    lines.push('El último mensaje del docente parece referirse a estas planificaciones. Úsalas como base real para responder.')
    lines.push('')
    fullPlans.forEach(({ p, content }) => {
      lines.push(`--- ${p.title} ---`)
      lines.push(content.slice(0, 6000))
      lines.push('--- FIN ---')
      lines.push('')
    })
  }

  if (library.length > 0) {
    lines.push('=== BIBLIOTECA DEL DOCENTE (materiales disponibles) ===')
    lines.push('Si el docente pide trabajar sobre una asignatura o tema que coincida, sugiere qué material puede usar.')
    lines.push('')
    library.forEach((d, i) => {
      const meta = [d.asignatura, d.grado].filter(Boolean).join(' / ')
      lines.push(`${i + 1}. ${d.titulo ?? '(sin título)'}${meta ? `  ·  ${meta}` : ''}`)
    })
    lines.push('')
  }

  lines.push('=== FIN CONTEXTO ===')
  return lines.join('\n')
}

function buildPantallaHint(pathname?: string): string {
  if (!pathname) return ''
  if (pathname.startsWith('/dashboard/planificador'))
    return '\n\nEstá en el PLANIFICADOR. Ayuda con: estructurar una planificación, elegir metodología (ERCA/IDC/ACC/ABP/ABPr/Kolb), adaptar actividades, sugerir recursos digitales, generar exámenes o adaptaciones NEE.'
  if (pathname.startsWith('/dashboard/historial'))
    return '\n\nEstá en HISTORIAL de planificaciones. Ayuda con: buscar planificaciones, reutilizar contenido previo, adaptar actividades de una semana específica.'
  return ''
}

function buildSystemPrompt(contextBlock: string, pantallaHint: string): string {
  return `Eres "Aura", el copiloto pedagógico de EduPlan3D para el sistema educativo ecuatoriano (MinEduc).
Eres experto en currículo, planificación didáctica, adaptaciones NEE (sin y con discapacidad, DIAC) y evaluación.

Estilo:
- Tono cálido, profesional, directo. Hablas en español neutro de Ecuador.
- Respuestas CORTAS por defecto (2-6 frases). Sólo amplías si el docente lo pide.
- Usa bullets y negritas sólo cuando clarifican. Evita párrafos largos.
- Si te piden generar una planificación, examen o adaptación COMPLETA, recuerda al docente que use el botón "Generar con IA" del planificador para producir el documento formal; tú aquí eres para conversar, refinar ideas, explicar y resolver dudas.
- Si no sabes algo, dilo. Nunca inventes códigos de DCD, leyes o URLs.

IMPORTANTE — USO DEL CONTEXTO:
- Abajo recibes el HISTORIAL de planificaciones del docente (resumen) y, si aplica, el CONTENIDO COMPLETO de las planificaciones que el mensaje referencia (por ej. "semana 6" o "S6 de Lengua").
- NUNCA digas que no tienes acceso al historial o a la biblioteca. SÍ tienes acceso. Si la lista está vacía es porque el docente aún no ha guardado nada.
- Cuando el docente mencione una planificación (por semana, asignatura o tema), identifícala en el historial y responde en base a ella. Si no la ves, dilo y pide precisión ("No encuentro una planificación de Lengua — Semana 6 en tu historial. ¿Cómo se llama exactamente?").
- Cuando recomiendes materiales, cita los títulos que aparecen en la BIBLIOTECA.

${contextBlock}${pantallaHint}

Acciones rápidas sugeridas al docente cuando apliquen:
- Explicar una metodología (ERCA, IDC, ACC, Kolb, ABP, ABPr).
- Sugerir actividades concretas para un tema.
- Proponer adaptaciones para un tipo de NEE específico.
- Redactar preguntas de evaluación (con rúbrica).
- Reformular un objetivo, indicador o criterio.`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : []
    const pathname: string = typeof body?.pathname === 'string' ? body.pathname : ''

    if (messages.length === 0) {
      return NextResponse.json({ error: 'Falta messages' }, { status: 400 })
    }

    // Límite defensivo: últimos 20 mensajes
    const trimmed = messages.slice(-20).map(m => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: String(m.content ?? '').slice(0, 8000),
    }))

    const lastUser = [...trimmed].reverse().find(m => m.role === 'user')?.content || ''

    // ── Contexto: perfil + institución ─────────────────────────────────────────
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('full_name, plan, institution_id')
      .eq('id', user.id)
      .single()

    let institutionName = ''
    if (profile?.institution_id) {
      const { data: inst } = await (supabase as any)
        .from('institutions')
        .select('name')
        .eq('id', profile.institution_id)
        .single()
      institutionName = inst?.name || ''
    }

    // ── Historial de planificaciones (últimas 15, resumen) ────────────────────
    let plans: PlanSummary[] = []
    try {
      const { data: rows } = await (supabase as any)
        .from('planificaciones')
        .select('id, title, subject, grade, topic, metadata, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15)
      plans = (rows || []).map((r: any) => ({
        id:         r.id,
        title:      r.title || '(sin título)',
        subject:    r.subject ?? null,
        grade:      r.grade ?? null,
        topic:      r.topic ?? null,
        trimestre:  r.metadata?.trimestre ?? null,
        parcial:    r.metadata?.parcial ?? null,
        semana:     r.metadata?.semana ?? null,
        created_at: r.created_at,
      }))
    } catch (err) {
      console.error('[Aura chat] historial error', err)
    }

    // ── Si el mensaje referencia una semana/planificación, traer contenido ────
    const relevant = pickRelevantPlans(lastUser, plans)
    const fullPlans: Array<{ p: PlanSummary; content: string }> = []
    if (relevant.length > 0) {
      try {
        const { data: rows } = await (supabase as any)
          .from('planificaciones')
          .select('id, content')
          .in('id', relevant.map(r => r.id))
        const byId = new Map<string, string>((rows || []).map((r: any) => [r.id, r.content || '']))
        for (const p of relevant) {
          fullPlans.push({ p, content: byId.get(p.id) || '' })
        }
      } catch (err) {
        console.error('[Aura chat] plan content error', err)
      }
    }

    // ── Biblioteca del docente (títulos, no contenido) ────────────────────────
    let library: LibraryDoc[] = []
    try {
      if (profile?.plan === 'planner_solo') {
        const { data: rows } = await (supabase as any)
          .from('planner_reference_docs')
          .select('titulo, file_name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25)
        library = (rows || []).map((r: any) => ({ titulo: r.titulo || r.file_name || null }))
      } else {
        const { data: rows } = await (supabase as any)
          .from('documentos')
          .select('titulo, asignatura, grado')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25)
        library = (rows || []).map((r: any) => ({
          titulo:     r.titulo ?? null,
          asignatura: r.asignatura ?? null,
          grado:      r.grado ?? null,
        }))
      }
    } catch (err) {
      console.error('[Aura chat] biblioteca error', err)
    }

    const contextBlock = buildContextBlock({
      teacherName:     profile?.full_name || undefined,
      institutionName: institutionName || undefined,
      plan:            profile?.plan || undefined,
      pathname:        pathname || undefined,
      plans,
      fullPlans,
      library,
    })
    const pantallaHint = buildPantallaHint(pathname)
    const system = buildSystemPrompt(contextBlock, pantallaHint)

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system,
      messages: trimmed,
    })

    let assistantText = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const wasTruncated = response.stop_reason === 'max_tokens'
    if (wasTruncated) {
      assistantText += '\n\n*[⚠️ Respuesta cortada por límite de tokens. Pídeme la continuación o solicita una versión más corta.]*'
    }

    return NextResponse.json({
      message: { role: 'assistant' as const, content: assistantText },
      truncated: wasTruncated,
      usage: {
        input_tokens:  response.usage?.input_tokens  ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
    })
  } catch (err: any) {
    console.error('[POST /api/aura/chat]', err)
    return NextResponse.json({ error: err?.message ?? 'Error en Aura' }, { status: 500 })
  }
}
