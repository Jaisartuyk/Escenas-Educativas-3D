import { NextResponse } from 'next/server';

// Función para buscar video en YouTube
async function searchYouTubeVideo(query: string): Promise<string> {
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  
  if (!youtubeApiKey) {
    return '';
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${youtubeApiKey}`
    );

    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const videoId = data.items[0].id.videoId;
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    return '';
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return '';
  }
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Falta el prompt' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta la API Key en las variables de entorno' }, { status: 500 });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Error de Anthropic: ${errorData}`);
    }

    const data = await response.json();
    const resultText = data.content?.[0]?.text || '';
    
    // Limpiar el JSON de posibles bloques de código de markdown
    const cleanJson = resultText.replace(/```json|```/g, '').trim();

    // Si es una canción, buscar automáticamente los videos en YouTube
    try {
      const parsedData = JSON.parse(cleanJson);
      
      // Detectar si es una canción (tiene propiedades song y artist)
      if (parsedData.song && parsedData.artist) {
        console.log(`🔍 Buscando videos para: ${parsedData.song} - ${parsedData.artist}`);
        
        // Buscar video original/karaoke
        const originalQuery = `${parsedData.song} ${parsedData.artist} karaoke`;
        const ytUrl = await searchYouTubeVideo(originalQuery);
        
        // Buscar instrumental
        const instrumentalQuery = `${parsedData.song} ${parsedData.artist} instrumental karaoke`;
        const instrumentalUrl = await searchYouTubeVideo(instrumentalQuery);
        
        // Agregar las URLs al objeto
        parsedData.ytUrl = ytUrl;
        parsedData.instrumentalUrl = instrumentalUrl;
        
        console.log(`✅ Videos encontrados - Original: ${ytUrl ? 'Sí' : 'No'}, Instrumental: ${instrumentalUrl ? 'Sí' : 'No'}`);
        
        return NextResponse.json({ result: JSON.stringify(parsedData) });
      }
    } catch (parseError) {
      // Si no se puede parsear o no es una canción, devolver el resultado original
      console.log('No es una canción o error al parsear, devolviendo resultado original');
    }

    return NextResponse.json({ result: cleanJson });
  } catch (error: any) {
    console.error('Error en API:', error);
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 });
  }
}
