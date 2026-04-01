import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('Creating Daily room...');
    console.log('API Key exists:', !!process.env.DAILY_API_KEY);
    console.log('API Key length:', process.env.DAILY_API_KEY?.length);

    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
      },
      body: JSON.stringify({
        properties: {
          enable_screenshare: true,
          enable_chat: false,
          start_video_off: false,
          start_audio_off: false
        }
      })
    });

    const data = await response.json();

    console.log('Daily API response status:', response.status);
    console.log('Daily API response:', data);

    if (!response.ok) {
      console.error('Daily API error:', data);
      return NextResponse.json({ 
        error: data,
        message: 'Daily API returned an error',
        details: data
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      roomUrl: data.url,
      roomName: data.name
    });
  } catch (error) {
    console.error('Error creating Daily room:', error);
    return NextResponse.json({ 
      error: 'Failed to create room',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
