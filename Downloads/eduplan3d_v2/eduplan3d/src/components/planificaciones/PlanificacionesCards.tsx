'use client'
// src/components/planificaciones/PlanificacionesCards.tsx
// Grid de tarjetas: una por cada par materia/curso del docente.
// Click → /dashboard/planificaciones/[id] (editor rich-text, Fase 4).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, FileText, FilePlus, CheckCircle2, Clock, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ensurePlanificacionManual } from '@/lib/actions/planificaciones-manuales'

type Subject = {
  id: string
  name: string
  course_id: string | null
  course: { id: string; name: string; parallel: string; level: string } | null
}

type ManualPlan = {
  id: string
  subject_id: string | null
  course_id: string | null
  status: 'borrador' | 'publicada'
  updated_at: string
  title: string
}

export function PlanificacionesCards({
  subjects,
  manualPlans,
  academicYearId,
}: {
  subjects: Subject[]
  manualPlans: ManualPlan[]
  academicYearId: string | null
}) {
  const router = useRouter()
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [_, startTransition] = useTransition()

  // Index de planes existentes por subject_id+course_id
  const planMap = new Map<string, ManualPlan>()
  for (const p of manualPlans) {
    if (p.subject_id && p.course_id) {
      planMap.set(`${p.subject_id}::${p.course_id}`, p)
    }
  }

  async function openOrCreate(s: Subject) {
    if (!s.course_id) {
      toast.error('Esta materia no tiene curso asignado. Pide al admin que la vincule.')
      return
    }
    const key = `${s.id}::${s.course_id}`
    const existing = planMap.get(key)
    if (existing) {
      router.push(`/dashboard/planificaciones/${existing.id}`)
      return
    }
    setOpeningId(s.id)
    try {
      const courseLabel = s.course
        ? `${s.course.name}${s.course.parallel ? ' ' + s.course.parallel : ''}`
        : 'Sin curso'
      const r = await ensurePlanificacionManual({
        subjectId: s.id,
        courseId: s.course_id,
        subjectName: s.name,
        courseName: courseLabel,
        academicYearId,
      })
      if (!r.ok || !r.id) throw new Error(r.error || 'No se pudo crear')
      startTransition(() => {
        router.push(`/dashboard/planificaciones/${r.id}`)
      })
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'desconocido'))
      setOpeningId(null)
    }
  }

  if (subjects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-10 text-center bg-bg2">
        <BookOpen size={32} className="mx-auto text-ink4 mb-3" />
        <h2 className="font-display text-lg font-bold mb-1">No tienes materias asignadas</h2>
        <p className="text-sm text-ink3">
          Pide al administrador que te asigne materias para empezar a planificar.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {subjects.map(s => {
        const courseLabel = s.course
          ? `${s.course.name}${s.course.parallel ? ' ' + s.course.parallel : ''}`
          : 'Sin curso'
        const key = s.course_id ? `${s.id}::${s.course_id}` : null
        const existing = key ? planMap.get(key) : null
        const isOpening = openingId === s.id

        const statusBadge = existing ? (
          existing.status === 'publicada' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">
              <CheckCircle2 size={10} /> Publicada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
              <Clock size={10} /> Borrador
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-violet/10 text-violet px-2 py-0.5 rounded-full">
            <FilePlus size={10} /> Sin crear
          </span>
        )

        return (
          <button
            key={s.id}
            onClick={() => openOrCreate(s)}
            disabled={isOpening}
            className={`
              text-left rounded-2xl border bg-white p-5 transition-all
              hover:border-violet hover:shadow-md disabled:opacity-60 disabled:cursor-wait
              ${existing ? 'border-line' : 'border-dashed border-line'}
            `}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet/15 to-violet/5 flex items-center justify-center">
                {existing ? (
                  <FileText size={20} className="text-violet" />
                ) : (
                  <FilePlus size={20} className="text-ink4" />
                )}
              </div>
              {statusBadge}
            </div>

            <h3 className="font-display text-base font-bold text-ink mb-1 line-clamp-2">
              {s.name}
            </h3>
            <p className="text-xs text-ink3 mb-3">{courseLabel}</p>

            <div className="flex items-center justify-between text-[11px] text-ink4">
              {existing ? (
                <>
                  <span>Última edición</span>
                  <span className="font-semibold text-ink3">
                    {new Date(existing.updated_at).toLocaleDateString('es-EC', {
                      day: 'numeric', month: 'short',
                    })}
                  </span>
                </>
              ) : (
                <span className="text-violet font-semibold">
                  {isOpening ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 size={11} className="animate-spin" /> Creando…
                    </span>
                  ) : 'Crear planificación →'}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
