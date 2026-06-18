// src/lib/pedagogy/methodologies.ts
// Estrategias metodológicas seleccionables en el planificador.
// Se usa tanto en la UI (PlannerClient) como en el backend (API /planificaciones)
// para inyectar dinámicamente las fases en el prompt de la IA.

export interface Methodology {
  /** Código corto único. También es el valor enviado al backend. */
  code: string
  /** Nombre mostrado en la UI. */
  name: string
  /** Descripción breve (tooltip / subtítulo del selector). */
  description: string
  /** Fases ordenadas que debe incluir la columna de actividades en la planificación. */
  phases: string[]
  /**
   * Bloque de instrucciones que se inyecta al prompt Claude para detallar
   * cada fase y su propósito pedagógico. Debe ser autosuficiente.
   */
  promptBlock: string
  /** Etiqueta corta que aparece como header de columna en la tabla principal. */
  columnHeader: string
}

export const METHODOLOGIES: Methodology[] = [
  {
    code: 'ERCA',
    name: 'ERCA',
    description: 'Experiencia · Reflexión · Conceptualización · Aplicación',
    phases: ['EXPERIENCIA', 'REFLEXIÓN', 'CONCEPTUALIZACIÓN', 'APLICACIÓN'],
    columnHeader: 'ESTRATEGIAS METODOLÓGICAS (CICLO ERCA)',
    promptBlock: `Estructura las actividades en el CICLO ERCA (4 fases con tiempos EXACTOS que sumen la duración total):
- **EXPERIENCIA (X min):** activación de saberes previos, pregunta motivadora, dinámica o situación cotidiana que enganche al estudiante con el tema.
- **REFLEXIÓN (X min):** diálogo guiado con preguntas abiertas (¿qué observaron?, ¿qué sabían antes?, ¿qué relación tiene con su vida?). Análisis grupal.
- **CONCEPTUALIZACIÓN (X min):** presentación sistemática del contenido, organizadores gráficos, modelado docente, construcción conjunta de definiciones.
- **APLICACIÓN (X min):** ejercicios prácticos, transferencia a contexto real, producción individual o grupal. Es la fase de consolidación.`,
  },
  {
    code: 'IDC',
    name: 'IDC',
    description: 'Indagación · Desarrollo · Comunicación',
    phases: ['INDAGACIÓN', 'DESARROLLO', 'COMUNICACIÓN'],
    columnHeader: 'ESTRATEGIAS METODOLÓGICAS (CICLO IDC)',
    promptBlock: `Estructura las actividades en el CICLO IDC (3 fases con tiempos EXACTOS que sumen la duración total):
- **INDAGACIÓN (X min):** pregunta problematizadora, exploración de saberes previos, formulación de hipótesis, observación inicial del fenómeno/tema.
- **DESARROLLO (X min):** construcción del conocimiento, trabajo cooperativo, investigación guiada, modelado docente, experimentación, análisis de fuentes.
- **COMUNICACIÓN (X min):** socialización de hallazgos, exposición, debate, producto final (afiche, organizador, presentación) que evidencia lo aprendido.`,
  },
  {
    code: 'ACC',
    name: 'ACC',
    description: 'Activación · Construcción · Consolidación',
    phases: ['ACTIVACIÓN', 'CONSTRUCCIÓN', 'CONSOLIDACIÓN'],
    columnHeader: 'ESTRATEGIAS METODOLÓGICAS (CICLO ACC)',
    promptBlock: `Estructura las actividades en el CICLO ACC (3 fases con tiempos EXACTOS que sumen la duración total):
- **ACTIVACIÓN (X min):** disparador cognitivo, vínculo con experiencia previa, propósito claro de la clase, lluvia de ideas.
- **CONSTRUCCIÓN (X min):** andamiaje pedagógico, trabajo en zona de desarrollo próximo, práctica guiada con apoyo docente, modelado, trabajo colaborativo.
- **CONSOLIDACIÓN (X min):** práctica independiente, metacognición (¿qué aprendí?, ¿cómo lo aprendí?), síntesis, cierre y transferencia.`,
  },
  {
    code: 'KOLB',
    name: 'Ciclo de Kolb',
    description: 'Experiencia concreta · Observación · Conceptualización · Experimentación',
    phases: ['EXPERIENCIA CONCRETA', 'OBSERVACIÓN REFLEXIVA', 'CONCEPTUALIZACIÓN ABSTRACTA', 'EXPERIMENTACIÓN ACTIVA'],
    columnHeader: 'ESTRATEGIAS METODOLÓGICAS (CICLO DE KOLB)',
    promptBlock: `Estructura las actividades en el CICLO DE KOLB (4 fases con tiempos EXACTOS que sumen la duración total):
- **EXPERIENCIA CONCRETA (X min):** vivencia directa, práctica inmediata, involucramiento sensorial con el fenómeno o contenido.
- **OBSERVACIÓN REFLEXIVA (X min):** análisis de lo vivido, preguntas metacognitivas, diferentes perspectivas del grupo.
- **CONCEPTUALIZACIÓN ABSTRACTA (X min):** teorización, construcción de modelos mentales, relación con teorías previas, definiciones formales.
- **EXPERIMENTACIÓN ACTIVA (X min):** aplicación del concepto a nuevas situaciones, resolución de problemas, transferencia.`,
  },
  {
    code: 'ABP',
    name: 'ABP',
    description: 'Aprendizaje Basado en Problemas',
    phases: ['PRESENTACIÓN DEL PROBLEMA', 'ANÁLISIS E HIPÓTESIS', 'INVESTIGACIÓN', 'RESOLUCIÓN Y REFLEXIÓN'],
    columnHeader: 'ESTRATEGIAS METODOLÓGICAS (ABP)',
    promptBlock: `Estructura las actividades como APRENDIZAJE BASADO EN PROBLEMAS (tiempos EXACTOS que sumen la duración total):
- **PRESENTACIÓN DEL PROBLEMA (X min):** situación auténtica, desafío real, sin respuesta única. Debe generar curiosidad.
- **ANÁLISIS E HIPÓTESIS (X min):** lluvia de ideas, identificación de lo que se sabe y lo que falta por saber, formulación de hipótesis.
- **INVESTIGACIÓN (X min):** búsqueda guiada, consulta de fuentes, trabajo cooperativo, construcción de conocimientos necesarios para resolver.
- **RESOLUCIÓN Y REFLEXIÓN (X min):** propuesta de solución, argumentación, metacognición sobre el proceso.`,
  },
  {
    code: 'ABPR',
    name: 'ABPr',
    description: 'Aprendizaje Basado en Proyectos',
    phases: ['DESAFÍO', 'PLANIFICACIÓN', 'EJECUCIÓN', 'PRESENTACIÓN Y EVALUACIÓN'],
    columnHeader: 'ESTRATEGIAS METODOLÓGICAS (ABPr)',
    promptBlock: `Estructura las actividades como APRENDIZAJE BASADO EN PROYECTOS (tiempos EXACTOS que sumen la duración total):
- **DESAFÍO (X min):** presentación de un producto o meta auténtica a construir, criterios de éxito, conexión con la vida real.
- **PLANIFICACIÓN (X min):** distribución de roles, cronograma, recursos necesarios, hitos de avance.
- **EJECUCIÓN (X min):** trabajo en equipo, producción, iteración, seguimiento docente.
- **PRESENTACIÓN Y EVALUACIÓN (X min):** socialización del producto, autoevaluación, coevaluación, rúbrica del docente.`,
  },
]

export const METHODOLOGY_CODES = METHODOLOGIES.map(m => m.code)

export const DEFAULT_METHODOLOGY = 'ERCA'

/** Busca una metodología por código. Devuelve ERCA si no existe. */
export function getMethodology(code?: string | null): Methodology {
  if (!code) return METHODOLOGIES[0]
  return METHODOLOGIES.find(m => m.code === code) || METHODOLOGIES[0]
}
