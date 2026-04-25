// src/app/api/planificaciones/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getMethodology } from '@/lib/pedagogy/methodologies'
import { buildNeePromptBlock, getNeeType } from '@/lib/pedagogy/nee'
import { fetchCurriculoBlock } from '@/lib/curriculo/lookup'
import { extractDocxRaw } from '@/lib/extract/extractDocxRaw'
import { resolveYearContext } from '@/lib/academic-year/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── System prompt: MINEDUC Specialist ────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un Especialista en Curriculo y Gestion Pedagogica con 20 anios de experiencia en el sistema educativo ecuatoriano. Tu mision es generar planificaciones diarias operativas que cumplan estrictamente con el formato institucional solicitado, basandote PRIORITARIAMENTE en los documentos subidos por el docente (libros, guias, planes previos) y el Curriculo Priorizado MinEduc 2025.

REGLA ABSOLUTA SOBRE DESTREZAS (DCD) — LEE ESTO PRIMERO:
Bajo NINGUNA circunstancia inventes codigos de destrezas (ej. CS.2.1.1, M.3.4.5, LL.4.1.2).
Los codigos y descripciones de destrezas DEBEN provenir exclusivamente de:
  1. El bloque "=== CURRÍCULO PRIORIZADO MinEduc 2025 ===" que recibiras en el contexto del usuario, o
  2. Los documentos del docente que literalmente mencionen codigos con su descripcion textual.
Si el contexto NO contiene una destreza que encaje con el tema, elige la destreza MAS CERCANA de la lista provista y señalalo. Está PROHIBIDO fabricar una destreza aun cuando el tema parezca no estar cubierto — prefiere usar una destreza adyacente del mismo bloque.
Copia el codigo y la descripcion TEXTUALMENTE como aparecen en el contexto. No resumas ni parafrasees la descripcion oficial de la destreza.
Cualquier codigo DCD que no aparezca literalmente en el contexto inyectado se considera alucinacion y hace la planificacion invalida.

ESTRUCUTRA DE SALIDA (DEBES USAR ESTE FORMATO EXACTO):

1. ENCABEZADO DE DATOS (Tabla con Institución, Docente, Asignatura, Grado, Trimestre, Semana, etc.)

2. SECCION DE OBJETIVOS:
- **Objetivos de aprendizaje:** (Extraer de los documentos del docente)
- **Criterios de evaluación:** (Extraer de los documentos del docente)
- **Inserciones curriculares:** (Basado en ejes transversales o temas de actualidad)

3. TABLA DE PLANIFICACIÓN (2. PLANIFICACIÓN):
Columnas exactas:
| Destrezas con Criterios de Desempeño | Estrategias Metodológicas | Recursos | Indicadores de evaluación | Técnicas / Instrumentos |
|---|---|---|---|---|

REGLAS DE ORO:
1. PRIORIDAD ABSOLUTA: Si el docente subió un documento (contexto bibliográfico), extrae de allí los temas, actividades, destrezas, objetivos y criterios de evaluación. NO inventes contenido de internet ni uses la base de datos oficial si el documento ya contiene la información específica. El documento del docente es la VERDAD ÚNICA para esta planificación.
2. TRABAJO EN AULA: Las actividades deben ser diseñadas para completarse al 100% en el salón usando el tiempo calculado.
3. ADAPTACIONES (NEE): Al final de la tabla, añade siempre una sección breve para adaptaciones curriculares.
4. Usa EXCLUSIVAMENTE tablas de Markdown limpias.
5. Los tiempos de cada fase de la estrategia metodológica elegida deben sumar EXACTAMENTE la duración total de la clase.
6. En la columna "Técnicas / Instrumentos", separa la técnica del instrumento con una barra (ej: Observación / Lista de cotejo).
7. Si el currículo oficial ( MinEduc) contradice al documento del docente, HAZ CASO AL DOCENTE. El currículo oficial es solo una guía para códigos y nombres de destrezas.`


// ── Build prompt for each type ───────────────────────────────────────────────
function buildPrompt(data: any, contextoExtra: string = '', detectedPlanification: boolean = false): string {
  const {
    type, subject, grade, topic, duration, extra,
    trimestre, parcial, semana, eje, cuadernillo,
    periodMinutes, weeklyHours, teacherName, institutionName,
    methodology: methodologyCode,
  } = data

  const axis = eje || 'Justicia'
  const methodology = getMethodology(methodologyCode)
  const cuadernilloRef = cuadernillo ? `\nREFERENCIA CUADERNILLO DE TRABAJO: ${cuadernillo}. OBLIGATORIO: usa estos ejercicios en la fase de Aplicacion.` : ''
  const extraNotes = extra ? `\nNOTAS DEL DOCENTE: ${extra}` : ''
  
  // RAG: prioritizing teacher context over official curriculum
  const ragContext = contextoExtra ? `\n\nCONTENIDO DE REFERENCIA (OBLIGATORIO PRIORIZAR ESTO):\n---\n${contextoExtra}\n---

