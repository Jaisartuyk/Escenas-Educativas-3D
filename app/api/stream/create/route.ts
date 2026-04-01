import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Generar código único de 8 caracteres
function generateStreamCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const { title, userId } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Generar código único
    const streamId = generateStreamCode();

    // Crear transmisión en Supabase
    const { data, error } = await supabase
      .from('streams')
      .insert({
        id: streamId,
        title,
        user_id: userId,
        active: true,
        viewers_count: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating stream:', error);
      return NextResponse.json({ error: 'Failed to create stream' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      stream: data,
      watchUrl: `/watch/${streamId}`
    });
  } catch (error: any) {
    console.error('Stream creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
