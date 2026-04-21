// src/app/api/aura/chat/route.ts
// Endpoint de "Aura" — copiloto pedagógico conversacional.
// Usa Claude Haiku para respuestas rápidas y de bajo costo.
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

function buildSystemPrompt(ctx: {
  teacherName?: string
  institutionName?: string
  pathname?: string
  plan?: string
}): string {
  const contextLines: string[] = []
  if (ctx.teacherName)     contextLines.push(`Docente: ${ctx.teacherName}`)
  if (ctx.institutionName) contextLines.push(`Institución: ${ctx.institutionName}`)
  if (ctx.plan)            contextLines.push(`Plan: ${ctx.plan}`)
  if (ctx.pathname)        contextLines.push(`Pantalla actual: ${ctx.pathname}`)

  const pantallaHint = (() => {
    if (!ctx.pathname) return ''
    if (ctx.pathname.startsWith('/dashboard/planificador'))
      return '\n\nEstá en el PLANIFICADOR. Ayuda con: estructurar una planificación, elegir metodología (ERCA/IDC/ACC/ABP/ABPr/Kolb), adaptar actividades, sugerir recursos digitales, generar exámenes o adaptaciones NEE.'
    if (ctx.pathname.startsWith('/dashboard/biblioteca'))
      return '\n\nEstá en la BIBLIOTECA. Ayuda con: organizar materiales, sugerir qué subir, resumir documentos, conectar un documento con una planificación.'
    if (ctx.pathname.startsWith('/dashboard/historial'))
      return '\n\nEstá en HISTORIAL de planificaciones. Ayuda con: buscar planificaciones, generar exámenes a partir de varias planificaciones, reutilizar contenido previo.'
    if (ctx.pathname.startsWith('/dashboard/horarios'))
      return '\n\nEstá en HORARIOS. Ayuda con: organizar bloques horarios, asignación de docentes, configuración del calendario escolar.'
    if (ctx.pathname.startsWith('/dashboard/docente'))
      return '\n\nEstá en el área DOCENTE. Ayuda con: calificaciones, asistencia, tareas, comportamiento, rúbricas.'
    if (ctx.pathname.startsWith('/dashboard/alumno'))
      return '\n\nEstá en el área ESTUDIANTE. Ayuda con: dudas sobre tareas, entregas, materiales de estudio.'
    return ''
  })()

  return `Eres "Aura", el copiloto pedagógico de EduPlan3D para el sistema educativo ecuatoriano (MinEduc).
Eres experto en currículo, planificación didáctica, adaptaciones NEE (sin y con discapacidad, DIAC) y evaluación.

Estilo:
- Tono cálido, profesional, directo. Hablas en español neutro de Ecuador.
- Respuestas CORTAS por defecto (2-6 frases). Sólo amplías si el docente lo pide.
- Usa bullets y negritas sólo cuando clarifican. Evita párrafos largos.
- Si te piden generar una planificación, examen o adaptación COMPLETA, recuerda al docente que use el botón "Generar con IA" del planificador para producir el documento formal; tú aquí eres para conversar, refinar ideas, explicar y resolver dudas.
- Si no sabes algo, dilo. Nunca inventes códigos de DCD, leyes o URLs.

Contexto actual:
${contextLines.join('\n')}${pantallaHint}

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

    // Contexto del usuario
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

    const system = buildSystemPrompt({
      teacherName:     profile?.full_name || undefined,
      institutionName: institutionName || undefined,
      pathname:        pathname || undefined,
      plan:            profile?.plan || undefined,
    })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system,
      messages: trimmed,
    })

    const assistantText = response.content[0]?.type === 'text' ? response.content[0].text : ''

    return NextResponse.json({
      message: { role: 'assistant' as const, content: assistantText },
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