REGLAS OBLIGATORIAS PARA USAR ESTE CONTENIDO:
1. Si en los documentos aparecen DCDs con codigo (LL.4.x.x, M.4.x.x, CS.4.x.x, CN.4.x.x, EFL.4.x.x, LL.5.x.x, etc.), DEBES usar EXACTAMENTE esos codigos y sus descripciones textuales. NO inventes codigos nuevos ni uses los de otros subniveles.
2. Si los documentos mencionan un grado/subnivel especifico (ej. "10mo EGB" = codigos .4.x, "1ro BGU" = codigos .5.x), respeta ese subnivel. El subnivel del documento del docente tiene PRIORIDAD sobre cualquier otro.
3. Los indicadores de evaluacion (I.LL.x.x.x, I.M.x.x.x, etc.) tambien deben extraerse del documento cuando esten presentes.
4. Si hay un tema especifico o unidad declarada en el documento, mantenla — no la cambies por otra.
5. NUNCA mezcles codigos de .4.x (EGB Superior) con .5.x (BGU) en la misma planificacion.
6. Los datos aqui presentes son lo que el docente REALMENTE quiere enseñar. Usa este material por encima de cualquier conocimiento general.` : ''

  const planDetectedNote = detectedPlanification
    ? `\n\nIMPORTANTE — SE DETECTO UNA PLANIFICACION YA ELABORADA EN LOS DOCUMENTOS SUBIDOS:
Uno o mas documentos del docente contienen una planificacion lista. Tu tarea PRINCIPAL es TRANSCRIBIR Y ADAPTAR esa planificacion al formato institucional solicitado, PRESERVANDO la esencia del documento original.`
    : ''

  const commonHeader = `
DATOS DEL CONTEXTO:
- Institucion: ${institutionName || 'Institucion Educativa'}
- Docente: ${teacherName || 'Docente'}
- Asignatura: ${subject}
- Curso/Grado: ${grade}
- Trimestre ${trimestre}, Parcial ${parcial}${semana ? `, Semana ${semana}` : ''}
- Duracion hora pedagogica: ${periodMinutes} minutos
- Carga horaria semanal: ${weeklyHours} horas
- Duracion de esta clase: ${duration}
- Eje Transversal: ${axis}
- Estrategia metodologica (Ciclo): ${methodology.name} (${methodology.description})
${cuadernilloRef}${extraNotes}${ragContext}${planDetectedNote}`

  if (type === 'clase') {
    const isAporte = semana === 6
    return `Genera una PLANIFICACION MICROCURRICULAR DIARIA con el siguiente formato:
${commonHeader}
- Tema: ${topic}
${isAporte ? '- NOTA: Es Semana 6 (APORTE). La evaluación debe ser sumativa.' : ''}

### 1. ENCABEZADO
Tabla con: Institucion, Docente, Asignatura, Grado, Tiempo, Trimestre, Semana.

### 2. SECCION PREVIA
- **Objetivos de aprendizaje:** (Extraer del documento del docente o generar acorde al tema)
- **Criterios de evaluación:** (Extraer del documento o generar)
- **Inserciones curriculares:** (Justicia, Innovación o Solidaridad)

### 2. PLANIFICACIÓN
Genera la tabla principal con estas columnas:

| Destrezas con Criterios de Desempeño | Estrategias Metodológicas | Recursos | Indicadores de evaluación | Técnicas / Instrumentos |
|---|---|---|---|---|

