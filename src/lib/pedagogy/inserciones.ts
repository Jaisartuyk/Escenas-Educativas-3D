// src/lib/pedagogy/inserciones.ts
// Inserciones curriculares obligatorias MinEduc 2025-2026.
// Cada planificación debe integrar al menos UNA dentro de las DCDs
// (no como sección separada, sino DENTRO de las actividades).

export type InsercionId =
  | 'civica_etica'
  | 'desarrollo_sostenible'
  | 'socioemocional'
  | 'financiera'
  | 'vial'

export type Insercion = {
  id: InsercionId
  label: string
  shortLabel: string
  emoji: string
  color: string         // tailwind base, ej: 'rose', 'emerald'
  bg: string            // bg class
  border: string        // border class
  text: string          // text class
  hex: string           // hex sólido para banners externos (PDF, html)
  description: string
}

export const INSERCIONES: Insercion[] = [
  {
    id: 'civica_etica',
    label: 'Cívica, Ética e Integridad',
    shortLabel: 'Cívica',
    emoji: '🚩',
    color: 'rose',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    hex: '#e11d48',
    description: 'Convivencia, valores, ciudadanía, integridad personal y democrática.',
  },
  {
    id: 'desarrollo_sostenible',
    label: 'Desarrollo Sostenible',
    shortLabel: 'Sostenible',
    emoji: '🌱',
    color: 'emerald',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    hex: '#059669',
    description: 'Cuidado ambiental, ODS, consumo responsable, biodiversidad.',
  },
  {
    id: 'socioemocional',
    label: 'Educación Socioemocional',
    shortLabel: 'Socioemocional',
    emoji: '🤝',
    color: 'sky',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
    hex: '#0284c7',
    description: 'Autoconocimiento, regulación emocional, empatía, relaciones.',
  },
  {
    id: 'financiera',
    label: 'Educación Financiera',
    shortLabel: 'Financiera',
    emoji: '💰',
    color: 'amber',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    hex: '#d97706',
    description: 'Manejo del dinero, ahorro, presupuesto, derechos del consumidor.',
  },
  {
    id: 'vial',
    label: 'Educación Vial',
    shortLabel: 'Vial',
    emoji: '🚲',
    color: 'blue',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    hex: '#2563eb',
    description: 'Seguridad vial, comportamiento peatonal y de pasajero, normas de tránsito.',
  },
]

export function getInsercion(id: string | null | undefined): Insercion | null {
  if (!id) return null
  return INSERCIONES.find(i => i.id === id) || null
}

export function getInserciones(ids: string[] | null | undefined): Insercion[] {
  if (!Array.isArray(ids)) return []
  return ids.map(getInsercion).filter((x): x is Insercion => !!x)
}

/** Bloque de texto para inyectar al prompt de la IA. */
export function buildInsercionesPromptBlock(ids: string[] | null | undefined): string {
  const items = getInserciones(ids)
  if (items.length === 0) return ''

  const list = items.map(i =>
    `- ${i.emoji} ${i.label}: ${i.description}`
  ).join('\n')

  return `\n\nINSERCIONES CURRICULARES OBLIGATORIAS PARA ESTA PLANIFICACIÓN (MinEduc 2025-2026):
${list}

REGLA DE INTEGRACIÓN:
1. NO crees una sección aparte titulada "Inserciones curriculares" para mencionarlas; las inserciones deben aparecer INTEGRADAS dentro de las actividades concretas de cada DCD/sesión.
2. Selecciona el contenido temático de las actividades, lecturas modelo o problemas para que naturalmente toquen la(s) inserción(es) seleccionada(s). Ejemplo: si la DCD es "Producir textos argumentativos" y la inserción es Desarrollo Sostenible, el tema del texto puede ser "El uso responsable del agua en mi comunidad".
3. Cada vez que una actividad, recurso o criterio de evaluación integre una inserción, debes marcarla VISUALMENTE con su icono y etiqueta corta entre corchetes. Ejemplo: "[🌱 Sostenible] Lectura comparativa de dos noticias sobre reciclaje."
4. Si una misma línea integra más de una inserción, puedes usar más de una marca, pero solo si aplica de verdad. Ejemplo: "[🚩 Cívica] [🤝 Socioemocional] Debate guiado sobre normas de convivencia digital."
5. NO marques inserciones que no apliquen genuinamente; la integración debe ser pertinente al tema curricular, no forzada.

DISEÑO UNIVERSAL DE APRENDIZAJE (DUA) — OBLIGATORIO al integrar inserciones:
Las actividades que integran una inserción deben respetar los 3 principios DUA del MinEduc para garantizar acceso equitativo:

  · Múltiples formas de REPRESENTACIÓN: presenta el contenido en al menos 2 formatos (texto + imagen, video + esquema, lectura + audio). Anota qué formato usas.
  · Múltiples formas de ACCIÓN y EXPRESIÓN: ofrece a los estudiantes opciones para demostrar lo aprendido (escrito, oral, gráfico, dramatización, producto digital). Anota las opciones.
  · Múltiples formas de IMPLICACIÓN: conecta el contenido con intereses/contexto del estudiante para activar motivación (trabajo cooperativo, elección, vinculación con su comunidad).

CÓMO MARCARLO en la planificación:
Cuando una actividad cubra uno de los 3 principios DUA, etiquétalo al final entre paréntesis. Ejemplo:
  "[🌱 Sostenible] Producir un afiche o un podcast corto sobre el ahorro de agua en su barrio. (DUA: acción/expresión múltiple, implicación con contexto local)"

REGLA: al menos UNA actividad por sesión debe declarar explícitamente qué principio DUA aplica.`
}
