// src/app/api/planificaciones/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getMethodology } from '@/lib/pedagogy/methodologies'
import { buildNeePromptBlock, getNeeType } from '@/lib/pedagogy/nee'
import { fetchCurriculoBlock } from '@/lib/curriculo/lookup'
import { getPreviousLevel } from '@/lib/curriculo/previous-grade'
import { buildInsercionesPromptBlock, getInserciones } from '@/lib/pedagogy/inserciones'
import { buildCompetenciasPromptBlock } from '@/lib/pedagogy/competencias-clave'
import { isEFLSubject } from '@/lib/pedagogy/subject-types'
import { extractDocxRaw } from '@/lib/extract/extractDocxRaw'
import { resolveYearContext } from '@/lib/academic-year/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type RagStats = {
  found: number
  parsed: number
  skipped: number
  reasons: string[]
}

type RagCacheEntry = {
  docsContext: string
  detectedPlanification: boolean
  ragStats: RagStats
  expiresAt: number
}

const RAG_CACHE_TTL_MS = 10 * 60 * 1000
const ragContextCache = new Map<string, RagCacheEntry>()

function buildRagCacheKey(userId: string, body: any, isPlannerSolo: boolean) {
  return [
    userId,
    isPlannerSolo ? 'solo' : 'institutional',
    body.subjectId || 'no-subject-id',
    body.subject || 'no-subject',
    body.grade || 'no-grade',
  ].join('::')
}