REGLAS PARA CADA COLUMNA:
- **Destrezas**: Codigo y descripcion.
- **Estrategias**: Fases de ${methodology.name} con sus tiempos. Usa <br/> para separar fases.
- **Recursos**: Materiales y enlaces digitales.
- **Indicadores**: Codigo y descripcion.
- **Técnicas / Instrumentos**: Ej: Observación / Lista de cotejo.

IMPORTANTE: NO repitas informacion fuera de la tabla.`.trim()
  }

  if (type === 'unidad') {
    return `Genera una UNIDAD DIDACTICA COMPLETA (6 semanas) con formato MINEDUC:
${commonHeader}
- Tema central: ${topic || 'A determinar segun curriculo'}

Estructura obligatoria:
1. DATOS INFORMATIVOS (tabla)
2. OBJETIVOS: General y Especificos (minimo 4)
3. DESTREZAS CON CRITERIO DE DESEMPENO: Lista con codigos oficiales
4. PLANIFICACION SEMANAL (tabla):
   | Semana | Tema | DCD | Actividades principales | Evaluacion |
   Semanas 1-5: Desarrollo de contenidos
   Semana 6: Evaluacion de Aporte (prueba de base estructurada)
5. RECURSOS por semana
6. EVALUACION: Formativa (semanas 1-5) y Sumativa (semana 6)
7. ADAPTACIONES CURRICULARES (NEE)
8. BIBLIOGRAFIA

Usa tablas Markdown limpias y profesionales.`.trim()
  }

  // Rubrica
  return `Genera una RUBRICA DE EVALUACION con formato MINEDUC:
${commonHeader}
- Tema/Actividad: ${topic}

Estructura:
1. TITULO Y PROPOSITO DE LA EVALUACION
2. INSTRUCCIONES PARA EL DOCENTE
3. TABLA DE RUBRICA:
   | Criterio | Excelente (10) | Satisfactorio (8) | En proceso (6) | Inicial (4) |
   Minimo 5 criterios con descriptores claros, observables y medibles.
   Los criterios deben alinearse a las DCD del curriculo ecuatoriano.
4. ESCALA DE CALIFICACION FINAL
5. RETROALIMENTACION SUGERIDA POR NIVEL
6. AUTOEVALUACION DEL ESTUDIANTE (3 preguntas)
7. ADAPTACIONES PARA NEE

Usa tablas Markdown limpias.`.trim()
}

// ── Clasificador de intención: ¿cada doc es referencia o planificación? ─────
async function classifyDocuments(
  docs: Array<{ titulo: string; text: string }>
): Promise<Array<{ kind: 'referencia' | 'planificacion' }>> {
  if (docs.length === 0) return []

  // Heurística rápida previa (muy barata). Si queda dudoso, llamar Haiku.
  const simple = docs.map(d => {
    const text = d.text.slice(0, 4000).toLowerCase()
    const planSignals = [
      'destreza con criterio',
      'indicador de evaluacion',
      'indicador de evaluación',
      'estrategias metodolog',
      'ciclo erca',
      'experiencia',
      'conceptualizacion',
      'aplicacion',
      'dca:',
      'dcd:',
      'planificacion microcurricular',
      'planificación microcurricular',
    ]
    const hits = planSignals.filter(s => text.includes(s)).length
    return { kind: hits >= 3 ? 'planificacion' as const : 'referencia' as const, hits }
  })

  // Si todos son claramente uno u otro, ahorrar la llamada.
  const allClear = simple.every(s => s.hits === 0 || s.hits >= 4)
  if (allClear) {
    return simple.map(s => ({ kind: s.kind }))
  }

  // Refinar con Haiku solo los ambiguos.
  try {
    const items = docs
      .map((d, i) => `[${i}] ${d.titulo}\n${d.text.slice(0, 2500)}`)
      .join('\n---\n')

    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: 'Eres un clasificador breve de documentos educativos. Responde SOLO JSON sin markdown ni explicacion.',
      messages: [{
        role: 'user',
        content: `Clasifica cada documento como:
- "referencia": material de consulta (libro, cuadernillo, curriculo oficial, tema explicado, articulo, manual).
- "planificacion": un plan de clase ya elaborado con estructura (destrezas, objetivos, actividades secuenciadas, evaluacion) listo para impartir.

