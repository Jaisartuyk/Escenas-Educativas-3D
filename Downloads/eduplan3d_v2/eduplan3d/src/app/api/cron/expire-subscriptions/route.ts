// src/app/api/cron/expire-subscriptions/route.ts
// Cron diario: marca como expired y suspende a docentes con suscripcion vencida.
// Configurado en vercel.json para correr cada dia a las 03:00 UTC (~22:00 ECT).
//
// Seguridad: Vercel Cron envia un header `Authorization: Bearer ${CRON_SECRET}`.
// Si CRON_SECRET no esta configurado, fallback: solo permite GET sin payload.

import { NextRequest, NextResponse } from 'next/server'
import { expireOverdueSubscriptions } from '@/lib/actions/subscriptions'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization') || ''
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const result = await expireOverdueSubscriptions()
  return NextResponse.json(result)
}
