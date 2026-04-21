// src/app/api/planificaciones/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getMethodology } from '@/lib/pedagogy/methodologies'
import { buildNeePromptBlock, getNeeType } from '@/lib/pedagogy/nee'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── System prompt: MINEDUC Specialist ────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un Especialista en Curriculo y Gestion Pedagogica con 20 anios de experiencia en el sistema educativo ecuatoriano. Tu mision es generar planificaciones diarias operativas que cumplan estrictamente con el formato oficial del Ministerio de Educacion (MINEDUC), basandote en el PUD y los Cuadernillos de Trabajo.

ESTRUCTURA DE CALENDARIO que manejas:
- 3 Trimestres por anio lectivo
- 2 Unidades (Parciales) por trimestre
- 6 Semanas por unidad/parcial
- Semana 6: Evaluacion de Aporte (parcial)
- Semanas finales de T1 y T2: Examenes Trimestrales

REGLAS DE ORO:
1. TRABAJO EN AULA: Las actividades deben ser disenadas para completarse al 100% en el salon usando el tiempo calculado.
2. PRIORIDAD CUADERNILLO: La fase de "Aplicacion" debe basarse obligatoriamente en los ejercicios del Cuadernillo de Trabajo cuando se proporcione referencia.
3. ADAPTACIONES (NEE): Al final de cada tabla, anade siempre una seccion breve para adaptaciones curriculares.
4. Usa EXCLUSIVAMENTE tablas de Markdown limpias y profesionales.
5. Los tiempos de cada fase de la estrategia metodologica elegida deben sumar EXACTAMENTE la duracion total de la clase.`

// ── Build prompt for each type ───────────────────────────────────────────────
function buildPrompt(data: any, contextoExtra: string = ''): string {
  const {
    type, subject, grade, topic, duration, extra,
    trimestre, parcial, semana, eje, cuadernillo,
    periodMinutes, weeklyHours, teacherName, institutionName,
    methodology: methodologyCode,
  } = data

  const ejeTransversal = eje || 'Justicia'
  const methodology = getMethodology(methodologyCode)
  const cuadernilloRef = cuadernillo ? `\nREFERENCIA CUADERNILLO DE TRABAJO: ${cuadernillo}. OBLIGATORIO: usa estos ejercicios en la fase de Aplicacion.` : ''
  const extraNotes = extra ? `\nNOTAS DEL DOCENTE: ${extra}` : ''
  const ragContext = contextoExtra ? `\nCONTEXTO BIBLIOGRAFICO (biblioteca del docente):\n---\n${contextoExtra}\n---\nBasa el contenido en este material cuando sea relevante.` : ''

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
- Eje Transversal: ${ejeTransversal}
- Estrategia metodologica elegida por el docente: ${methodology.name} (${methodology.description})
${cuadernilloRef}${extraNotes}${ragContext}`

  if (type === 'clase') {
    const isAporte = semana === 6
    return `Genera una PLANIFICACION MICROCURRICULAR DIARIA con el siguiente formato ESTRICTO MINEDUC:
${commonHeader}
- Tema: ${topic}
${isAporte ? '- NOTA: Es Semana 6 (APORTE). La evaluacion debe ser tipo "Prueba de base estructurada" con instrumento "Cuestionario" como evaluacion sumativa del parcial.' : ''}

FORMATO DE SALIDA (tabla Markdown estricta):

### 1. ENCABEZADO
Tabla con: Institucion, Asignatura, Curso, Docente, Fecha, No. Estudiantes (22), Tiempo, Trimestre, Parcial, Semana.
- Objetivo de Aprendizaje (extraido del PUD)
- Eje Transversal: ${ejeTransversal}

### 2. TABLA PRINCIPAL DE LA CLASE
Genera UNA SOLA fila con estas columnas EXACTAS (no generes tablas separadas para Recursos ni Evaluacion, todo va aqui):

| DESTREZA CON CRITERIO DE DESEMPENO (DCD) | INDICADOR DE EVALUACION | ${methodology.columnHeader} | RECURSOS | EVALUACION |
|---|---|---|---|---|

REGLAS PARA CADA COLUMNA:

**DCD**: codigo oficial (ej. LL.5.3.1.) + descripcion completa. Texto breve, sin listas.

**INDICADOR**: codigo oficial (ej. I.LL.5.4.1.) + descripcion. Texto breve.

**${methodology.columnHeader}**: ${methodology.phases.length} fases con tiempos EXACTOS que sumen ${duration}. Dentro de la misma celda usa la etiqueta <br/> para saltar de linea entre fases (NO uses saltos reales, las tablas markdown no los soportan).

${methodology.promptBlock}

Formato sugerido de la celda (ejemplo con las fases de esta metodologia):
${methodology.phases.map(p => `**${p} (X min):** (actividad concreta)`).join('<br/>')}${cuadernillo ? ' — la ultima fase debe basarse en el Cuadernillo.' : ''}

**RECURSOS**: lista compacta en la misma celda, separada por <br/>. Debe incluir DOS bloques:

1) Recursos del aula (materiales fisicos): Cuadernillo pag. X, pizarra, marcadores, proyector, etc.

2) **Recursos digitales de apoyo (OBLIGATORIO minimo 3)**: enlaces reales y verificables relacionados al tema de la clase. Usa formato markdown de link [texto](url). Prioriza en este orden:
   - 1 video educativo de YouTube sobre el tema (canales como Educatina, Khan Academy en espanol, Smile and Learn, Happy Learning, Unicoos, Math2Me, etc.)
   - 1 articulo/lectura de fuente confiable (Ministerio de Educacion Ecuador https://educacion.gob.ec, BBC Mundo, National Geographic, Wikipedia en espanol, RAE, etc.)
   - 1 recurso interactivo o de investigacion (simulaciones PhET https://phet.colorado.edu, Educaplay, Liveworksheets, Genially publicos, etc.)

NO inventes URLs especificas con IDs falsos (nada de "watch?v=xyz123" inventado). Usa URLs de busqueda o paginas raiz verificables, por ejemplo:
- Busqueda en YouTube: https://www.youtube.com/results?search_query=TEMA+AQUI
- Canal YouTube real: https://www.youtube.com/@KhanAcademyEspanol
- Wikipedia articulo: https://es.wikipedia.org/wiki/TEMA
- PhET: https://phet.colorado.edu/es/simulations/filter?subjects=TEMA
- Ministerio Educacion EC: https://educacion.gob.ec/curriculo-nacional/
- Recursos MinEduc: https://recursos2.educacion.gob.ec/

Ejemplo del bloque digital:
[Video: Textos literarios y no literarios (YouTube)](https://www.youtube.com/results?search_query=textos+literarios+y+no+literarios+10mo+EGB)<br/>[Lectura: Tipos de texto - Wikipedia](https://es.wikipedia.org/wiki/Texto)<br/>[Simulacion: Analisis textual interactivo](https://phet.colorado.edu/es/)

**EVALUACION**: en la misma celda, separado por <br/>:
**Tecnica:** (Observacion / Prueba escrita / etc.)<br/>**Instrumento:** (Lista de cotejo / Cuestionario / Rubrica)<br/>**Criterios:** 2-3 criterios clave separados por ";"
${isAporte ? '- OBLIGATORIO semana 6: Tecnica = Prueba de base estructurada, Instrumento = Cuestionario' : ''}
NO generes una tabla aparte para Evaluacion.

MANTEN cada celda concisa para que la fila entera quepa sin partirse entre paginas. Evita parrafos largos.

### 3. ADAPTACIONES CURRICULARES (NEE)
| **TIPO DE NEE** | **ADAPTACION** |
|---|---|
| Dificultades de aprendizaje | (adaptaciones concretas) |
| Altas capacidades | (actividades de extension) |
| Principios DUA | (multiples formas de representacion, expresion, motivacion) |

### 4. OBSERVACIONES Y FIRMAS
| **DOCENTE** | **REVISADO POR** | **APROBADO POR** |
|---|---|---|
| ${data.teacherName || 'Docente'} | | |
| Firma: _________ | Firma: _________ | Firma: _________ |

IMPORTANTE: NO repitas la informacion de Recursos o Evaluacion fuera de la tabla principal. La tabla principal es UNICA y contiene toda la info pedagogica.`.trim()
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
      .from('profiles').select('plan').eq('id', user.id).single() as { data: { plan: string } | null }

    const isPlannerSolo = profile?.plan === 'planner_solo'

    if (profile?.plan === 'free') {
      const { count } = await (supabase as any)
        .from('planificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

      if ((count ?? 0) >= 10) {
        return NextResponse.json(
          { error: 'Limite del plan Starter alcanzado (10/mes). Actualiza a Pro para planificaciones ilimitadas.' },
          { status: 403 }
        )
      }
    }

    const body = await request.json()

    // ── RAG: extract PDFs from teacher library ──
    let contextoExtra = ''
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
            return d.file_type?.includes('pdf') || ext === 'pdf'
          })
          .map((d: any) => ({
            storage_path: d.storage_path,
            bucket: 'submissions',
            titulo: d.titulo,
          }))
      } else {
        // Docente institucional: fuente legacy
        const { data: docs } = await (supabase as any)
          .from('documentos')
          .select('storage_path')
          .eq('user_id', user.id)
          .eq('asignatura', body.subject)
          .eq('grado', body.grade)

        refs = (docs || []).map((d: any) => ({
          storage_path: d.storage_path,
          bucket: 'biblioteca',
        }))
      }

      if (refs.length > 0) {
        const pdfMod = await import('pdf-parse')
        const pdfParse = (pdfMod as any).default || pdfMod

        for (const r of refs) {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(r.bucket)
            .download(r.storage_path)

          if (fileData && !downloadError) {
            const buffer = Buffer.from(await fileData.arrayBuffer())
            const parsed = await pdfParse(buffer)
            const header = r.titulo ? `Documento: ${r.titulo}` : 'Documento adjunto'
            contextoExtra += `\n${header}:\n${parsed.text.slice(0, 150000)}\n`
          }
        }
      }
    } catch (err) {
      console.error('[RAG Biblioteca Error]', err)
    }

    // Call Claude with system prompt + user prompt (regular)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(body, contextoExtra) }],
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
        model: 'claude-sonnet-4-20250514',
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

    return NextResponse.json({ planificacion: saved, variants })
  } catch (err: any) {
    console.error('[POST /api/planificaciones]', err)
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}