Responde un JSON array del mismo tamano que los documentos, con la forma:
[{"index":0,"kind":"referencia"}, {"index":1,"kind":"planificacion"}, ...]

DOCUMENTOS:
${items}`,
      }],
    })

    const text = resp.content[0]?.type === 'text' ? resp.content[0].text : '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed)) {
        return docs.map((_, i) => {
          const entry = parsed.find((p: any) => p?.index === i)
          const kind = entry?.kind === 'planificacion' ? 'planificacion' : 'referencia'
          return { kind }
        })
      }
    }
  } catch (e) {
    console.error('[classifyDocuments fallback]', e)
  }

  // Fallback: usar heurística simple
  return simple.map(s => ({ kind: s.kind }))
}

// ── Prompt para adaptar una planificación ya generada a NEE ──────────────────
function buildNeeAdaptationPrompt(opts: {
  regularContent: string
  kind: 'nee_sin_disc' | 'diac'
  neeCodes: string[]
  studentName?: string
  gradoReal?: string
  subject: string
  grade: string
  topic: string
  duration: string
}): string {
  const { regularContent, kind, neeCodes, studentName, gradoReal, subject, grade, topic, duration } = opts
  const isSignificativa = kind === 'diac'
  const neeBlock = buildNeePromptBlock(neeCodes)
  const studentLine = studentName ? `\n- Estudiante: ${studentName}` : ''
  const gradoRealLine = gradoReal ? `\n- Grado curricular REAL del estudiante: ${gradoReal} (puede ser diferente al del aula)` : ''

  const header = isSignificativa
    ? `Genera una PLANIFICACION ADAPTADA CON DIAC (Documento Individual de Adaptación Curricular).
Esta es una ADAPTACION SIGNIFICATIVA: los objetivos, destrezas y contenidos DEBEN reescribirse al nivel real del estudiante (pueden ser de grados anteriores). El estudiante NO trabaja los mismos objetivos del grupo-clase.`
    : `Genera una PLANIFICACION ADAPTADA NO SIGNIFICATIVA para estudiantes con NEE sin discapacidad.
Se MANTIENEN los objetivos, destrezas y contenidos del grado del aula. Solo se adapta el CÓMO: metodología, tiempos, recursos y evaluación.`

  return `${header}

DATOS:
- Asignatura: ${subject}
- Curso/Grado del aula: ${grade}
- Tema: ${topic}
- Duración de la clase: ${duration}${studentLine}${gradoRealLine}

NECESIDADES EDUCATIVAS A ATENDER:
${neeBlock}

PLANIFICACION REGULAR DE REFERENCIA (la que usa el grupo-clase):
---
${regularContent}
---

INSTRUCCIONES:
1. Produce UNA planificacion completa con la MISMA estructura de secciones que la regular (encabezado, tabla principal, adaptaciones DUA, firmas).
2. Mantén el formato de tabla Markdown con las mismas columnas (DCD, Indicador, Estrategias, Recursos, Evaluación).
3. En la tabla principal, ${isSignificativa
    ? 'REESCRIBE la DCD al nivel real del estudiante. Usa códigos de DCD de ese grado. El indicador debe ser funcional/autónomo, no comparativo con el grupo.'
    : 'MANTÉN la DCD y el indicador del grado. Solo adapta las actividades, recursos y forma de evaluación.'}
4. En la columna de estrategias metodológicas aplica las adaptaciones descritas arriba.
5. En RECURSOS incluye materiales específicos de la adaptación (pictogramas, lector de pantalla, material manipulable, etc.) además de los digitales.
6. En EVALUACION ${isSignificativa
    ? 'usa criterios individualizados propios del DIAC (observación de progreso, evidencias, no comparación con el grupo).'
    : 'usa los MISMOS criterios del grupo, pero adaptados en forma (oral, tiempo extra, apoyos).'}
