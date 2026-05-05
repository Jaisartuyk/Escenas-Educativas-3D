import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const SYSTEM_PROMPT = `Eres un experto en curacion de contenidos educativos para el sistema escolar de Ecuador.
Tu mision es sugerir recursos didacticos de alta calidad (YouTube, articulos cientificos, juegos interactivos) basados en los temas de planificacion que se te proporcionen.

REGLAS:
1. Sugiere recursos que sean pedagogicamente solidos y adecuados para el nivel del estudiante.
2. Prioriza fuentes en espanol.
3. Para YouTube, sugiere terminos de busqueda especificos o tipos de videos.
4. Para articulos, sugiere repositorios o portales educativos confiables.
5. Devuelve la respuesta en formato JSON estructurado sin texto extra fuera del JSON.`

type RecursosPayload = {
  youtube: Array<{
    title: string
    search_query: string
    description: string
    video_id?: string
    embed_url?: string
    watch_url?: string
    thumbnail_url?: string
    channel_title?: string
  }>
  academic: Array<{ title: string; source: string; link_suggestion: string }>
  interactive: { title: string; platform: string; description: string }
  pedagogical_tip: string
}

type YoutubeApiSearchItem = {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    channelTitle?: string
    thumbnails?: {
      high?: { url?: string }
      medium?: { url?: string }
      default?: { url?: string }
    }
  }
}

const youtubeApiKey = process.env.YOUTUBE_API_KEY

function extractJsonObject(text: string): RecursosPayload | null {
  const cleaned = text
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim()

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null

  const candidate = cleaned.slice(firstBrace, lastBrace + 1)

  try {
    return JSON.parse(candidate) as RecursosPayload
  } catch {
    return null
  }
}

function buildFallbackResources(subject: string, grade: string, topics?: string | null): RecursosPayload {
  const topicHint = topics?.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3)
  const mainTopic = topicHint?.[0] || `contenidos clave de ${subject}`

  return {
    youtube: [
      {
        title: `Explicacion guiada de ${mainTopic}`,
        search_query: `${subject} ${grade} ${mainTopic} explicacion para estudiantes Ecuador`,
        description: 'Busca un video breve de introduccion con ejemplos claros y vocabulario acorde al nivel.',
      },
      {
        title: `Ejercicios resueltos de ${subject}`,
        search_query: `${subject} ${grade} ejercicios resueltos ${mainTopic}`,
        description: 'Prioriza videos con desarrollo paso a paso para reforzar comprension y practica.',
      },
      {
        title: `Clase interactiva o repaso de ${mainTopic}`,
        search_query: `${subject} ${grade} repaso interactivo ${mainTopic}`,
        description: 'Ideal para cierre de clase o retroalimentacion despues de una actividad escrita.',
      },
    ],
    academic: [
      {
        title: `Lecturas y materiales de apoyo sobre ${mainTopic}`,
        source: 'Google Academico / repositorios universitarios',
        link_suggestion: `${subject} ${mainTopic} site:scholar.google.com OR site:educarecuador.gob.ec`,
      },
      {
        title: `Guias didacticas de ${subject} para ${grade}`,
        source: 'Ministerio de Educacion / portales educativos',
        link_suggestion: `${subject} ${grade} guia didactica Ecuador pdf`,
      },
    ],
    interactive: {
      title: `Actividad interactiva de ${mainTopic}`,
      platform: 'Wordwall / Genially / Liveworksheets',
      description: 'Usa un recurso interactivo corto para activar conocimientos previos o cerrar la sesion con verificacion rapida.',
    },
    pedagogical_tip: `Usa los recursos de forma secuencial: activa con un video corto, profundiza con una lectura guiada y cierra con una actividad interactiva centrada en ${mainTopic}.`,
  }
}

async function enrichYoutubeResources(
  resources: RecursosPayload['youtube']
): Promise<RecursosPayload['youtube']> {
  if (!youtubeApiKey || resources.length === 0) {
    return resources
  }

  const enriched = await Promise.all(
    resources.map(async (resource) => {
      try {
        const params = new URLSearchParams({
          key: youtubeApiKey,
          part: 'snippet',
          q: resource.search_query,
          type: 'video',
          maxResults: '1',
          regionCode: 'EC',
          relevanceLanguage: 'es',
          safeSearch: 'moderate',
          videoEmbeddable: 'true',
        })

        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        })

        if (!response.ok) {
          return resource
        }

        const json = (await response.json()) as { items?: YoutubeApiSearchItem[] }
        const first = json.items?.[0]
        const videoId = first?.id?.videoId

        if (!videoId) {
          return resource
        }

        const thumbnail =
          first?.snippet?.thumbnails?.high?.url ||
          first?.snippet?.thumbnails?.medium?.url ||
          first?.snippet?.thumbnails?.default?.url

        return {
          ...resource,
          title: first?.snippet?.title?.trim() || resource.title,
          video_id: videoId,
          embed_url: `https://www.youtube.com/embed/${videoId}`,
          watch_url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail_url: thumbnail,
          channel_title: first?.snippet?.channelTitle?.trim() || undefined,
        }
      } catch {
        return resource
      }
    })
  )

  return enriched
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { subject, grade, topics } = await req.json()

    if (!subject || !grade) {
      return NextResponse.json({ error: 'Materia y grado son requeridos' }, { status: 400 })
    }

    const prompt = `Materia: ${subject}
Grado: ${grade}
Temas recientes planificados: ${topics || 'No hay temas especificos; sugiere recursos generales para esta materia y nivel.'}

Genera un kit de recursos didacticos que incluya:
1. 3 videos de YouTube (titulo, busqueda y descripcion).
2. 2 recursos academicos (titulo, fuente y sugerencia de busqueda o enlace).
3. 1 recurso interactivo o juego.
4. Un breve consejo pedagogico.

Formato JSON:
{
  "youtube": [{ "title": "...", "search_query": "...", "description": "..." }],
  "academic": [{ "title": "...", "source": "...", "link_suggestion": "..." }],
  "interactive": { "title": "...", "platform": "...", "description": "..." },
  "pedagogical_tip": "..."
}`

    if (!anthropic) {
      const fallback = buildFallbackResources(subject, grade, topics)
      fallback.youtube = await enrichYoutubeResources(fallback.youtube)
      return NextResponse.json(fallback)
    }

    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
      const parsed = extractJsonObject(text)

      if (parsed) {
        parsed.youtube = await enrichYoutubeResources(parsed.youtube)
        return NextResponse.json(parsed)
      }

      console.error('Error parsing AI response for recursos-didacticos:', text)
      const fallback = buildFallbackResources(subject, grade, topics)
      fallback.youtube = await enrichYoutubeResources(fallback.youtube)
      return NextResponse.json(fallback)
    } catch (aiError) {
      console.error('Error generating didactic resources with AI:', aiError)
      const fallback = buildFallbackResources(subject, grade, topics)
      fallback.youtube = await enrichYoutubeResources(fallback.youtube)
      return NextResponse.json(fallback)
    }
  } catch (error: any) {
    console.error('Error en API recursos-didacticos:', error)
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 })
  }
}
