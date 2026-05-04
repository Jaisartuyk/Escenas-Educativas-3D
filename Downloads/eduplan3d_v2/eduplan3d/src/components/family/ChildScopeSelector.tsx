'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Users } from 'lucide-react'

interface LinkedChildOption {
  childId: string
  fullName: string
  relationship: string
  isPrimary?: boolean
}

interface Props {
  childrenOptions: LinkedChildOption[]
  selectedChildId: string
  title?: string
  description?: string
}

function formatRelationship(value: string) {
  const normalized = (value || '').toLowerCase()
  if (normalized === 'madre') return 'Madre'
  if (normalized === 'padre') return 'Padre'
  if (normalized === 'tutor') return 'Tutor'
  return value || 'Representante'
}

export function ChildScopeSelector({
  childrenOptions,
  selectedChildId,
  title = 'Estudiante en seguimiento',
  description = 'Cambia el estudiante para ver sus datos en esta pantalla.',
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (childrenOptions.length <= 1) return null

  function handleChange(nextChildId: string) {
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('child_id', nextChildId)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="print:hidden mb-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Users size={15} />
            </span>
            {title}
          </p>
          <p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-400/70 ml-9">{description}</p>
        </div>

        <div className="min-w-[280px]">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-emerald-700/70 dark:text-emerald-400/70">
            Estudiante seleccionado
          </label>
          <select
            value={selectedChildId}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full rounded-xl border border-emerald-200 dark:border-emerald-700/50 bg-white dark:bg-emerald-900/20 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
          >
            {childrenOptions.map((child) => (
              <option key={child.childId} value={child.childId}>
                {child.fullName} - {formatRelationship(child.relationship)}
                {child.isPrimary ? ' (principal)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
