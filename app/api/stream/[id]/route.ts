import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Obtener transmisión de Supabase
    const { data, error } = await supabase
      .from('streams')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    return NextResponse.json({ stream: data });
  } catch (error: any) {
    console.error('Error fetching stream:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Desactivar transmisión
    const { data, error } = await supabase
      .from('streams')
      .update({ 
        active: false,
        ended_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to deactivate stream' }, { status: 500 });
    }

    return NextResponse.json({ success: true, stream: data });
  } catch (error: any) {
    console.error('Error deactivating stream:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
