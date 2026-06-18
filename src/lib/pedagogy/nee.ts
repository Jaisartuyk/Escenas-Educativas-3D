// src/lib/pedagogy/nee.ts
// Catálogo de Necesidades Educativas Específicas (NEE).
// Se usa tanto en UI (checkboxes del planificador) como en backend
// para generar planificaciones paralelas adaptadas.
//
// Distinción importante del MinEduc Ecuador:
//   - NEE SIN discapacidad → adaptación NO significativa
//     (se mantienen objetivos/destrezas del grado, se cambia el CÓMO)
//   - NEE CON discapacidad → adaptación SIGNIFICATIVA (DIAC)
//     (pueden cambiarse objetivos/destrezas al nivel real del estudiante)

export interface NeeType {
  /** Código único. */
  code: string
  /** Etiqueta mostrada en la UI. */
  label: string
  /** Categoría: sin_discapacidad o con_discapacidad. */
  category: 'sin_discapacidad' | 'con_discapacidad'
  /** Bloque de instrucciones inyectado en el prompt de adaptación. */
  promptBlock: string
}

export const NEE_TYPES: NeeType[] = [
  // ── SIN DISCAPACIDAD (adaptaciones no significativas) ──────────────────
  {
    code: 'tdah',
    label: 'TDAH (Déficit de Atención e Hiperactividad)',
    category: 'sin_discapacidad',
    promptBlock: `Adaptaciones para TDAH (no significativa):
- Actividades cortas de 3-5 minutos con pausas activas entre tareas.
- Consignas en pasos numerados, una instrucción a la vez.
- Ubicación preferencial cerca del docente, lejos de ventanas.
- Refuerzo positivo frecuente y retroalimentación inmediata.
- Uso de cronómetro visible para gestionar tiempos.
- Evaluación fraccionada: un ejercicio por hoja, sin presión de tiempo excesiva.
- Material manipulable y actividades kinestésicas.`,
  },
  {
    code: 'dislexia',
    label: 'Dislexia / Dificultades lectoescritura',
    category: 'sin_discapacidad',
    promptBlock: `Adaptaciones para dislexia (no significativa):
- Tipografía sans-serif (Arial, Verdana, OpenDyslexic) 14pt, interlineado 1.5.
- Lecturas grabadas en audio o con apoyo de lector de pantalla.
- Evitar lectura en voz alta obligatoria frente a la clase.
- Tiempo extendido 25-50% en lecturas y evaluaciones escritas.
- Consignas leídas en voz alta por el docente además de por escrito.
- No penalizar errores ortográficos en materias distintas a Lengua.
- Uso de mapas mentales, organizadores gráficos con imágenes.`,
  },
  {
    code: 'disgrafia',
    label: 'Disgrafía',
    category: 'sin_discapacidad',
    promptBlock: `Adaptaciones para disgrafía (no significativa):
- Permitir respuestas orales o tipeadas en vez de escritas a mano.
- Hojas con pauta Montessori o cuadrícula grande.
- Reducir cantidad de texto a copiar; entregar apuntes fotocopiados.
- Evaluar contenido, no caligrafía ni ortografía.
- Tiempos extendidos en escritura.`,
  },
  {
    code: 'discalculia',
    label: 'Discalculia',
    category: 'sin_discapacidad',
    promptBlock: `Adaptaciones para discalculia (no significativa):
- Uso permanente de material manipulable (regletas, bloques, ábaco).
- Permitir calculadora y tablas de multiplicar de consulta.
- Ejercicios con números pequeños antes de números grandes.
- Apoyo visual (dibujos, colores por operación).
- Fraccionar problemas complejos en pasos guiados.`,
  },
  {
    code: 'altas_capacidades',
    label: 'Altas capacidades / Superdotación',
    category: 'sin_discapacidad',
    promptBlock: `Adaptaciones para altas capacidades (enriquecimiento curricular):
- Actividades de extensión con mayor profundidad o complejidad.
- Proyectos de investigación autónomos paralelos a la clase.
- Rol de mentor de pares (tutoría entre iguales).
- Acceso a retos, acertijos y problemas abiertos.
- Evitar actividades repetitivas cuando el objetivo ya está alcanzado.`,
  },
  {
    code: 'dif_aprendizaje',
    label: 'Dificultades generales de aprendizaje',
    category: 'sin_discapacidad',
    promptBlock: `Adaptaciones para dificultades generales de aprendizaje:
- Más tiempo, más apoyos visuales, más modelado docente.
- Repetición espaciada del contenido.
- Trabajo en parejas con un compañero tutor.
- Evaluación con apoyos (imágenes, opción múltiple, oral).`,
  },

  // ── CON DISCAPACIDAD (DIAC - adaptación significativa) ─────────────────
  {
    code: 'intelectual_leve',
    label: 'Discapacidad intelectual leve',
    category: 'con_discapacidad',
    promptBlock: `DIAC para discapacidad intelectual leve (significativa):
- Destrezas del grado anterior o del mismo grado simplificadas.
- Vocabulario cotidiano, lenguaje claro y concreto.
- Material 100% visual y manipulable.
- Rutinas fijas y anticipación constante.
- Evaluación mediante observación y con criterios propios (no los del grupo).
- Apoyos permanentes del DECE y del docente sombra si existe.`,
  },
  {
    code: 'intelectual_moderada',
    label: 'Discapacidad intelectual moderada',
    category: 'con_discapacidad',
    promptBlock: `DIAC para discapacidad intelectual moderada (significativa):
- Destrezas funcionales para la vida diaria (escritura del nombre, números hasta 20, colores, formas).
- Pictogramas ARASAAC o similares como apoyo permanente.
- Objetivos individualizados, NO los del grupo-clase.
- Actividades de 5-10 minutos máximo con apoyo 1:1.
- Evaluación cualitativa: nivel de autonomía alcanzado.
- Trabajo articulado con DECE, padres y terapeutas.`,
  },
  {
    code: 'tea_1',
    label: 'TEA Nivel 1 (requiere apoyo)',
    category: 'con_discapacidad',
    promptBlock: `DIAC para TEA nivel 1 (significativa):
- Rutinas predecibles y estructuradas, agenda visual de la clase.
- Anticipación de cambios con 5-10 minutos de aviso.
- Consignas literales, evitar dobles sentidos, ironías, metáforas.
- Apoyo visual en todas las instrucciones (pictogramas, cronograma).
- Espacio sensorialmente regulado (sin ruido excesivo, luz adecuada).
- Tiempo para procesar preguntas; evitar interrupciones.
- Intereses específicos usados como puente motivacional.
- Evaluación: permitir respuestas escritas en vez de orales si hay ansiedad social.`,
  },
  {
    code: 'tea_2',
    label: 'TEA Nivel 2 (requiere apoyo notable)',
    category: 'con_discapacidad',
    promptBlock: `DIAC para TEA nivel 2 (significativa):
- Apoyo 1:1 durante toda la jornada.
- Sistemas alternativos de comunicación (PECS, pictogramas, tablero).
- Actividades muy estructuradas con inicio-desarrollo-fin claros.
- Tiempos de trabajo cortos (5-10 min) con descansos sensoriales.
- Refuerzo positivo inmediato y predecible.
- Objetivos funcionales paralelos al currículo del grupo.
- Rincón de regulación sensorial siempre disponible.`,
  },
  {
    code: 'tea_3',
    label: 'TEA Nivel 3 (requiere apoyo muy notable)',
    category: 'con_discapacidad',
    promptBlock: `DIAC para TEA nivel 3 (significativa):
- Plan individualizado totalmente distinto al del grupo.
- Comunicación aumentativa y alternativa (CAA) como eje.
- Objetivos de autonomía básica, autocuidado y comunicación funcional.
- Trabajo coordinado con equipo multidisciplinar (DECE, TO, fonoaudiólogo).
- Evaluación por evidencias fotográficas/video del progreso individual.`,
  },
  {
    code: 'visual',
    label: 'Discapacidad visual',
    category: 'con_discapacidad',
    promptBlock: `DIAC para discapacidad visual (significativa):
- Material adaptado: sistema Braille, macrotipo (fuente 24pt+), alto contraste.
- Uso de lector de pantalla (NVDA, JAWS) y audios.
- Descripciones verbales detalladas de imágenes y diagramas.
- Material en relieve para gráficos (termoform, tinta abultada).
- Ubicación preferencial con buena iluminación y sin reflejos.
- Tiempo extendido 50-100%.
- Evaluación oral o en formato digital accesible.`,
  },
  {
    code: 'auditiva',
    label: 'Discapacidad auditiva',
    category: 'con_discapacidad',
    promptBlock: `DIAC para discapacidad auditiva (significativa):
- Intérprete de Lengua de Señas Ecuatoriana (LSEC) si el estudiante la usa.
- Ubicación preferencial de frente al docente, con buena luz en la cara.
- Apoyo visual permanente: subtítulos en videos, pizarra, pictogramas.
- Hablar de frente, vocalizando, sin taparse la boca, sin gritar.
- Evaluación visual y escrita, evitando pruebas orales.
- Compañero tutor que tome apuntes.`,
  },
  {
    code: 'motora',
    label: 'Discapacidad motora / física',
    category: 'con_discapacidad',
    promptBlock: `DIAC para discapacidad motora (significativa):
- Accesibilidad física del aula garantizada (rampas, espacio de silla de ruedas).
- Adaptadores para escritura (engrosadores, teclados adaptados).
- Permitir respuestas orales o tipeadas.
- Actividades físicas adaptadas en Educación Física.
- Tiempo extendido para desplazamientos y escritura.
- Material a altura accesible.`,
  },
  {
    code: 'multiple',
    label: 'Discapacidad múltiple',
    category: 'con_discapacidad',
    promptBlock: `DIAC para discapacidad múltiple (significativa):
- Plan 100% individualizado con equipo multidisciplinar.
- Objetivos de autonomía básica y comunicación funcional.
- Estimulación multisensorial permanente.
- Evaluación por progreso individual, no comparativa con el grupo.
- Coordinación estrecha con familia y terapeutas externos.`,
  },
]

export const NEE_SIN_DISCAPACIDAD = NEE_TYPES.filter(n => n.category === 'sin_discapacidad')
export const NEE_CON_DISCAPACIDAD = NEE_TYPES.filter(n => n.category === 'con_discapacidad')

export function getNeeType(code?: string | null): NeeType | null {
  if (!code) return null
  return NEE_TYPES.find(n => n.code === code) || null
}

/** Devuelve el bloque de instrucciones combinado para varios tipos NEE. */
export function buildNeePromptBlock(codes: string[]): string {
  const blocks = codes
    .map(c => getNeeType(c))
    .filter((n): n is NeeType => !!n)
    .map(n => `=== ${n.label} ===\n${n.promptBlock}`)
  return blocks.join('\n\n')
}