function cloneRagStats(stats: RagStats): RagStats {
  return {
    found: stats.found,
    parsed: stats.parsed,
    skipped: stats.skipped,
    reasons: [...stats.reasons],
  }
}
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
    inserciones,
    isEFL: isEFLFlag, cefrLevel, unitNumber, unitTotal,
    periodMinutes, weeklyHours, totalWeeklyMinutes,
    teacherName, institutionName,
    methodology: methodologyCode,
  } = data
  const numSesiones = Math.max(1, Number(weeklyHours) || 1)
  const minPorSesion = Number(periodMinutes) || 45
  const totalMin = Number(totalWeeklyMinutes) || (numSesiones * minPorSesion)
  // Detectar EFL desde flag del cliente o desde el nombre de la materia (fallback)
  const isEFL = !!isEFLFlag || isEFLSubject(subject)
  const isTrimester = type === 'trimestre'

  // axis (Eje Transversal legacy) ya no se usa — reemplazado por inserciones
  // curriculares MinEduc 2025-2026 inyectadas vía buildInsercionesPromptBlock.
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

  // Para Semana de Adaptación NO inyectamos Trimestre/Parcial/Semana — esta
  // semana está FUERA del calendario regular de parciales. La IA debe omitir
  // esos campos del documento generado y reemplazarlos por contexto de
  // diagnóstico del curso anterior.
  const isAdaptacionCH = type === 'adaptacion' || type === 'diagnostica'
  const tpsLine = isAdaptacionCH
    ? `- Periodo: SEMANA DE ADAPTACION (primera semana del ano lectivo, antes de cualquier parcial). NO menciones trimestre, parcial ni semana en los datos informativos del documento.`
    : isTrimester
      ? `- Trimestre ${trimestre}. NO menciones parcial ni semana porque este documento cubre el trimestre completo.`
      : `- Trimestre ${trimestre}, Parcial ${parcial}${semana ? `, Semana ${semana}` : ''}`

  // Inserciones curriculares MinEduc 2025-2026 (multi-select del docente)
  const insercionesBlock = buildInsercionesPromptBlock(inserciones)
  // Instrucciones para que la IA marque las competencias clave en cada DCD
  const competenciasBlock = buildCompetenciasPromptBlock()

  const commonHeader = `
DATOS DEL CONTEXTO:
- Institucion: ${institutionName || 'Institucion Educativa'}
- Docente: ${teacherName || 'Docente'}
- Asignatura: ${subject}
- Curso/Grado: ${grade}
${tpsLine}
- Duracion hora pedagogica: ${periodMinutes} minutos
- Carga horaria semanal: ${weeklyHours} horas
- Duracion de esta clase: ${duration}
- Estrategia metodologica (Ciclo): ${methodology.name} (${methodology.description})
${cuadernilloRef}${extraNotes}${insercionesBlock}${competenciasBlock}${ragContext}${planDetectedNote}`


  if (type === 'trimestre') {
    return `Genera una PLANIFICACION MICROCURRICULAR DISCIPLINAR O INTERDISCIPLINAR para un trimestre completo, siguiendo el formato oficial 2026 del documento de referencia.
${commonHeader}
- Alcance: trimestre completo
- Tema o eje articulador del trimestre: ${topic || 'Tomar del PUD y de los materiales subidos'}

REGLA CENTRAL PARA DOCENTES EXTERNOS:
- Si en los documentos subidos existe un PUD, una planificacion microcurricular, un plan de unidad o un documento equivalente, ese material es la FUENTE BASE para organizar el trimestre.
- Debes tomar de ese PUD: secuencia de contenidos, objetivos, destrezas, indicadores, estrategias y temporalidad.
- Luego debes VALIDAR y AJUSTAR esa base con el bloque del CURRICULO PRIORIZADO MinEduc 2025 para completar o corregir competencias clave, inserciones curriculares e indicadores cuando corresponda.
- Si el PUD no trae explicitas las competencias o inserciones, infierelas a partir de la DCD, la actividad y el curriculo priorizado, sin inventar DCD fuera del contexto provisto.

ESTRUCTURA DE SALIDA OBLIGATORIA (usa tablas Markdown limpias):

### ENCABEZADO INSTITUCIONAL
Tabla con tres bandas principales:
1. Nombre de la institucion
2. Ano lectivo
3. Titulo centrado: PLANIFICACION MICROCURRICULAR DISCIPLINAR O INTERDISCIPLINAR

### 1. DATOS INFORMATIVOS
Crea una tabla con estos campos exactos:
| Campo | Valor | Campo | Valor | Campo | Valor |
|---|---|---|---|---|---|
| Docente | ... | Nivel/Subnivel/Grado o curso | ... | Paralelo | ... |
| Area/Asignatura/Ambitos de desarrollo y aprendizaje/Modulos BT o EBJA | ... | Tiempo de duracion | Trimestre ${trimestre} | Desde | ... | Hasta | ... |

### 2. PLANIFICACION
Debes producir estas tres tablas, en este orden:

#### 2.1 Destrezas + Indicadores
| Destrezas/Contenidos BT/ | Indicadores de evaluacion/Criterio de evaluacion BT |
|---|---|
| Lista organizada de DCDs y/o contenidos del trimestre tomados del PUD. Cada DCD debe conservar su codigo textual y llevar al final sus competencias clave entre llaves dobles, por ejemplo {{C}} o {{CM,CD}}. Usa una sola DCD principal por bloque o fila visual para que la lectura sea compacta. | Lista alineada de indicadores oficiales o criterios de evaluacion correspondientes exactamente a la DCD del lado izquierdo. Debes repetir el indicador completo en cada caso; no uses abreviaturas sueltas como "I.LL.4.7.2." sin descripcion. |

#### 2.2 Estrategias metodologicas (DUA) + Recursos
| Estrategias metodologicas (DUA) | Recursos |
|---|---|
| Organiza la secuencia metodologica del trimestre tomando como base el PUD subido. Integra aqui las inserciones curriculares seleccionadas o inferidas para el trimestre, pero aterrizadas en acciones reales de aula. Deben sentirse naturales dentro de las experiencias, no como lista decorativa. Cada insercion debe verse con su icono y etiqueta corta, por ejemplo [🌱 Sostenible], [🚩 Civica], [🤝 Socioemocional], [💰 Financiera], [🚲 Vial]. | Recursos concretos, materiales, textos, TIC, manipulativos y apoyos que se desprenden del PUD y de las actividades del trimestre. Si un recurso responde a una insercion curricular, marcalo tambien con el mismo formato visual [emoji etiqueta]. |

#### 2.3 Estrategias para la evaluacion
| Estrategias para la evaluacion |
|---|
| Describe de forma practica como se evaluara diagnostica, formativa y sumativamente a lo largo del trimestre, en coherencia con los indicadores seleccionados. |

### 3. ADAPTACIONES CURRICULARES
Incluye una tabla o bloque breve con adaptaciones curriculares pertinentes para el trimestre.

OBLIGATORIO SOBRE COMPETENCIAS E INSERCIONES:
1. TODA DCD debe llevar competencia(s) clave marcadas con el formato {{C}}, {{CM}}, {{CD}}, {{CS}}.
2. Las inserciones curriculares NO van como lista aislada al final: deben integrarse dentro de las estrategias metodologicas y, cuando tenga sentido, tambien en recursos o evaluacion.
3. Toda insercion integrada debe verse con icono visible y etiqueta corta en este formato exacto: [🌱 Sostenible], [🚩 Civica], [🤝 Socioemocional], [💰 Financiera], [🚲 Vial].
4. Si una fila o actividad no integra una insercion de manera genuina, no la fuerces; pero cuando si la integre, el icono es obligatorio.
5. En la tabla 2.1, evita bloques desbalanceados: por cada DCD o contenido principal del lado izquierdo debe existir su indicador completo del lado derecho, en el mismo nivel de detalle.
6. No dejes celdas visualmente vacias ni indicadores resumidos por referencia; si el mismo indicador aplica a dos DCDs distintas, repitelo completo para mantener la tabla pareja.
7. Si el PUD subido ya tiene una orientacion metodologica clara, respetala y solo enriquecela con curriculo priorizado.
8. No inventes periodos semanales ni parciales. Este documento resume y organiza el trimestre completo.
9. No expliques el proceso ni hables de la IA; entrega solo la planificacion final.`.trim()
  }

  if (type === 'clase') {
    const isAporte = semana === 6
    const esSemanal = numSesiones > 1

    // Hint EFL al inicio del prompt cuando aplique
    const eflHint = isEFL
      ? `\n\nMATERIA EFL — Usa códigos DCD EFL.x.x.x del bloque CURRÍCULO PRIORIZADO. ${cefrLevel ? `Nivel CEFR: ${cefrLevel}.` : ''} Estructura las actividades por las 5 destrezas comunicativas (Communication, Oral, Reading, Writing, Language through the Arts). Metodología comunicativa CLT. Usa inglés en los Can-Do statements y español en las orientaciones metodológicas.`
      : ''

    if (esSemanal) {
      // ── Modo semanal: N sesiones cubriendo el total semanal ────────────────
      return `Genera una PLANIFICACION SEMANAL MICROCURRICULAR distribuida en ${numSesiones} sesiones secuenciales:
${commonHeader}${eflHint}
- Tema central de la semana: ${topic}
- Total semanal: ${totalMin} minutos (${numSesiones} sesiones de ${minPorSesion} min cada una)
${isAporte ? '- NOTA: Es Semana 6 (APORTE). La última sesión debe contener evaluación sumativa.' : ''}

### 1. ENCABEZADO COMÚN
Tabla con: Institucion, Docente, Asignatura, Grado, Trimestre, Parcial, Semana, Total semanal (${totalMin} min en ${numSesiones} sesiones).

### 2. SECCIÓN PREVIA (común a las ${numSesiones} sesiones)
- **Objetivos de aprendizaje de la semana:** (extraer del documento o generar)
- **Criterios de evaluación:** (extraer del documento o generar)
- **Inserciones curriculares:** (Justicia, Innovación o Solidaridad)

### 3. SESIONES DE LA SEMANA — OBLIGATORIO

Genera EXACTAMENTE ${numSesiones} bloques con el ENCABEZADO LITERAL "## Sesión N: <subtema>" (donde N va de 1 a ${numSesiones}).

CADA SESIÓN debe contener:

## Sesión N: <subtema específico de esa sesión>
**Duración:** ${minPorSesion} minutos
**Subtema:** <descripción concisa del foco de esta sesión>

| Destrezas con Criterios de Desempeño | Estrategias Metodológicas | Recursos | Indicadores de evaluación | Técnicas / Instrumentos |
|---|---|---|---|---|
| ... | Fases de ${methodology.name} sumando exactamente ${minPorSesion} min | ... | ... | ... |

REGLAS DE SECUENCIA:
- Las ${numSesiones} sesiones deben tener PROGRESIÓN PEDAGÓGICA: la sesión 2 retoma la 1, la 3 profundiza, etc.
- Cada sesión es un bloque autocontenido de ${minPorSesion} min. La suma de tiempos de las fases dentro de UNA sesión = ${minPorSesion} min (no el total semanal).
- Subtemas distintos por sesión (no copies el mismo título N veces).
- Si Semana 6 (Aporte), la última sesión incluye instrumento de evaluación sumativa.

### 4. ADAPTACIONES CURRICULARES (NEE)
Sección común al final, breve.

IMPORTANTE: usa EXACTAMENTE el formato de encabezado "## Sesión N:" (con doble almohadilla y dos puntos) — el sistema lo parsea para distribuir las sesiones en el calendario semanal.`.trim()
    }

    // ── Modo sesión única (1 sola hora pedagógica) ──────────────────────────
    return `Genera una PLANIFICACION MICROCURRICULAR DIARIA con el siguiente formato:
${commonHeader}${eflHint}
- Tema: ${topic}
- Duración: ${minPorSesion} minutos (1 sesión)
${isAporte ? '- NOTA: Es Semana 6 (APORTE). La evaluación debe ser sumativa.' : ''}

### 1. ENCABEZADO
Tabla con: Institucion, Docente, Asignatura, Grado, Tiempo, Trimestre, Semana.

### 2. SECCION PREVIA
- **Objetivos de aprendizaje:** (Extraer del documento del docente o generar acorde al tema)
- **Criterios de evaluación:** (Extraer del documento o generar)
- **Inserciones curriculares:** (Justicia, Innovación o Solidaridad)

### 3. PLANIFICACIÓN
Genera la tabla principal con estas columnas:

| Destrezas con Criterios de Desempeño | Estrategias Metodológicas | Recursos | Indicadores de evaluación | Técnicas / Instrumentos |
|---|---|---|---|---|

REGLAS PARA CADA COLUMNA:
- **Destrezas**: Codigo y descripcion.
- **Estrategias**: Fases de ${methodology.name} con sus tiempos sumando ${minPorSesion} min. Usa <br/> para separar fases.
- **Recursos**: Materiales y enlaces digitales.
- **Indicadores**: Codigo y descripcion.
- **Técnicas / Instrumentos**: Ej: Observación / Lista de cotejo.

IMPORTANTE: NO repitas informacion fuera de la tabla.`.trim()
  }

  if (type === 'unidad') {
    // ── Modo EFL / Lengua Extranjera (CEFR) ────────────────────────────
    if (isEFL) {
      const unitLabel = unitNumber && unitTotal
        ? `Unit ${unitNumber} of ${unitTotal}`
        : unitNumber ? `Unit ${unitNumber}` : 'Unit (sin numerar)'
      const cefrLine = cefrLevel ? `\n- Nivel CEFR: ${cefrLevel}` : ''

      return `Genera una UNIDAD EFL COMPLETA siguiendo el currículo MinEduc EFL 2025-2026 (Marco Común Europeo de Referencia para las Lenguas).
${commonHeader}
- ${unitLabel}${cefrLine}
- Tema central / Topic: ${topic || 'A determinar según el currículo del nivel'}
- Duración estimada: 2-3 semanas (estructura granular EFL, NO 6 semanas como otras materias)

ESTRUCTURA OBLIGATORIA (formato MinEduc EFL):

### 1. DATOS INFORMATIVOS
Tabla con: Institución, Docente, Asignatura (English), Curso/Grado, Nivel CEFR (${cefrLevel || '—'}), Unit (${unitLabel}), Duración estimada (2-3 semanas), Año lectivo.

### 2. UNIT GOALS / OBJETIVOS COMUNICATIVOS
Lista de 3-4 objetivos en INGLÉS (Can-Do statements al estilo CEFR):
  - "Students can introduce themselves using simple greetings."
  - "Students can describe their family using possessive adjectives."
  Cada objetivo debe ser DEMOSTRABLE en una performance comunicativa.

### 3. ASSESSMENT CRITERIA / CRITERIOS DE EVALUACIÓN
Lista de criterios MinEduc CE.EFL.x.x.x extraídos del bloque CURRÍCULO PRIORIZADO inyectado.

### 4. CURRICULUM TABLE — POR LAS 5 DESTREZAS COMUNICATIVAS — OBLIGATORIO

Genera UNA tabla con CINCO filas (una por cada destreza MinEduc EFL) y estas columnas:

| Skill | DCD (EFL.x.x.x) | Strategies & Activities | Resources | Indicators (I.EFL.x.x.x) | Techniques / Instruments |
|---|---|---|---|---|---|
| 🌍 Communication and Cultural Awareness | EFL.x.x.x ... {{C}} | ... | ... | I.EFL.x.x.x | Observation / Checklist |
| 🗣️ Oral Communication (Listening & Speaking) | EFL.x.x.x ... {{C,CS}} | ... | ... | I.EFL.x.x.x | ... |
| 📖 Reading | EFL.x.x.x ... {{C}} | ... | ... | I.EFL.x.x.x | ... |
| ✍️ Writing | EFL.x.x.x ... {{C,CD}} | ... | ... | I.EFL.x.x.x | ... |
| 🎭 Language through the Arts | EFL.x.x.x ... {{C,CS}} | ... | ... | I.EFL.x.x.x | ... |

REGLAS:
- Las DCDs van TEXTUALMENTE del bloque CURRÍCULO PRIORIZADO inyectado (códigos EFL.x.x.x reales).
- Cada DCD debe llevar al menos UNA competencia clave entre llaves dobles {{C}}, {{CD}}, {{CS}}, etc.
- Las strategies deben usar metodología comunicativa CLT (Communicative Language Teaching) — NO traducción gramática.
- En cada celda, INTEGRA las inserciones curriculares activas (ver bloque arriba) — Ejemplo: "Listen to a podcast about recycling and discuss in pairs (🌱 Desarrollo Sostenible) (DUA: representación múltiple)".

### 5. SESSION PLAN — ${numSesiones} SESIONES SECUENCIALES

Genera EXACTAMENTE ${numSesiones} sesiones con encabezado literal "## Sesión N: <focus>". Cada sesión cubre UNA o DOS destrezas integradas.

Por ejemplo (template):
## Sesión 1: Vocabulary Building (Reading + Writing)
**Duración:** ${minPorSesion} minutos
| Phase | Activity | DCD | Resources |
| Warm-up | ... | EFL.x.x.x | ... |
| Presentation | ... | ... | ... |
| Practice | ... | ... | ... |
| Production | ... | ... | ... |
| Wrap-up | ... | ... | ... |

### 6. FORMATIVE & SUMMATIVE ASSESSMENT
Cómo se evalúa cada destreza durante y al final de la unit.

### 7. ADAPTACIONES CURRICULARES (NEE)
Sección breve.

### 8. RESOURCES / RECURSOS BIBLIOGRÁFICOS
Lista breve.

USA tablas Markdown limpias. Tono profesional pero amigable. Mezcla inglés y español según corresponda (definiciones técnicas en inglés, explicaciones metodológicas en español).`.trim()
    }

    // ── Modo estándar (no-EFL) ─────────────────────────────────────────
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

  // Semana de Adaptación / Diagnóstico
  if (type === 'adaptacion' || type === 'diagnostica') {
    const prev = getPreviousLevel(grade)
    const prevLabel = prev.label

    return `Genera una PLANIFICACIÓN DE SEMANA DE ADAPTACIÓN Y EVALUACIÓN DIAGNÓSTICA orientada a NIVELAR a los estudiantes que vienen del año anterior:
${commonHeader}

CONTEXTO CRÍTICO DE ESTA SEMANA:
- Este NO es contenido nuevo del curso ${grade}. Es la PRIMERA SEMANA del año lectivo, donde el docente NO arranca con el currículo del curso actual.
- El propósito es DIAGNOSTICAR el nivel de logro de las DCDs CLAVE del CURSO ANTERIOR (${prevLabel}) para identificar brechas y planificar nivelación.
- TODAS las destrezas, indicadores y actividades de esta planificación deben provenir del currículo de ${prevLabel}, NO del currículo de ${grade}.

ESTRUCTURA OBLIGATORIA — sigue EXACTAMENTE este orden y encabezados:

### 1. DATOS INFORMATIVOS
Tabla con: Institución, Docente, Asignatura, Curso actual (${grade}), Curso anterior diagnosticado (${prevLabel}), Año lectivo, Total semanal (${totalMin} min en ${numSesiones} sesiones de ${minPorSesion} min).

### 2. PROPÓSITO DE LA SEMANA
Párrafo breve explicando que esta semana se diagnostica el nivel de los estudiantes en las DCDs del ${prevLabel} para planificar acciones de nivelación antes de avanzar con los contenidos de ${grade}.

### 3. SESIONES DE LA SEMANA — OBLIGATORIO

Genera EXACTAMENTE ${numSesiones} bloques con el ENCABEZADO LITERAL "## Sesión N: <subtema diagnóstico>" (donde N va de 1 a ${numSesiones}). Cada sesión cubre una destreza/tema clave del ${prevLabel}.

CADA SESIÓN debe contener:

## Sesión N: <subtema diagnóstico breve>
**Duración:** ${minPorSesion} minutos
**DCD diagnosticada (${prevLabel}):** <código y descripción literal del currículo del ${prevLabel}>

| Actividad diagnóstica | Indicadores esperados (${prevLabel}) | Recursos | Evidencia / Instrumento |
|---|---|---|---|
| ... | ... | ... | ej: rúbrica diagnóstica, lista de cotejo |

REGLAS:
- Las DCDs e indicadores van TEXTUALMENTE del currículo de ${prevLabel} que recibirás más arriba en el bloque "=== CURRÍCULO PRIORIZADO MinEduc 2025 ===". NO uses códigos del ${grade}.
- Usa EXACTAMENTE el formato "## Sesión N: <tema>" (con doble almohadilla, la palabra Sesión, el número y dos puntos) — el sistema lo parsea para distribuir las sesiones en el calendario semanal.
- Los subtemas distintos por sesión (no copies el mismo título N veces).
- Actividades cortas y diagnósticas (no introducir contenido nuevo).

### 4. INSTRUMENTO DE EVALUACIÓN DIAGNÓSTICA
Banco de mínimo 10 ítems imprimible que cubra las DCDs revisadas. Mezcla de tipos:
- Opción múltiple (4 ítems)
- Respuesta corta / completar (3 ítems)
- Relacionar (1 ítem)
- Aplicación / problema (2 ítems)

Cada ítem indica la DCD del ${prevLabel} que evalúa.

### 5. PLAN DE ACCIÓN POST-DIAGNÓSTICO
Pequeña tabla con criterios de decisión:
| Si el estudiante logra | Acción del docente |
|---|---|
| ≥ 70% del diagnóstico | Avanzar al currículo de ${grade} |
| 40-69% | Reforzar las DCDs específicas no logradas durante 1-2 semanas |
| < 40% | Plan de nivelación intensiva con apoyo individualizado |

### 6. ADAPTACIONES CURRICULARES (NEE)
Sección breve sugiriendo ajustes generales para estudiantes con NEE durante la semana de diagnóstico.

Usa tono alentador, profesional, orientado a la nivelación.`.trim()
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
      .from('profiles')
      .select('plan, planner_suspended, planner_ia_enabled, institution_id')
      .eq('id', user.id)
      .single() as { data: { plan: string; planner_suspended?: boolean; planner_ia_enabled?: boolean; institution_id?: string | null } | null }

    const isPlannerSolo = profile?.plan === 'planner_solo'

    // Bloqueo duro por suscripcion vencida o suspendida manualmente
    if (profile?.planner_suspended === true) {
      return NextResponse.json(
        { error: 'Tu suscripción al planificador está suspendida. Comunícate con el administrador para renovar el pago mensual.' },
        { status: 403 }
      )
    }

    // ── Bloqueo por servicio IA NO contratado (institucionales) ──────────
    // Solo aplica a docentes institucionales. Los planner_solo (externos)
    // siempre tienen acceso si pagaron suscripción.
    if (!isPlannerSolo && profile?.institution_id) {
      // Cargar el flag de la institución
      const { data: inst } = await (supabase as any)
        .from('institutions')
        .select('planner_ia_enabled')
        .eq('id', profile.institution_id)
        .maybeSingle()
      const instEnabled = !!(inst as any)?.planner_ia_enabled
      const userEnabled = !!profile.planner_ia_enabled
      if (!instEnabled || !userEnabled) {
        return NextResponse.json(
          {
            error: !instEnabled
              ? 'Tu institución no tiene contratado el Planificador IA. Pide al administrador que lo active.'
              : 'No estás habilitado para usar el Planificador IA. Pide al administrador que te habilite.',
            code: 'PLANNER_IA_NOT_ENABLED',
          },
          { status: 403 }
        )
      }
    }

    // Resolver año lectivo visible; bloquear si esta en modo historico
    const ycx = await resolveYearContext(user.id)
    if (ycx.hasInstitution && ycx.isReadOnly) {
      return NextResponse.json(
        { error: 'No puedes crear planificaciones en un año lectivo histórico. Vuelve al año actual.' },
        { status: 403 }
      )
    }

    // ── Trial gratuito: 6 planificaciones lifetime para todos ─────────────
    // Ilimitado solo si tiene suscripción activa al planificador.
    const FREE_TRIAL_LIMIT = 6
    const { data: activeSub } = await (supabase as any)
      .from('planner_subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle() as { data: { status: string; current_period_end: string } | null }

    const hasActiveSubscription =
      activeSub?.status === 'active' &&
      activeSub.current_period_end &&
      new Date(activeSub.current_period_end) > new Date()

    if (!hasActiveSubscription) {
      const { count } = await (supabase as any)
        .from('planificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if ((count ?? 0) >= FREE_TRIAL_LIMIT) {
        return NextResponse.json(
          {
            error:
              `Llegaste al límite gratuito de ${FREE_TRIAL_LIMIT} planificaciones (${count}/${FREE_TRIAL_LIMIT}). ` +
              `Para seguir usando el planificador necesitas activar tu suscripción mensual ($20/mes). ` +
              `Comunícate con el administrador para registrar el pago.`,
            code: 'TRIAL_EXHAUSTED',
            count,
            limit: FREE_TRIAL_LIMIT,
          },
          { status: 402 }   // 402 Payment Required
        )
      }
    }

    const body = await request.json()

    // ── Persistir horas/min/días editados (B con memoria) ──
    if (body.persistHoursConfig && body.subjectId) {
      const wh = Number(body.weeklyHours)
      const pm = Number(body.periodMinutes)
      const validWh = Number.isFinite(wh) && wh >= 1 && wh <= 20 ? wh : null
      const validPm = Number.isFinite(pm) && [40, 45, 50, 60].includes(pm) ? pm : null
      const rawDays = Array.isArray(body.daysOfWeek) ? body.daysOfWeek : null
      const validDays = rawDays
        ? Array.from(new Set(rawDays.map((n: any) => Number(n)).filter((n: number) => n >= 1 && n <= 7))).sort()
        : null
      const patch: any = {}
      if (validWh !== null) patch.weekly_hours = validWh
      if (body.isPlannerSoloSubject && validPm !== null) patch.period_minutes = validPm
      if (validDays && validDays.length > 0) patch.days_of_week = validDays
      if (Object.keys(patch).length > 0) {
        const table = body.isPlannerSoloSubject ? 'planner_subjects' : 'subjects'
        await (supabase as any)
          .from(table)
          .update(patch)
          .eq('id', body.subjectId)
      }
    }

    // RAG: extract PDFs from teacher library
    let contextoExtra = ''
    let detectedPlanification = false
    const ragStats: RagStats = { found: 0, parsed: 0, skipped: 0, reasons: [] }
    const ragCacheKey = buildRagCacheKey(user.id, body, isPlannerSolo)
    const cachedRag = ragContextCache.get(ragCacheKey)

    if (cachedRag && cachedRag.expiresAt > Date.now()) {
      contextoExtra = cachedRag.docsContext
      detectedPlanification = cachedRag.detectedPlanification
      Object.assign(ragStats, cloneRagStats(cachedRag.ragStats))
    } else {
      ragContextCache.delete(ragCacheKey)
      try {
        let refs: Array<{ storage_path: string; bucket: string; titulo?: string }> = []

        if (isPlannerSolo && body.subjectId) {
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
          const parsedResults = await Promise.all(refs.map(async (r) => {
            const label = (r as any).titulo || r.storage_path.split('/').pop() || 'doc'
            try {
              const { data: fileData, error: downloadError } = await supabase.storage
                .from(r.bucket)
                .download(r.storage_path)

              if (!fileData || downloadError) {
                return { ok: false as const, reason: `${label}: no se pudo descargar (bucket=${r.bucket})` }
              }

              const arrayBuffer = await fileData.arrayBuffer()
              const buffer = Buffer.from(arrayBuffer)
              const ext = (r.storage_path.split('.').pop() || '').toLowerCase()
              let text = ''

              if (ext === 'pdf') {
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
                try {
                  const mammothMod = await import('mammoth')
                  const mammoth = mammothMod.default || mammothMod
                  const res = await mammoth.extractRawText({ buffer })
                  text = res.value || ''
                  console.log('[RAG] mammoth resultado:', label, `(${text.length} chars)`)
                } catch (e1: any) {
                  console.warn('[RAG] mammoth fallo para', label, e1?.message)
                }
                if (!text || !text.trim()) {
                  console.log('[RAG] mammoth devolvio vacio, intentando extractDocxRaw para', label)
                  try {
                    text = await extractDocxRaw(buffer)
                    console.log('[RAG] extractDocxRaw resultado:', label, `(${text.length} chars)`)
                  } catch (e2: any) {
                    console.error('[RAG] extractDocxRaw tambien fallo:', label, e2?.message)
                  }
                }
              } else {
                return { ok: false as const, reason: `${label}: extension no soportada (.${ext})` }
              }

              if (!text || !text.trim()) {
                return { ok: false as const, reason: `${label}: archivo vacio o sin texto extraible` }
              }

              return {
                ok: true as const,
                doc: {
                  titulo: (r as any).titulo || 'Documento adjunto',
                  text: text.slice(0, 150000),
                },
              }
            } catch (docErr: any) {
              console.error('[RAG per-doc error]', label, docErr)
              return {
                ok: false as const,
                reason: `${label}: error al parsear (${docErr?.message?.slice(0, 120) || 'desconocido'})`,
              }
            }
          }))

          const parsedDocs: Array<{ titulo: string; text: string }> = []
          for (const result of parsedResults) {
            if (result.ok) {
              parsedDocs.push(result.doc)
              ragStats.parsed++
            } else {
              ragStats.skipped++
              ragStats.reasons.push(result.reason)
            }
          }

          if (parsedDocs.length > 0) {
            const classifications = await classifyDocuments(parsedDocs)
            detectedPlanification = classifications.some(c => c.kind === 'planificacion')

            parsedDocs.forEach((d: { titulo: string; text: string }, i: number) => {
              const cls = classifications[i]?.kind || 'referencia'
              const badge = cls === 'planificacion'
                ? '[TIPO: PLANIFICACION YA ELABORADA - ADAPTAR AL FORMATO, no re-inventar]'
                : '[TIPO: MATERIAL DE REFERENCIA - usar como fuente tematica]'
              contextoExtra += `\n${badge}\nDocumento: ${d.titulo}:\n${d.text}\n`
            })
          }
        }

        ragContextCache.set(ragCacheKey, {
          docsContext: contextoExtra,
          detectedPlanification,
          ragStats: cloneRagStats(ragStats),
          expiresAt: Date.now() + RAG_CACHE_TTL_MS,
        })
      } catch (err) {
        console.error('[RAG Biblioteca Error]', err)
      }
    }

    // ── Inyección del Currículo Priorizado MinEduc ──
    // Para Semana de Adaptación, queremos el currículo del CURSO ANTERIOR
    // (no el actual), porque el diagnóstico nivela contenidos previos.
    try {
      const isAdaptacion = body.type === 'adaptacion' || body.type === 'diagnostica'
      const curriculoGrado = isAdaptacion
        ? getPreviousLevel(body.grade).label
        : body.grade
      const curriculoBlock = await fetchCurriculoBlock(supabase as any, {
        grado: curriculoGrado,
        asignatura: body.subject,
        tema: isAdaptacion ? null : body.topic,  // en adaptación traemos TODO el subnivel anterior
      })
      if (curriculoBlock) {
        // Ponemos el currículo DESPUÉS de los documentos del docente para que estos tengan prioridad de lectura
        contextoExtra = `${contextoExtra}\n\n${curriculoBlock}`
      }
    } catch (err) {
      console.error('[Curriculo Lookup Error]', err)
    }

    // Calcular max_tokens según número de sesiones (cada sesión con tabla ≈ 1500 tok).
    // Base 4096 para encabezado + secciones previa + NEE; 1800 por sesión adicional.
    const numSesionesEsperadas = Math.max(1, Number(body.weeklyHours) || 1)
    const isAdaptacionMaxTok = body.type === 'adaptacion' || body.type === 'diagnostica'
    const dynamicMaxTokens =
      body.type === 'trimestre'
        ? 10000
        : (body.type === 'clase' || isAdaptacionMaxTok) && numSesionesEsperadas > 1
          ? Math.min(16000, 4096 + (numSesionesEsperadas * 1800))
          : 6000

    // Call Claude with system prompt + user prompt (regular)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: dynamicMaxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(body, contextoExtra, detectedPlanification) }],
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''
    const wasTruncated = message.stop_reason === 'max_tokens'

    const sesiones: Array<{ numero: number; tema: string; duracion_min: number }> = []
    // Regex robusta: admite Sesión/Sesion, con/sin tilde, opcionalmente el nro pegado, opcionalmente : o - o espacio.
    const sesionRegex = /^##\s*Sesi[oó]n\s*(\d+)\s*[:\-–]?\s*(.*)$/gim
    let m: RegExpExecArray | null
    while ((m = sesionRegex.exec(content)) !== null) {
      const numero = parseInt(m[1], 10)
      const tema = (m[2] || '').trim().slice(0, 200)
      if (numero > 0 && tema && !sesiones.some(s => s.numero === numero)) {
        sesiones.push({
          numero,
          tema,
          duracion_min: Number(body.periodMinutes) || 45,
        })
      }
    }
    sesiones.sort((a, b) => a.numero - b.numero)

    // Auto-generate title
    const isAdaptacion = body.type === 'adaptacion' || body.type === 'diagnostica'
    const isEFLBody = !!body.isEFL || isEFLSubject(body.subject)
    const trimLabel = `T${body.trimestre || 1}-P${body.parcial || 1}`
    const semLabel = body.semana ? `-S${body.semana}` : ''

    // Título dedicado para EFL Unidad / Clase
    let title: string
    if (body.type === 'trimestre') {
      title = `Planificacion Trimestral T${body.trimestre || 1} - ${body.subject} - ${body.grade}`.slice(0, 100)
    } else if (isAdaptacion) {
      title = `Semana de Adaptación — ${body.subject} · ${body.grade}`.slice(0, 100)
    } else if (isEFLBody && body.type === 'unidad') {
      const unitTag = body.unitNumber && body.unitTotal
        ? `Unit ${body.unitNumber} of ${body.unitTotal}`
        : body.unitNumber ? `Unit ${body.unitNumber}` : 'Unit'
      const cefr = body.cefrLevel ? ` [${body.cefrLevel}]` : ''
      title = `EFL ${unitTag}${cefr}: ${body.topic || body.subject} · ${body.grade}`.slice(0, 100)
    } else if (isEFLBody && body.cefrLevel) {
      title = `${body.subject} [${body.cefrLevel}] — ${body.topic || 'Lesson'} (${trimLabel}${semLabel})`.slice(0, 100)
    } else {
      title = `${body.subject} — ${body.topic || 'Planificacion'} (${trimLabel}${semLabel})`.slice(0, 100)
    }

    // Save regular plan
    const { data: saved, error } = await (supabase as any)
      .from('planificaciones')
      .insert({
        user_id:       user.id,
        title,
        type:          body.type === 'trimestre' ? 'unidad' : body.type === 'parcial' ? 'clase' : body.type,
        subject:       body.subject,
        grade:         body.grade,
        topic:         body.topic,
        duration:      body.duration,
        methodologies: body.methodology ? [body.methodology] : (body.methodologies || []),
        content,
        tipo_documento: 'regular',
        academic_year_id: ycx.currentYearId,
        metadata: {
          // En modo Adaptación, NO almacenamos trimestre/parcial/semana — la
          // semana de adaptación está fuera del calendario de parciales. Esto
          // evita que la UI muestre badges T1·P1·S1 que confunden al docente.
          trimestre: isAdaptacion ? null : body.trimestre,
          parcial:   isAdaptacion || body.type === 'trimestre' ? null : body.parcial,
          semana:    isAdaptacion || body.type === 'trimestre' ? null : body.semana,
          eje:       body.eje,
          inserciones: Array.isArray(body.inserciones) ? body.inserciones : [],
          cuadernillo: body.cuadernillo,
          periodMinutes: body.periodMinutes,
          weeklyHours: body.weeklyHours,
          totalWeeklyMinutes: body.totalWeeklyMinutes ?? ((Number(body.periodMinutes) * Number(body.weeklyHours)) || null),
          daysOfWeek: Array.isArray(body.daysOfWeek) && body.daysOfWeek.length > 0 ? body.daysOfWeek : null,
          sesiones: sesiones.length > 0 ? sesiones : null,
          methodology: body.methodology || 'ERCA',
          tipoEspecial: isAdaptacion ? 'adaptacion' : (isEFLBody ? 'efl' : null),
          // Campos EFL (lengua extranjera): se guardan solo si la materia es EFL
          isEFL:       isEFLBody,
          cefrLevel:   isEFLBody ? (body.cefrLevel || null) : null,
          unitNumber:  isEFLBody && body.unitNumber ? Number(body.unitNumber) : null,
          unitTotal:   isEFLBody && body.unitTotal  ? Number(body.unitTotal)  : null,
          cursoAnterior: isAdaptacion ? getPreviousLevel(body.grade).label : null,
          generationScope: body.type === 'trimestre' ? 'trimestre' : null,
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
        max_tokens: dynamicMaxTokens,
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
      truncated: wasTruncated,
      sesionesGeneradas: sesiones.length,
      sesionesEsperadas: numSesionesEsperadas,
    })
  } catch (err: any) {
    console.error('[POST /api/planificaciones]', err)
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}
