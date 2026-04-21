// src/app/api/aura/evaluacion/route.ts
// Generador de evaluaciones (quiz/examen) via Aura.
// Produce: (1) versión regular, (2) adaptada NEE sin discapacidad, (3) DIAC.
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildNeePromptBlock, getNeeType } from '@/lib/pedagogy/nee'
import { fetchCurriculoBlock } from '@/lib/curriculo/lookup'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type TipoPregunta = 'opcion_multiple' | 'verdadero_falso' | 'respuesta_corta' | 'ensayo' | 'resolucion_problema'

interface EvalRequest {
  tema: string
  grado?: string
  asignatura?: string
  numPreguntas?: number
  tipos?: TipoPregunta[]
  nivelDificultad?: 'basico' | 'intermedio' | 'avanzado' | 'mixto'
  incluirRubrica?: boolean
  incluirNeeSinDisc?: boolean
  neeSinDiscCodes?: string[]
  incluirDiac?: boolean
  neeConDiscCode?: string
  diacGradoReal?: string
  diacEstudiante?: string
  instruccionesExtra?: string
}

const TIPOS_LABEL: Record<TipoPregunta, string> = {
  opcion_multiple:     'opción múltiple (4 alternativas, 1 correcta)',
  verdadero_falso:     'verdadero/falso con justificación',
  respuesta_corta:     'respuesta corta',
  ensayo:              'ensayo / pregunta abierta',
  resolucion_problema: 'resolución de problema',
}

function buildEvalPrompt(r: EvalRequest, curriculoBlock: string): string {
  const tipos = (r.tipos && r.tipos.length > 0 ? r.tipos : ['opcion_multiple', 'respuesta_corta'] as TipoPregunta[])
    .map(t => TIPOS_LABEL[t as TipoPregunta])
    .join(', ')
  const n = r.numPreguntas ?? 10
  const dif = r.nivelDificultad || 'mixto'
  const rubrica = r.incluirRubrica ? '\n- Incluye al final una RÚBRICA de evaluación con criterios y puntajes por pregunta.' : ''
  const extra = r.instruccionesExtra ? `\n\nInstrucciones adicionales del docente:\n${r.instruccionesExtra}` : ''

  return `Eres un especialista en evaluación educativa del sistema MinEduc Ecuador.
Genera una EVALUACIÓN SUMATIVA en formato Markdown con el siguiente encabezado:

**INSTITUCIÓN:** _____________  **DOCENTE:** _____________
**ESTUDIANTE:** _____________   **FECHA:** _____________
**ASIGNATURA:** ${r.asignatura || '_____'}  **GRADO:** ${r.grado || '_____'}
**TEMA:** ${r.tema}

${curriculoBlock ? `${curriculoBlock}\n` : ''}
Parámetros:
- Número de preguntas: ${n}
- Tipos permitidos: ${tipos}
- Nivel de dificultad: ${dif}${rubrica}${extra}

Reglas:
1. Numera las preguntas (1., 2., …). Cada pregunta debe indicar su puntaje (ej. *(2 pts)*).
2. En opción múltiple, marca la respuesta correcta con **(correcta)** al lado.
3. Ajusta la dificultad al grado especificado.
4. Lenguaje claro, neutro, ecuatoriano.
5. Incluye al final una sección **"Hoja de respuestas (solo docente)"** con las respuestas.
6. Si procede, incluye un **cuadro de especificaciones** (tabla) antes de las preguntas con: # | Destreza | Tipo | Puntaje.`
}

