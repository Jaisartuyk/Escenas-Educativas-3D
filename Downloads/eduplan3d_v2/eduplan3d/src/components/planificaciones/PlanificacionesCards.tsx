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
import { ensurePlanificacionManual, type PlanManualType } from '@/lib/actions/planificaciones-manuales'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

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
  type: PlanManualType
  unit_number: number | null
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
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [_, startTransition] = useTransition()

  // Index de planes existentes por subject_id+course_id -> array de planes
  const subjectPlansMap = new Map<string, ManualPlan[]>()
  for (const p of manualPlans) {
    if (p.subject_id && p.course_id) {
      const key = `${p.subject_id}::${p.course_id}`
      const list = subjectPlansMap.get(key) || []
      list.push(p)
      subjectPlansMap.set(key, list)
    }
  }

  async function handleCreate(s: Subject, type: PlanManualType, unitNumber?: number) {
    setOpeningId(`${s.id}-${type}`)
    try {
      const courseLabel = s.course
        ? `${s.course.name}${s.course.parallel ? ' ' + s.course.parallel : ''}`
        : 'Sin curso'
      const r = await ensurePlanificacionManual({
        subjectId: s.id,
        courseId: s.course_id!,
        subjectName: s.name,
        courseName: courseLabel,
        type,
        unitNumber,
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
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map(s => {
          const courseLabel = s.course
            ? `${s.course.name}${s.course.parallel ? ' ' + s.course.parallel : ''}`
            : 'Sin curso'
          const key = s.course_id ? `${s.id}::${s.course_id}` : null
          const existingPlans = key ? subjectPlansMap.get(key) || [] : []
          
          return (
            <button
              key={s.id}
              onClick={() => setSelectedSubject(s)}
              className="text-left rounded-2xl border border-line bg-white p-5 transition-all hover:border-violet hover:shadow-md group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet/15 to-violet/5 flex items-center justify-center group-hover:from-violet/20">
                  <BookOpen size={20} className="text-violet" />
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {['anual', 'semanal', 'diaria'].map(type => {
                    const count = existingPlans.filter(p => p.type === type).length
                    if (count === 0) return null
                    return (
                      <span key={type} className="text-[9px] font-bold uppercase bg-ink/5 text-ink3 px-1.5 py-0.5 rounded-md">
                        {type.slice(0, 3)}: {count}
                      </span>
                    )
                  })}
                </div>
              </div>

              <h3 className="font-display text-base font-bold text-ink mb-1 line-clamp-2">
                {s.name}
              </h3>
              <p className="text-xs text-ink3 mb-4">{courseLabel}</p>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-violet font-semibold transition-transform group-hover:translate-x-1">
                  Gestionar planificaciones →
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <Modal
        open={!!selectedSubject}
        onClose={() => setSelectedSubject(null)}
        title={`Planificaciones: ${selectedSubject?.name}`}
        description={selectedSubject?.course ? `${selectedSubject.course.name} ${selectedSubject.course.parallel || ''}` : ''}
      >
        <div className="space-y-6 pt-4 pb-2">
          {['anual', 'semanal', 'diaria'].map((type) => {
            const key = selectedSubject ? `${selectedSubject.id}::${selectedSubject.course_id}` : ''
            const plans = (subjectPlansMap.get(key) || []).filter(p => p.type === type)
            const typeLabel = type === 'anual' ? 'Anual (PCA)' : type === 'semanal' ? 'Semanal (PUD)' : 'Diaria'
            
            return (
              <div key={type} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink3">{typeLabel}</h4>
                  {/* For annual, only allow one. For others, allow many. */}
                  {(type !== 'anual' || plans.length === 0) && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleCreate(selectedSubject!, type as PlanManualType, type === 'anual' ? undefined : plans.length + 1)}
                      isLoading={openingId === `${selectedSubject?.id}-${type}`}
                    >
                      <FilePlus size={12} className="mr-1" /> Nuevo
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {plans.length === 0 ? (
                    <p className="text-xs text-ink4 italic">Sin planificaciones creadas.</p>
                  ) : (
                    plans.map(p => (
                      <button
                        key={p.id}
                        onClick={() => router.push(`/dashboard/planificaciones/${p.id}`)}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-line hover:border-violet hover:bg-violet/[0.02] bg-bg transition-all group/item"
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={16} className="text-violet/60" />
                          <div className="text-left">
                            <p className="text-sm font-semibold text-ink group-hover/item:text-violet transition-colors">{p.title}</p>
                            <p className="text-[10px] text-ink4">
                              Actualizado: {new Date(p.updated_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {p.status === 'publicada' ? (
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        ) : (
                          <Clock size={14} className="text-amber-500" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
