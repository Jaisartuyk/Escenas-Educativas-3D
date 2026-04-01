import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  
  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  // Usar la API de YouTube Data v3
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    // Si no hay API key, devolver una búsqueda manual
    return NextResponse.json({ 
      manualSearch: true,
      searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    });
  }

  try {
    // Agregar "karaoke" al query para buscar videos de karaoke que suelen permitir embedding
    const enhancedQuery = query.includes('karaoke') || query.includes('instrumental') 
      ? query 
      : `${query} karaoke`;
    
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(enhancedQuery)}&type=video&videoEmbeddable=true&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error('YouTube API request failed');
    }

    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const videoId = data.items[0].id.videoId;
      return NextResponse.json({ 
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: data.items[0].snippet.title
      });
    }

    return NextResponse.json({ error: 'No results found' }, { status: 404 });
  } catch (error) {
    console.error('YouTube search error:', error);
    return NextResponse.json({ 
      manualSearch: true,
      searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    }, { status: 500 });
  }
}
