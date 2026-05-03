'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { NEE_CON_DISCAPACIDAD, NEE_SIN_DISCAPACIDAD } from '@/lib/pedagogy/nee'

type Props = {
  parentPlanId: string
  subject: string
  grade: string
  topic: string
  duration: string
  compact?: boolean
}

export function PlanVariantActions({
  parentPlanId,
  subject,
  grade,
  topic,
  duration,
  compact = false,
}: Props) {
  const router = useRouter()
  const [neeCodes, setNeeCodes] = useState<string[]>([])
  const [diacCode, setDiacCode] = useState('')
  const [diacStudentName, setDiacStudentName] = useState('')
  const [diacGradoReal, setDiacGradoReal] = useState('')
  const [loading, setLoading] = useState<'nee_sin_disc' | 'diac' | null>(null)

  function toggleNeeCode(code: string) {
    setNeeCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])
  }

  async function readApiResponse(res: Response) {
    const raw = await res.text()
    let data: any = null

    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      data = null
    }

    if (!res.ok) {
      const apiError =
        data?.error ||
        (raw?.includes('<!DOCTYPE') || raw?.includes('<html')
          ? 'El servidor devolvio una pagina de error en lugar de JSON.'
          : raw?.slice(0, 240)) ||
        `Error HTTP ${res.status}`

      throw new Error(
        res.status === 504
          ? 'La generacion tardo demasiado y el servidor corto la respuesta (504). Vuelve a intentarlo en unos segundos.'
          : apiError
      )
    }

    if (!data) {
      throw new Error('La respuesta del servidor no vino en formato JSON valido.')
    }

    return data
  }

  async function generateVariant(kind: 'nee_sin_disc' | 'diac') {
    if (kind === 'nee_sin_disc' && neeCodes.length === 0) {
      return toast.error('Selecciona al menos una necesidad NEE para generar la adaptación.')
    }
    if (kind === 'diac' && !diacCode) {
      return toast.error('Selecciona el tipo de discapacidad para generar el DIAC.')
    }

    setLoading(kind)
    try {
      const res = await fetch('/api/planificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generate_only_variant: true,
          parent_planificacion_id: parentPlanId,
          variant_kind: kind,
          nee_codes: kind === 'diac' ? [diacCode] : neeCodes,
          diac_student_name: kind === 'diac' ? diacStudentName.trim() : '',
          diac_grado_real: kind === 'diac' ? diacGradoReal.trim() : '',
          subject,
          grade,
          topic,
          duration,
        }),
      })
      const data = await readApiResponse(res)

      toast.success(kind === 'diac' ? 'DIAC generado' : 'Adaptación NEE generada')
      if (data?.variant?.id) {
        router.push(`/dashboard/historial/${data.variant.id}`)
      } else {
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo generar la variante')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div id="adaptaciones" className={`rounded-xl border border-surface2 bg-bg ${compact ? 'p-3 space-y-2' : 'p-4 space-y-3'}`}>
      <div>
        <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-ink2`}>Crear variantes desde esta planificación</p>
        <p className="text-[11px] text-ink4 mt-1">
          Genera NEE o DIAC a partir de la trimestral base ya guardada.
        </p>
      </div>

      <div className="rounded-lg border border-surface2 bg-white p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink2">Generar adaptación NEE (sin discapacidad)</p>
        <div className="grid grid-cols-1 gap-1">
          {NEE_SIN_DISCAPACIDAD.map(n => (
            <label key={n.code} className="flex items-start gap-2 text-[11px] text-ink2 cursor-pointer">
              <input
                type="checkbox"
                checked={neeCodes.includes(n.code)}
                onChange={() => toggleNeeCode(n.code)}
                className="accent-violet-600 mt-0.5"
              />
              <span>{n.label}</span>
            </label>
          ))}
        </div>
        <button
          onClick={() => generateVariant('nee_sin_disc')}
          disabled={loading !== null || neeCodes.length === 0}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: '#7C6DFA' }}
        >
          {loading === 'nee_sin_disc' ? 'Generando NEE...' : 'Crear planificación NEE'}
        </button>
      </div>

      <div className="rounded-lg border border-surface2 bg-white p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink2">Generar DIAC (con discapacidad)</p>
        <select
          value={diacCode}
          onChange={e => setDiacCode(e.target.value)}
          className="w-full bg-surface border border-surface2 rounded-lg px-2 py-2 text-[11px] focus:outline-none focus:border-teal-500/50"
        >
          <option value="">Tipo de discapacidad...</option>
          {NEE_CON_DISCAPACIDAD.map(n => (
            <option key={n.code} value={n.code}>{n.label}</option>
          ))}
        </select>
        <input
          value={diacStudentName}
          onChange={e => setDiacStudentName(e.target.value)}
          placeholder="Nombre del estudiante (opcional)"
          className="w-full bg-surface border border-surface2 rounded-lg px-2 py-2 text-[11px] focus:outline-none focus:border-teal-500/50"
        />
        <input
          value={diacGradoReal}
          onChange={e => setDiacGradoReal(e.target.value)}
          placeholder="Grado curricular real (ej: 2do EGB)"
          className="w-full bg-surface border border-surface2 rounded-lg px-2 py-2 text-[11px] focus:outline-none focus:border-teal-500/50"
        />
        <button
          onClick={() => generateVariant('diac')}
          disabled={loading !== null || !diacCode}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: '#0f766e' }}
        >
          {loading === 'diac' ? 'Generando DIAC...' : 'Crear planificación DIAC'}
        </button>
      </div>
    </div>
  )
}
