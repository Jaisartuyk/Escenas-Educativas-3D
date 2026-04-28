// src/lib/pedagogy/competencias-clave.ts
// Competencias clave MinEduc 2025-2026 (íconos burbuja sobre cada DCD).
// La IA infiere cuál(es) competencia(s) desarrolla cada DCD según su dominio.

export type CompetenciaId = 'C' | 'CM' | 'CD' | 'CS'

export type CompetenciaClave = {
  id: CompetenciaId
  label: string
  description: string
  bg: string         // bg para la burbuja
  text: string       // color del texto
  hex: string        // hex para HTML/PDF
  hint: string       // pista para que la IA decida
}

export const COMPETENCIAS_CLAVE: CompetenciaClave[] = [
  {
    id: 'C',
    label: 'Comunicacionales',
    description: 'Comprensión y producción de textos orales y escritos, expresión.',
    bg: '#a7f3d0',     // teal-200
    text: '#065f46',   // teal-800
    hex: '#0d9488',    // teal-600 base
    hint: 'Lengua, expresión oral, redacción, comprensión lectora.',
  },
  {
    id: 'CM',
    label: 'Matemáticas',
    description: 'Razonamiento lógico, modelización, resolución de problemas cuantitativos.',
    bg: '#bfdbfe',     // blue-200
    text: '#1e3a8a',   // blue-900
    hex: '#2563eb',
    hint: 'Cálculo, álgebra, geometría, estadística, problemas con datos.',
  },
  {
    id: 'CD',
    label: 'Digitales',
    description: 'Manejo crítico de tecnologías, búsqueda, procesamiento y producción digital.',
    bg: '#fed7aa',     // orange-200
    text: '#7c2d12',   // orange-900
    hex: '#ea580c',
    hint: 'Uso de TIC, búsqueda en internet, producción digital, ciudadanía digital.',
  },
  {
    id: 'CS',
    label: 'Socioemocionales',
    description: 'Autoconocimiento, regulación emocional, empatía, trabajo cooperativo.',
    bg: '#fde68a',     // amber-200
    text: '#78350f',   // amber-900
    hex: '#d97706',
    hint: 'Trabajo en equipo, expresión de sentimientos, resolución de conflictos.',
  },
]

export function getCompetencia(id: string): CompetenciaClave | null {
  return COMPETENCIAS_CLAVE.find(c => c.id === id) || null
}

/** Bloque de instrucción para la IA: cómo etiquetar competencias clave. */
export function buildCompetenciasPromptBlock(): string {
  const list = COMPETENCIAS_CLAVE.map(c =>
    `  • ${c.id} = ${c.label}: ${c.hint}`
  ).join('\n')

  return `\n\nCOMPETENCIAS CLAVE EN LAS DCDs (MinEduc 2025-2026):
Cada DCD desarrolla una o más de estas 4 competencias clave. DEBES identificarlas y marcarlas:
${list}

CÓMO MARCARLAS — OBLIGATORIO:
Al final de la descripción de CADA DCD en la columna "Destrezas con criterios de desempeño", agrega entre llaves dobles los códigos de competencia que aplican, separados por coma. Ejemplos:
  - "LL.4.3.2. Producir textos argumentativos... {{C}}"
  - "M.3.1.5. Resolver problemas con porcentajes... {{CM,CS}}"
  - "CN.5.4.1. Investigar usando fuentes digitales... {{CD,C}}"

REGLAS:
1. Toda DCD lleva al menos UNA competencia. Si no estás seguro, usa C para Lengua/Sociales, CM para Matemática/Ciencias cuantitativas, CD si involucra TIC, CS si la actividad es colaborativa o de regulación emocional.
2. Una DCD puede tener varias competencias (máx 3): {{C,CD,CS}}.
3. La marca DEBE ir al final, entre llaves dobles, sin espacios: {{C}} no {{ C }} ni { C }.
4. El sistema parsea esa marca para mostrar íconos visuales — si no la pones, los íconos no aparecen.`
}

/** Regex para extraer las competencias marcadas por la IA en el texto. */
export const COMPETENCIA_TAG_REGEX = /\{\{([CMDS,]+)\}\}/g
