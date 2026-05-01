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
    <div className="print:hidden mb-5 rounded-2xl border border-surface2 bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Users size={16} className="text-violet2" />
            {title}
          </p>
          <p className="mt-1 text-xs text-ink4">{description}</p>
        </div>

        <div className="min-w-[280px]">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink4">
            Hijo seleccionado
          </label>
          <select
            value={selectedChildId}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full rounded-xl border border-surface2 bg-bg px-4 py-2.5 text-sm text-ink outline-none transition focus:border-violet"
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