function buildAdaptedEvalPrompt(r: EvalRequest, base: string, kind: 'nee_sin_disc' | 'diac'): string {
  const neeCodes = kind === 'nee_sin_disc' ? (r.neeSinDiscCodes || []) : (r.neeConDiscCode ? [r.neeConDiscCode] : [])
  const neeBlock = buildNeePromptBlock(neeCodes)
  const gradoReal = kind === 'diac' && r.diacGradoReal ? `\n- Grado curricular REAL del estudiante: ${r.diacGradoReal}` : ''
  const estudiante = kind === 'diac' && r.diacEstudiante ? `\n- Estudiante: ${r.diacEstudiante}` : ''

  const tipoLabel = kind === 'diac' ? 'DIAC (adaptación significativa)' : 'Adaptación NEE sin discapacidad (no significativa)'
  const regla = kind === 'diac'
    ? 'REESCRIBE las preguntas al nivel real del estudiante. Usa vocabulario, contextos y operaciones propias de su grado curricular real. Ajusta cantidad de preguntas y puntaje si es necesario.'
    : 'MANTÉN las destrezas y objetivos evaluados. Adapta SOLO la forma: enunciados más cortos y claros, más tiempo, apoyos visuales, ejemplos iniciales, formato más espaciado, reducir distractores en opción múltiple si procede.'

  return `Genera una versión adaptada de esta evaluación — tipo: ${tipoLabel}.
${estudiante}${gradoReal}

${neeBlock}

REGLA PRINCIPAL: ${regla}

Mantén el mismo encabezado (institución/docente/estudiante/fecha/asignatura/grado/tema) y el mismo estilo Markdown. Al final incluye una sección breve **"Notas para el docente"** explicando qué se adaptó y por qué.

=== EVALUACIÓN ORIGINAL A ADAPTAR ===
${base}
=== FIN EVALUACIÓN ORIGINAL ===`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = (await req.json()) as EvalRequest
    if (!body?.tema || !body.tema.trim()) {
      return NextResponse.json({ error: 'Falta el tema' }, { status: 400 })
    }

    // Inyectar currículo si hay grado + asignatura
    let curriculoBlock = ''
    try {
      curriculoBlock = await fetchCurriculoBlock(supabase as any, {
        grado: body.grado,
        asignatura: body.asignatura,
        tema: body.tema,
      })
    } catch (err) {
      console.error('[Eval Curriculo Error]', err)
    }

    // 1) Evaluación regular
    const regular = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3500,
      messages: [{ role: 'user', content: buildEvalPrompt(body, curriculoBlock) }],
    })
    const regularContent = regular.content[0]?.type === 'text' ? regular.content[0].text : ''

    const variants: Array<{ kind: 'nee_sin_disc' | 'diac'; label: string; content: string }> = []

    // 2) NEE sin discapacidad (si aplica)
    if (body.incluirNeeSinDisc && body.neeSinDiscCodes && body.neeSinDiscCodes.length > 0) {
      const adapted = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3500,
        messages: [{ role: 'user', content: buildAdaptedEvalPrompt(body, regularContent, 'nee_sin_disc') }],
      })
      const txt = adapted.content[0]?.type === 'text' ? adapted.content[0].text : ''
      const labels = body.neeSinDiscCodes.map(c => getNeeType(c)?.label).filter(Boolean).join(', ')
      variants.push({ kind: 'nee_sin_disc', label: `NEE sin discapacidad (${labels})`, content: txt })
    }

    // 3) DIAC con discapacidad (si aplica)
    if (body.incluirDiac && body.neeConDiscCode) {
      const adapted = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3500,
        messages: [{ role: 'user', content: buildAdaptedEvalPrompt(body, regularContent, 'diac') }],
      })
      const txt = adapted.content[0]?.type === 'text' ? adapted.content[0].text : ''
      const nee = getNeeType(body.neeConDiscCode)
      variants.push({ kind: 'diac', label: `DIAC · ${nee?.label || body.neeConDiscCode}`, content: txt })
    }

    return NextResponse.json({
      regular: regularContent,
      variants,
      usage: {
        input_tokens:  regular.usage?.input_tokens  ?? 0,
        output_tokens: regular.usage?.output_tokens ?? 0,
      },
    })
  } catch (err: any) {
    console.error('[POST /api/aura/evaluacion]', err)
    return NextResponse.json({ error: err?.message ?? 'Error generando evaluación' }, { status: 500 })
  }
}
