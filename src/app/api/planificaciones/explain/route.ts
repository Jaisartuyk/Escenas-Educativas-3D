// src/app/api/planificaciones/explain/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { topic, scene } = await request.json()

  const prompt = `Eres un docente experto en ciencias para secundaria y bachillerato del Ecuador.
El estudiante está observando una escena 3D animada de: "${topic || scene}".

Crea una EXPLICACIÓN DIDÁCTICA concisa con este formato exacto:

🔬 DESCRIPCIÓN VISUAL
(2-3 oraciones describiendo qué se ve en la escena 3D y qué partes se mueven o se destacan)

📚 CONCEPTO CLAVE
(Explicación clara del concepto, 2-3 párrafos accesibles para secundaria o bachillerato)

💡 LO QUE DEBES OBSERVAR
• Punto 1 importante
• Punto 2 importante  
• Punto 3 importante
• Punto 4 importante

🎯 PREGUNTAS GUÍA
1. Primera pregunta de análisis
2. Segunda pregunta de comprensión
3. Tercera pregunta de aplicación

✅ CONEXIÓN CURRICULAR (MINEDUC Ecuador)
(Qué destreza o bloque curricular aborda este tema)`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })
    const explanation = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ explanation })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
