import { NextResponse } from 'next/server';

// Estado global del juego (en memoria)
let gameState = {
  currentSong: null as any,
  showInstrumental: false,
  currentIndex: 0,
  currentFootballVideo: null as any,
  timestamp: Date.now()
};

export async function GET() {
  return NextResponse.json(gameState);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    gameState = {
      ...gameState,
      ...data,
      timestamp: Date.now()
    };

    return NextResponse.json({ success: true, state: gameState });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