7. Añade al final una sección "### JUSTIFICACION DE LA ADAPTACION" explicando brevemente por qué esta adaptación responde a la necesidad.
8. Usa tablas Markdown limpias. Las celdas deben tener <br/> para saltos internos.`
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar limite del plan free
    const { data: profile } = await (supabase as any)
      .from('profiles').select('plan, planner_suspended').eq('id', user.id).single() as { data: { plan: string; planner_suspended?: boolean } | null }

    const isPlannerSolo = profile?.plan === 'planner_solo'

    // Bloqueo duro por suscripcion vencida o suspendida manualmente
    if (profile?.planner_suspended === true) {
      return NextResponse.json(
        { error: 'Tu suscripción al planificador está suspendida. Comunícate con el administrador para renovar el pago mensual.' },
        { status: 403 }
      )
    }

    // Resolver año lectivo visible; bloquear si esta en modo historico
    const ycx = await resolveYearContext(user.id)
    if (ycx.hasInstitution && ycx.isReadOnly) {
      return NextResponse.json(
        { error: 'No puedes crear planificaciones en un año lectivo histórico. Vuelve al año actual.' },
        { status: 403 }
      )
    }

    if (profile?.plan === 'free' || profile?.plan === 'institucion') {
      const { count } = await (supabase as any)
        .from('planificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

      const limit = profile.plan === 'free' ? 5 : 10 // Let's say 5 for free and 10 for standard inst
      
      if ((count ?? 0) >= limit) {
        return NextResponse.json(
          { error: `Límite del plan ${profile.plan === 'free' ? 'Básico' : 'Institucional Estándar'} alcanzado (${count}/${limit}). El Planificador IA es un servicio adicional.` },
          { status: 403 }
        )
      }
    }

    const body = await request.json()

    // ── RAG: extract PDFs from teacher library ──
    let contextoExtra = ''
    let detectedPlanification = false
    const ragStats: {
      found: number
      parsed: number
      skipped: number
      reasons: string[]
    } = { found: 0, parsed: 0, skipped: 0, reasons: [] }
    try {
      let refs: Array<{ storage_path: string; bucket: string; titulo?: string }> = []

      if (isPlannerSolo && body.subjectId) {
        // Docente externo: usar planner_reference_docs ligados a la materia seleccionada
        const { data: docs } = await (supabase as any)
          .from('planner_reference_docs')
          .select('storage_path, titulo, file_type, file_name')
          .eq('user_id', user.id)
          .eq('planner_subject_id', body.subjectId)

        refs = (docs || [])
          .filter((d: any) => {
            const ext = (d.file_name?.split('.').pop() || '').toLowerCase()
            return d.file_type?.includes('pdf') || d.file_type?.includes('officedocument') || ['pdf', 'doc', 'docx'].includes(ext)
          })
          .map((d: any) => ({
            storage_path: d.storage_path,
            bucket: 'submissions',
            titulo: d.titulo,
          }))
      } else {
        // Docente institucional: dos fuentes posibles
        //   a) tabla `documentos` (BibliotecaClient legacy) — bucket 'submissions'
        //   b) tabla `planner_reference_docs` (MateriaDocsModal) — bucket 'submissions'
        const [{ data: docsLegacy }, { data: docsByMateria }] = await Promise.all([
          (supabase as any)
            .from('documentos')
            .select('storage_path, titulo')
            .eq('user_id', user.id)
            .eq('asignatura', body.subject)
            .eq('grado', body.grade),
          body.subjectId
            ? (supabase as any)
                .from('planner_reference_docs')
                .select('storage_path, titulo, file_type, file_name')
                .eq('user_id', user.id)
                .eq('planner_subject_id', body.subjectId)
            : Promise.resolve({ data: [] as any[] }),
        ])

        refs = [
          ...((docsLegacy || []) as any[]).map((d: any) => ({
            storage_path: d.storage_path,
            bucket: 'submissions',
            titulo: d.titulo || 'Documento adjunto',
          })),
          ...((docsByMateria || []) as any[])
            .filter((d: any) => {
              const ext = (d.file_name?.split('.').pop() || '').toLowerCase()
              return d.file_type?.includes('pdf') || d.file_type?.includes('officedocument') || ['pdf', 'doc', 'docx'].includes(ext)
            })
            .map((d: any) => ({
              storage_path: d.storage_path,
              bucket: 'submissions',
              titulo: d.titulo,
            })),
        ]
      }

      ragStats.found = refs.length
      if (refs.length > 0) {
        const parsedDocs: Array<{ titulo: string; text: string }> = []

        for (const r of refs) {
          const label = (r as any).titulo || r.storage_path.split('/').pop() || 'doc'
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from(r.bucket)
              .download(r.storage_path)

            if (!fileData || downloadError) {
              ragStats.skipped++
              ragStats.reasons.push(`${label}: no se pudo descargar (bucket=${r.bucket})`)
              continue
            }

            const arrayBuffer = await fileData.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const ext = (r.storage_path.split('.').pop() || '').toLowerCase()
            let text = ''

            if (ext === 'pdf') {
              // Importar pdf-parse SOLO aquí (evita crash DOMMatrix en Vercel para DOCX)
              try {
                const pdfMod = await import('pdf-parse')
                const pdfParse = (pdfMod as any).default || pdfMod
                const parsed = await pdfParse(buffer)
                text = parsed?.text || ''
              } catch (e1: any) {
                console.warn('[RAG] pdf-parse fallo:', label, e1?.message)
              }
            } else if (['doc', 'docx'].includes(ext)) {
              console.log('[RAG] Procesando DOCX:', label, `(${buffer.length} bytes)`)
              // Capa 1: mammoth
              try {
                const mammothMod = await import('mammoth')
                const mammoth = mammothMod.default || mammothMod
                const res = await mammoth.extractRawText({ buffer })
                text = res.value || ''
                console.log('[RAG] mammoth resultado:', label, `(${text.length} chars)`)
              } catch (e1: any) {
                console.warn('[RAG] mammoth falló para', label, e1?.message)
              }
              // Capa 2 (fallback): XML directo para tablas complejas
              if (!text || !text.trim()) {
                console.log('[RAG] mammoth devolvió vacío, intentando extractDocxRaw para', label)
                try {
                  text = await extractDocxRaw(buffer)
                  console.log('[RAG] extractDocxRaw resultado:', label, `(${text.length} chars)`)
                } catch (e2: any) {
                  console.error('[RAG] extractDocxRaw también falló:', label, e2?.message)
                }
              }
            } else {
              ragStats.skipped++
              ragStats.reasons.push(`${label}: extension no soportada (.${ext})`)
              continue
            }

            if (!text || !text.trim()) {
              ragStats.skipped++
              ragStats.reasons.push(`${label}: archivo vacio o sin texto extraible`)
              continue
            }

            parsedDocs.push({
              titulo: (r as any).titulo || 'Documento adjunto',
              text: text.slice(0, 150000),
            })
            ragStats.parsed++
          } catch (docErr: any) {
            ragStats.skipped++
            ragStats.reasons.push(`${label}: error al parsear (${docErr?.message?.slice(0, 120) || 'desconocido'})`)
            console.error('[RAG per-doc error]', label, docErr)
          }
        }

        // Clasificar: ¿cada doc es "referencia" o "planificacion" ya elaborada?
        const classifications = await classifyDocuments(parsedDocs)
        detectedPlanification = classifications.some(c => c.kind === 'planificacion')

        // Construir el contextoExtra etiquetando cada doc según su tipo
        parsedDocs.forEach((d: { titulo: string; text: string }, i: number) => {
          const cls = classifications[i]?.kind || 'referencia'
          const badge = cls === 'planificacion'
            ? '[TIPO: PLANIFICACION YA ELABORADA — ADAPTAR AL FORMATO, no re-inventar]'
            : '[TIPO: MATERIAL DE REFERENCIA — usar como fuente tematica]'
          contextoExtra += `\n${badge}\nDocumento: ${d.titulo}:\n${d.text}\n`
        })
      }
    } catch (err) {
      console.error('[RAG Biblioteca Error]', err)
    }

    // ── Inyección del Currículo Priorizado MinEduc ──
    try {
      const curriculoBlock = await fetchCurriculoBlock(supabase as any, {
        grado: body.grade,
        asignatura: body.subject,
        tema: body.topic,
      })
      if (curriculoBlock) {
        // Ponemos el currículo DESPUÉS de los documentos del docente para que estos tengan prioridad de lectura
        contextoExtra = `${contextoExtra}\n\n${curriculoBlock}`
      }
    } catch (err) {
      console.error('[Curriculo Lookup Error]', err)
    }

    // Call Claude with system prompt + user prompt (regular)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(body, contextoExtra, detectedPlanification) }],
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''

    // Auto-generate title
    const trimLabel = `T${body.trimestre || 1}-P${body.parcial || 1}`
    const semLabel = body.semana ? `-S${body.semana}` : ''
    const title = `${body.subject} — ${body.topic || 'Planificacion'} (${trimLabel}${semLabel})`.slice(0, 100)

    // Save regular plan
    const { data: saved, error } = await (supabase as any)
      .from('planificaciones')
      .insert({
        user_id:       user.id,
        title,
        type:          body.type === 'parcial' ? 'clase' : body.type,
        subject:       body.subject,
        grade:         body.grade,
        topic:         body.topic,
        duration:      body.duration,
        methodologies: body.methodology ? [body.methodology] : (body.methodologies || []),
        content,
        tipo_documento: 'regular',
        academic_year_id: ycx.currentYearId,
        metadata: {
          trimestre: body.trimestre,
          parcial:   body.parcial,
          semana:    body.semana,
          eje:       body.eje,
          cuadernillo: body.cuadernillo,
          periodMinutes: body.periodMinutes,
          weeklyHours: body.weeklyHours,
          methodology: body.methodology || 'ERCA',
          generatedAt: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (error) throw error

    // ── Generar variantes NEE (opcional) ──
    const variants: any[] = []
    const neeSinDiscCodes: string[] = Array.isArray(body.nee_sin_disc_codes) ? body.nee_sin_disc_codes : []
    const neeConDiscCode:  string   = typeof body.nee_con_disc_code === 'string' ? body.nee_con_disc_code : ''

    // Validar que los códigos existen en el catálogo
    const validSinDisc = neeSinDiscCodes.filter(c => {
      const n = getNeeType(c)
      return n && n.category === 'sin_discapacidad'
    })
    const validConDisc = (() => {
      const n = getNeeType(neeConDiscCode)
      return n && n.category === 'con_discapacidad' ? neeConDiscCode : ''
    })()

    // Función auxiliar para generar una variante
    const userId = user.id
    const generateVariant = async (kind: 'nee_sin_disc' | 'diac', neeCodes: string[], extraFields: Record<string, any> = {}) => {
      const prompt = buildNeeAdaptationPrompt({
        regularContent: content,
        kind,
        neeCodes,
        subject: body.subject,
        grade: body.grade,
        topic: body.topic,
        duration: body.duration,
        studentName: extraFields.estudiante_nombre,
        gradoReal:   extraFields.grado_curricular_real,
      })
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      })
      const variantContent = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const variantLabel = kind === 'diac' ? 'DIAC' : 'NEE'
      const variantTitle = `${title.slice(0, 80)} — ${variantLabel}`.slice(0, 100)

      const { data: savedVariant, error: vErr } = await (supabase as any)
        .from('planificaciones')
        .insert({
          user_id:       userId,
          title:         variantTitle,
          type:          saved.type,
          subject:       body.subject,
          grade:         body.grade,
          topic:         body.topic,
          duration:      body.duration,
          methodologies: body.methodology ? [body.methodology] : (body.methodologies || []),
          content:       variantContent,
          tipo_documento: kind,
          parent_planificacion_id: saved.id,
          nee_tipos: neeCodes,
          academic_year_id: ycx.currentYearId,
          ...extraFields,
          metadata: {
            ...saved.metadata,
            variantOf: saved.id,
            neeKind: kind,
            neeCodes,
          },
        })
        .select()
        .single()

      if (vErr) {
        console.error('[NEE variant insert error]', vErr)
        return null
      }
      return savedVariant
    }

    if (validSinDisc.length > 0) {
      try {
        const v = await generateVariant('nee_sin_disc', validSinDisc)
        if (v) variants.push(v)
      } catch (e) {
        console.error('[NEE sin discapacidad error]', e)
      }
    }

    if (validConDisc) {
      try {
        const v = await generateVariant('diac', [validConDisc], {
          estudiante_nombre:     body.diac_student_name || null,
          grado_curricular_real: body.diac_grado_real   || null,
        })
        if (v) variants.push(v)
      } catch (e) {
        console.error('[DIAC error]', e)
      }
    }

    return NextResponse.json({
      planificacion: saved,
      variants,
      detectedPlanification,
      ragStats,
    })
  } catch (err: any) {
    console.error('[POST /api/planificaciones]', err)
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}
