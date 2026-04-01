// src/app/api/planificaciones/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { PlanificacionFormData } from '@/types/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildPrompt(data: PlanificacionFormData, contextoExtra: string = ''): string {
  const { subject, grade, topic, duration, type, methodologies, extra } = data
  const met = methodologies.join(', ')

  if (type === 'clase') return `
Actúa como un experto planificador curricular y pedagogo de Ecuador. Tu tarea es generar una Planificación Microcurricular Diaria por Destreza con Criterio de Desempeño (DCD) automatizada, cumpliendo estrictamente con los lineamientos del Ministerio de Educación del Ecuador y el enfoque pedagógico de la editorial EDINUN (Serie Experiencias / Competencia Lingüística).

Para generar la planificación, te proporcionaré el Grado, la Asignatura y el Tema. A partir de ahí, debes crear un documento estructurado con las siguientes directrices y secciones obligatorias, presentadas en tablas de Markdown limpias.

Asignatura: ${subject}
Nivel/Grado: ${grade}
Tema: ${topic}
Duración: ${duration}
Metodologías/Estrategias base: ${met}
${extra ? `Observaciones adicionales: ${extra}` : ''}

${contextoExtra ? `CONTEXTO BIBLIOGRÁFICO OBLIGATORIO:
Basa la materia, actividades y contenido estrictamente en el siguiente texto extraído de la biblioteca del docente:
---
${contextoExtra}
---` : ''}

1. DATOS INFORMATIVOS (Formato de tabla)
Campos: Institución, Asignatura, Grado/Curso, Docente, Fecha, Número de estudiantes (22 por defecto), Tiempo (períodos de 40 minutos).
Añade Unidad Didáctica (6 semanas o 7 para Unidad 1 y 4). Considera la malla curricular: BGU (40 períódos) y BT (45 períodos).

2. COMPONENTES CURRICULARES (Formato de tabla)
- Objetivo de la clase.
- Destreza con Criterio de Desempeño (DCD): Incluyendo el código oficial exacto y descripción.
- Criterio e Indicador de Evaluación: Incluyendo sus códigos oficiales correspondientes.

3. MATRIZ DE DESARROLLO METODOLÓGICO (Formato tabla)
Momentos de la clase: Inicio, Desarrollo y Cierre.
Columnas: Actividades, Estrategias Metodológicas, Recursos, y Evaluación.
- Enfoque DUA: Explícito en Múltiples formas de Implicación (Inicio), Representación (Desarrollo) y Acción/Expresión (Cierre).
- Enfoque EDINUN: Interdisciplinario y neuroeducativo. Incorpora obligatoriamente el uso de plataformas digitales de EDINUN (como Digiaula o entorno Edihub) y recursos multimedia para potenciar habilidades.

4. TÉCNICAS E INSTRUMENTOS DE EVALUACIÓN
Detalla la Técnica (ej. Observación) y el Instrumento (ej. Lista de cotejo). Regla obligatoria: Si es final de unidad (sem 6 o 7), la técnica debe ser explícitamente 'Prueba de base estructurada' y el instrumento 'Cuestionario' como evaluación sumativa.

5. ADAPTACIONES CURRICULARES Y EJE TRANSVERSAL
- Especificaciones de la necesidad educativa y adaptaciones a ser aplicadas (inclusivo y DUA).
- Eje Transversal: "Buen Vivir" (por defecto, enfocado en valores democráticos, socioemocionales y convivencia armónica).

6. OBSERVACIONES Y FIRMAS
Muestra un formato limpio y en blanco para: Observaciones Pedagógicas, Docente, Revisado por, Aprobado por.

Por favor, preséntame el resultado final usando EXCLUSIVAMENTE formato de matriz (tablas de Markdown) limpio, profesional y listo para ser copiado en un documento oficial.`.trim()

  if (type === 'unidad') return `
Eres un experto en diseño curricular para educación secundaria y bachillerato del Ecuador.
Crea una UNIDAD DIDÁCTICA COMPLETA:

Asignatura: ${subject} | Nivel: ${grade} | Duración: ${duration}
Tema central: ${topic}
Metodologías activas: ${met}
${extra ? `Notas del docente: ${extra}` : ''}

Estructura:
1. TÍTULO Y DESCRIPCIÓN DE LA UNIDAD
2. OBJETIVOS GENERALES Y ESPECÍFICOS (mínimo 4)
3. CONTENIDOS (conceptuales, procedimentales, actitudinales)
4. SECUENCIA DE ACTIVIDADES (organizada por sesiones o semanas)
5. RECURSOS DIGITALES Y FÍSICOS
6. EVALUACIÓN (formativa y sumativa con instrumentos)
7. ATENCIÓN A LA DIVERSIDAD
8. CONEXIONES INTERDISCIPLINARES
9. BIBLIOGRAFÍA Y REFERENCIAS

Sé detallado y práctico.`.trim()

  return `
Eres un experto en evaluación educativa para el Ecuador.
Crea una RÚBRICA DE EVALUACIÓN completa:

Asignatura: ${subject} | Nivel: ${grade}
Tema/Actividad: ${topic}
${extra ? `Criterios especiales: ${extra}` : ''}

Incluye:
1. TÍTULO Y PROPÓSITO DE LA EVALUACIÓN
2. INSTRUCCIONES PARA EL DOCENTE
3. TABLA DE RÚBRICA (formato texto claro):
   5 criterios × 4 niveles de desempeño:
   | Criterio | Excelente (10) | Satisfactorio (8) | En proceso (6) | Inicial (4) |
4. ESCALA DE CALIFICACIÓN FINAL
5. RETROALIMENTACIÓN SUGERIDA POR NIVEL
6. AUTOEVALUACIÓN DEL ESTUDIANTE (3 preguntas)

Usa descriptores claros, observables y medibles.`.trim()
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar límite del plan free
    const { data: profile } = await supabase
      .from('profiles').select('plan').eq('id', user.id).single()

    if (profile?.plan === 'free') {
      const { count } = await supabase
        .from('planificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

      if ((count ?? 0) >= 10) {
        return NextResponse.json(
          { error: 'Límite del plan Starter alcanzado (10/mes). Actualiza a Pro para planificaciones ilimitadas.' },
          { status: 403 }
        )
      }
    }

    const body: PlanificacionFormData = await request.json()

    // ─── LÓGICA RAG: EXTRAER PDFs DE LA BIBLIOTECA ───
    let contextoExtra = ''
    try {
      const { data: docs } = await supabase
        .from('documentos')
        .select('storage_path')
        .eq('user_id', user.id)
        .eq('asignatura', body.subject)
        .eq('grado', body.grade)

      if (docs && docs.length > 0) {
        const pdfParse = (await import('pdf-parse')).default

        for (const d of docs) {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('biblioteca')
            .download(d.storage_path)

          if (fileData && !downloadError) {
            const buffer = Buffer.from(await fileData.arrayBuffer())
            const parsed = await pdfParse(buffer)
            // Limit text to avoid overwhelming context bounds if book is gigantic
            contextoExtra += `\nDocumento adjunto:\n${parsed.text.slice(0, 150000)}\n`
          }
        }
      }
    } catch (err) {
      console.error('[RAG Biblioteca Error]', err)
    }

    // Llamar a Anthropic
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(body, contextoExtra) }],
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''

    // Generar título automático
    const titleLine = content.split('\n').find(l => l.trim().length > 5) ?? body.topic
    const title = `${body.subject} — ${body.topic}`.slice(0, 80)

    // Guardar en Supabase
    const { data: saved, error } = await supabase
      .from('planificaciones')
      .insert({
        user_id:       user.id,
        title,
        type:          body.type,
        subject:       body.subject,
        grade:         body.grade,
        topic:         body.topic,
        duration:      body.duration,
        methodologies: body.methodologies,
        content,
        metadata:      { titleLine, generatedAt: new Date().toISOString() },
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ planificacion: saved })
  } catch (err: any) {
    console.error('[POST /api/planificaciones]', err)
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}
