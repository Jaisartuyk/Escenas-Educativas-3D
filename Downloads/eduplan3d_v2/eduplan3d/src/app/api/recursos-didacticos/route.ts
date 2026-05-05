// src/app/api/recursos-didacticos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute is enough for this

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres un experto en curación de contenidos educativos para el sistema escolar de Ecuador.
Tu misión es sugerir recursos didácticos de alta calidad (YouTube, artículos científicos, juegos interactivos) basados en los temas de planificación que se te proporcionen.

REGLAS:
1. Sugiere recursos que sean pedagógicamente sólidos y adecuados para el nivel (grado) del estudiante.
2. Prioriza fuentes en español.
3. Para YouTube, sugiere términos de búsqueda específicos o tipos de videos (ej. "Experimentos sencillos de fotosíntesis").
4. Para artículos, sugiere repositorios como Repositorio Investigo (U. Vigo) o Portales de la Complutense si el tema es avanzado, o portales como Educarecuador para temas básicos.
5. Devuelve la respuesta en formato JSON estructurado.`

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { subject, grade, topics } = await req.json()

    if (!subject || !grade) {
      return NextResponse.json({ error: 'Materia y Grado son requeridos' }, { status: 400 })
    }

    const prompt = `Materia: ${subject}
Grado: ${grade}
Temas recientes planificados: ${topics || 'No hay temas específicos, sugiere recursos generales para esta materia y nivel.'}

Por favor, genera un "Kit de Recursos Didácticos" que incluya:
1. 3 Videos de YouTube (título y qué buscar).
2. 2 Recursos Académicos (artículos, PDFs de repositorios).
3. 1 Recurso Interactivo o Juego (tipo Genially, Wordwall o simulación).
4. Un breve consejo pedagógico sobre cómo usar estos materiales en clase.

Formato de respuesta JSON:
{
  "youtube": [{ "title": "...", "search_query": "...", "description": "..." }],
  "academic": [{ "title": "...", "source": "...", "link_suggestion": "..." }],
  "interactive": { "title": "...", "platform": "...", "description": "..." },
  "pedagogical_tip": "..."
}`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    
    // Attempt to parse JSON from response
    try {
      const jsonStart = text.indexOf('{')
      const jsonEnd = text.lastIndexOf('}') + 1
      const jsonStr = text.substring(jsonStart, jsonEnd)
      const data = JSON.parse(jsonStr)
      return NextResponse.json(data)
    } catch (parseError) {
      console.error('Error parsing AI response:', text)
      return NextResponse.json({ error: 'Error al procesar la respuesta de la IA' }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Error en API recursos-didacticos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
