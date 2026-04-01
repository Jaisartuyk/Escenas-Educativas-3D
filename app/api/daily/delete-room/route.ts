import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest) {
  try {
    const { roomName } = await request.json();

    if (!roomName) {
      return NextResponse.json({ error: 'Room name required' }, { status: 400 });
    }

    const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('Error deleting Daily room:', data);
      return NextResponse.json({ error: data }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Daily room:', error);
    return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 });
  }
}
