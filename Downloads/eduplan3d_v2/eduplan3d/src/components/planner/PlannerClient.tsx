// src/components/planner/PlannerClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Planificacion } from '@/types/supabase'
import {
  BookOpen, CalendarDays, Clock, GraduationCap,
  FileText, ClipboardList, Target, Sparkles, Copy, ExternalLink,
} from 'lucide-react'
import { METHODOLOGIES, DEFAULT_METHODOLOGY } from '@/lib/pedagogy/methodologies'
import { NEE_SIN_DISCAPACIDAD, NEE_CON_DISCAPACIDAD } from '@/lib/pedagogy/nee'
import { scheduleAdaptationWeek } from '@/lib/actions/planner-setup'
import { getPreviousLevel } from '@/lib/curriculo/previous-grade'
import { INSERCIONES, type InsercionId } from '@/lib/pedagogy/inserciones'
import { getInstitutionalMatriz } from '@/lib/actions/inserciones-distribucion'
import {
  isEFLSubject, isLanguageSubject, CEFR_LEVELS, suggestCEFRLevel, type CEFRLevel,
} from '@/lib/pedagogy/subject-types'

// ── Constants ────────────────────────────────────────────────────────────────
const TRIMESTRES = [
  { value: 1, label: 'Trimestre 1' },
  { value: 2, label: 'Trimestre 2' },
  { value: 3, label: 'Trimestre 3' },
]

// PARCIALES se genera dinámicamente según parcialesCount

const SEMANAS = [
  { value: 1, label: 'Semana 1' },
  { value: 2, label: 'Semana 2' },
  { value: 3, label: 'Semana 3' },
  { value: 4, label: 'Semana 4' },
  { value: 5, label: 'Semana 5' },
  { value: 6, label: 'Semana 6 (Aporte)' },
]

// EJES_TRANSVERSALES (Justicia/Innovacion/Solidaridad) eliminado en favor de
// las Inserciones Curriculares MinEduc 2025-2026 (ver lib/pedagogy/inserciones.ts).

const GENERATION_MODES = [
  { id: 'clase',   label: 'Clase diaria',     icon: FileText,     desc: 'Una sesion de clase' },
  { id: 'parcial', label: 'Parcial completo', icon: CalendarDays, desc: '6 semanas de clases' },
  { id: 'abp',     label: 'Proyecto ABP',     icon: Sparkles,     desc: 'Proyecto de 6 semanas' },
  { id: 'unidad',  label: 'Unidad didactica', icon: BookOpen,     desc: 'Unidad completa' },
  { id: 'adaptacion', label: 'Semana Adaptacion', icon: Sparkles,    desc: 'Diagnostico + Adaptacion' },
  { id: 'rubrica', label: 'Rubrica',          icon: Target,       desc: 'Evaluacion con descriptores' },
]

function getGenerationModes(isPlannerSoloTeacher: boolean) {
  if (!isPlannerSoloTeacher) return GENERATION_MODES
  return GENERATION_MODES.map(mode =>
    mode.id === 'parcial'
      ? {
          ...mode,
          label: 'Trimestre completo',
          desc: 'Plantilla oficial trimestral basada en tu PUD',
        }
      : mode
  )
}

// ── Component ────────────────────────────────────────────────────────────────
export function PlannerClient({
  teacherName, teacherPlan, institutionName,
  subjects, periodMinutes, parcialesCount = 2,
  academicYearId,
}: {
  teacherName: string
  teacherPlan: string
  institutionName: string
  subjects: any[]
  periodMinutes: number
  parcialesCount?: number
  academicYearId: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMode = 'clase'
  const isPlannerSoloTeacher = teacherPlan === 'planner_solo'
  const generationModes = getGenerationModes(isPlannerSoloTeacher)

  // Form state
  const [mode,       setMode]       = useState(initialMode)
  const [subjectId,  setSubjectId]  = useState('')
  const [trimestre,  setTrimestre]  = useState(1)
  const [parcial,    setParcial]    = useState(1)
  const [semana,     setSemana]     = useState(1)
  const [topic,      setTopic]      = useState('')
  const [eje,        setEje]        = useState('Justicia')  // legacy, queda por compat
  const [inserciones, setInserciones] = useState<InsercionId[]>([])
  // EFL / lenguas extranjeras: nivel CEFR + unit number (opcional)
  const [cefrLevel,  setCefrLevel]  = useState<CEFRLevel | ''>('')
  const [unitNumber, setUnitNumber] = useState<string>('')   // string para input controlado
  const [unitTotal,  setUnitTotal]  = useState<string>('')
  
  // ── Auto-vincular Inserciones desde la Matriz Anual ──
  useEffect(() => {
    // Solo para docentes institucionales (los externos no tienen matriz centralizada)
    if (!institutionName || !academicYearId) return

    async function loadMatrizSugestion() {
      try {
        const res = await getInstitutionalMatriz({ academicYearId: academicYearId || undefined })
        if (res.ok && res.rows) {
          const row = res.rows.find(r => r.trimestre === trimestre)
          if (row && row.inserciones) {
            setInserciones(row.inserciones)
            // Solo notificamos si hay algo que sugerir
            if (row.inserciones.length > 0) {
              toast(`Inserciones sugeridas por la institución para el Trimestre ${trimestre}`, {
                icon: '🌍',
                //@ts-ignore
                style: { fontSize: '12px' }
              })
            }
          }
        }
      } catch (e) {
        console.error('[loadMatrizSugestion]', e)
      }
    }
    loadMatrizSugestion()
  }, [trimestre, institutionName, academicYearId])
  const [methodology, setMethodology] = useState(DEFAULT_METHODOLOGY)
  const [cuadernillo, setCuadernillo] = useState('')
  const [extra,      setExtra]      = useState('')
  const [loading,    setLoading]    = useState(false)
  
  // Forzar metodología ABPr si el modo es ABP
  useEffect(() => {
    if (mode === 'abp') {
      setMethodology('ABPR')
    }
  }, [mode])
  const [result,     setResult]     = useState<Planificacion | null>(null)
  const [results,    setResults]    = useState<Planificacion[]>([]) // for parcial mode

  // NEE state
  const [neeSinDiscEnabled,  setNeeSinDiscEnabled]  = useState(false)
  const [neeSinDiscCodes,    setNeeSinDiscCodes]    = useState<string[]>([])
  const [neeConDiscEnabled,  setNeeConDiscEnabled]  = useState(false)
  const [neeConDiscCode,     setNeeConDiscCode]     = useState('')
  const [diacStudentName,    setDiacStudentName]    = useState('')
  const [diacGradoReal,      setDiacGradoReal]      = useState('')

  // Variantes generadas (nee_sin_disc + diac) para mostrar en tabs
  const [variants, setVariants] = useState<Planificacion[]>([])
  const [activeTab, setActiveTab] = useState<'regular' | 'nee_sin_disc' | 'diac'>('regular')
  const [detectedPlanification, setDetectedPlanification] = useState(false)
  const [generatingVariant, setGeneratingVariant] = useState<'nee_sin_disc' | 'diac' | null>(null)

  useEffect(() => {
    const requestedMode = searchParams.get('mode')
    if (requestedMode && generationModes.some(m => m.id === requestedMode)) {
      setMode(requestedMode)
    }
  }, [generationModes, searchParams])

  // Scheduling state
  const [mondayStartDate, setMondayStartDate] = useState(() => {
    const d = new Date()
    const dow = d.getDay()
    const diff = dow === 0 ? -6 : 1 - dow
    d.setDate(d.getDate() + diff)
    return d.toISOString().split('T')[0]
  })
  const [scheduling, setScheduling] = useState(false)

  function toggleNeeSinDiscCode(code: string) {
    setNeeSinDiscCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  // Override editable de horas/min/días (por planificación, defaults vienen del subject)
  const [editedWeeklyHours,   setEditedWeeklyHours]   = useState<number | null>(null)
  const [editedPeriodMinutes, setEditedPeriodMinutes] = useState<number | null>(null)
  const [editedDaysOfWeek,    setEditedDaysOfWeek]    = useState<number[] | null>(null)
  const [showHoursEditor,     setShowHoursEditor]     = useState(false)

  // Reset overrides al cambiar de materia
  useEffect(() => {
    setEditedWeeklyHours(null)
    setEditedPeriodMinutes(null)
    setEditedDaysOfWeek(null)
    setShowHoursEditor(false)
  }, [subjectId])

  // Derived
  const selectedSubject = subjects.find((s: any) => s.id === subjectId)
  const courseName  = selectedSubject?.course?.name || ''
  const courseLevel  = selectedSubject?.course?.level || ''
  const courseParallel = selectedSubject?.course?.parallel || ''
  const subjectWeeklyHours = selectedSubject?.weekly_hours ?? 4
  // Para institucional usa periodMinutes prop (de schedule_configs); para externos
  // viene en el propio subject.
  const subjectPeriodMinutes = selectedSubject?.period_minutes ?? periodMinutes ?? 45
  const isPlannerSoloSubject = !!selectedSubject?.is_planner_solo

  // Valores efectivos (override del docente o defaults guardados)
  const weeklyHours  = editedWeeklyHours   ?? subjectWeeklyHours
  const minutesHora  = editedPeriodMinutes ?? subjectPeriodMinutes
  const totalMinutes = weeklyHours * minutesHora
  const subjectDaysOfWeek: number[] | null = selectedSubject?.days_of_week ?? null
  const daysOfWeek: number[] = editedDaysOfWeek ?? subjectDaysOfWeek ?? []

  const subjectName = selectedSubject?.name || ''
  const gradeLabel  = `${courseName} ${courseParallel}`.trim()

  // ── Detección EFL / Lenguas extranjeras ────────────────────────────────
  const isEFL      = isEFLSubject(subjectName)
  const isLanguage = isLanguageSubject(subjectName)
  // Auto-sugerir CEFR cuando seleccionan una materia EFL y aún no eligieron nivel
  useEffect(() => {
    if (isEFL && !cefrLevel) {
      const sugg = suggestCEFRLevel(gradeLabel)
      if (sugg) setCefrLevel(sugg)
    }
    // Reset cuando cambia a una materia no-idioma
    if (!isLanguage && cefrLevel) {
      setCefrLevel('')
      setUnitNumber('')
      setUnitTotal('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, isEFL, isLanguage, gradeLabel])
  // Sin cap: la duración total es horas × min/hora (real, no Math.min)
  const classDuration =
    weeklyHours > 1
      ? `${totalMinutes} minutos (${weeklyHours} sesiones de ${minutesHora} min)`
      : `${minutesHora} minutos`

  // Unique subjects for dropdown (group by name + course)
  const subjectOptions = subjects.map((s: any) => ({
    id: s.id,
    label: `${s.name} — ${s.course?.name || ''} ${s.course?.parallel || ''}`.trim(),
    name: s.name,
    course: s.course,
  }))

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
          ? 'La generacion tardo demasiado y el servidor corto la respuesta (504). Prueba primero con el trimestre base y luego genera NEE/DIAC por separado.'
          : apiError
      )
    }

    if (!data) {
      throw new Error('La respuesta del servidor no vino en formato JSON valido.')
    }

    return data
  }

  async function handleGenerate() {
    if (!subjectId) return toast.error('Selecciona una materia')
    if (mode === 'clase' && !topic.trim()) return toast.error('Ingresa el tema de la clase')

    setLoading(true)
    setResult(null)
    setResults([])
    setVariants([])
    setActiveTab('regular')
    setDetectedPlanification(false)

    const finalNeeSinDisc = neeSinDiscEnabled ? neeSinDiscCodes : []
    const finalNeeConDisc = neeConDiscEnabled && neeConDiscCode ? neeConDiscCode : ''
    const shouldGenerateVariantsInline = !isExternalTrimesterMode
    if (shouldGenerateVariantsInline && neeSinDiscEnabled && finalNeeSinDisc.length === 0) {
      setLoading(false)
      return toast.error('Selecciona al menos una necesidad sin discapacidad o desactiva esa adaptacion')
    }
    if (shouldGenerateVariantsInline && neeConDiscEnabled && !finalNeeConDisc) {
      setLoading(false)
      return toast.error('Selecciona el tipo de discapacidad o desactiva el DIAC')
    }

    try {
      const payload = {
        type: mode,
        subject: subjectName,
        grade: gradeLabel,
        topic,
        duration: classDuration,
        methodology,
        methodologies: [methodology],
        extra,
        trimestre,
        parcial,
        semana,
        eje,
        inserciones,
        isEFL,
        cefrLevel: cefrLevel || null,
        unitNumber: unitNumber ? parseInt(unitNumber, 10) : null,
        unitTotal: unitTotal ? parseInt(unitTotal, 10) : null,
        cuadernillo,
        periodMinutes: minutesHora,
        weeklyHours,
        totalWeeklyMinutes: totalMinutes,
        daysOfWeek,
        persistHoursConfig:
          editedWeeklyHours !== null ||
          editedPeriodMinutes !== null ||
          editedDaysOfWeek !== null,
        isPlannerSoloSubject,
        teacherName,
        institutionName,
        subjectId,
        nee_sin_disc_codes: shouldGenerateVariantsInline ? finalNeeSinDisc : [],
        nee_con_disc_code: shouldGenerateVariantsInline ? finalNeeConDisc : '',
        diac_student_name: diacStudentName.trim(),
        diac_grado_real: diacGradoReal.trim(),
      }

      if (mode === 'parcial' || mode === 'abp') {
        if (isExternalTrimesterMode) {
          const trimestreBody = {
            ...payload,
            type: 'trimestre',
            parcial: null,
            semana: null,
            topic: topic || `Planificacion del Trimestre ${trimestre}`,
          }

          const res = await fetch('/api/planificaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trimestreBody),
          })
          const data = await readApiResponse(res)

          setResult(data.planificacion)
          setVariants(data.variants || [])
          setActiveTab('regular')
          setDetectedPlanification(!!data.detectedPlanification)
          toast.success('Planificacion trimestral generada')

          const rs = data.ragStats as { found: number; parsed: number; skipped: number; reasons: string[] } | undefined
          if (rs) {
            if (rs.found === 0) {
              toast('Sube tu PUD o materiales de apoyo para que la IA complete el trimestre con mas precision.', { duration: 7000 })
            } else if (rs.parsed === 0) {
              toast.error(`Encontre ${rs.found} material(es) pero no pude leer ninguno.\n${(rs.reasons || []).slice(0, 3).join('\n')}`, { duration: 10000 })
            } else if (rs.skipped > 0) {
              toast(`Use ${rs.parsed} de ${rs.found} materiales. ${rs.skipped} saltado(s):\n${(rs.reasons || []).slice(0, 3).join('\n')}`, { duration: 8000 })
            } else {
              toast.success(`Usando ${rs.parsed} material(es) de tu biblioteca como referencia`, { duration: 4000 })
            }
          }
        } else {
          const allResults: Planificacion[] = []
          let firstRagStats: any = null
          const useEflMiniUnits = isEFL && mode === 'parcial'
          const totalIters = useEflMiniUnits ? 3 : 6

          for (let i = 1; i <= totalIters; i++) {
            let iterBody: any
            if (useEflMiniUnits) {
              iterBody = {
                ...payload,
                type: 'unidad',
                unitNumber: i,
                unitTotal: 3,
                semana: null,
                topic: topic || `EFL Unit ${i}`,
                totalWeeklyMinutes: minutesHora * weeklyHours * 2,
              }
            } else {
              iterBody = {
                ...payload,
                type: 'clase',
                semana: i,
                topic: topic || (mode === 'abp' ? `Semana ${i} del Proyecto ABP` : `Semana ${i}`),
              }
            }
            const res = await fetch('/api/planificaciones', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(iterBody),
            })
            const data = await readApiResponse(res)
            allResults.push(data.planificacion)
            if (!firstRagStats && data.ragStats) firstRagStats = data.ragStats
          }

          setResults(allResults)
          toast.success(`${allResults.length} planificaciones generadas`)
          if (firstRagStats) {
            const rs = firstRagStats as { found: number; parsed: number; skipped: number; reasons: string[] }
            if (rs.found === 0) {
              toast('No hay materiales subidos para esta materia. La IA genero sin contexto bibliografico.', { icon: '??', duration: 7000 })
            } else if (rs.parsed === 0) {
              toast.error(`Encontre ${rs.found} material(es) pero no pude leer ninguno.\n${(rs.reasons || []).slice(0, 3).join('\n')}`, { duration: 10000 })
            } else if (rs.skipped > 0) {
              toast(`Use ${rs.parsed} de ${rs.found} materiales. ${rs.skipped} saltado(s):\n${(rs.reasons || []).slice(0, 3).join('\n')}`, { icon: '??', duration: 8000 })
            } else {
              toast.success(`Usando ${rs.parsed} material(es) de tu biblioteca como referencia`, { duration: 4000 })
            }
          }
        }
      } else {
        const res = await fetch('/api/planificaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await readApiResponse(res)
        setResult(data.planificacion)
        setVariants(data.variants || [])
        setActiveTab('regular')
        setDetectedPlanification(!!data.detectedPlanification)
        const variantCount = (data.variants || []).length
        toast.success(
          variantCount > 0
            ? `Planificacion generada con ${variantCount} adaptacion${variantCount > 1 ? 'es' : ''} NEE`
            : 'Planificacion generada y guardada'
        )
        if (data.detectedPlanification) {
          toast('Se detecto una planificacion en tus documentos y se adapto al formato institucional', { duration: 6000 })
        }
        if (data.truncated) {
          toast(
            `La planificacion se genero parcialmente (${data.sesionesGeneradas ?? '?'}/${data.sesionesEsperadas ?? '?'} sesiones). Edita o regenera con menos sesiones.`,
            { icon: '??', duration: 10000 }
          )
        } else if (
          typeof data.sesionesEsperadas === 'number' &&
          data.sesionesEsperadas > 1 &&
          typeof data.sesionesGeneradas === 'number' &&
          data.sesionesGeneradas < data.sesionesEsperadas
        ) {
          toast(
            `Se generaron ${data.sesionesGeneradas} de ${data.sesionesEsperadas} sesiones. Revisa el contenido.`,
            { icon: '??', duration: 8000 }
          )
        }
        const rs = data.ragStats as { found: number; parsed: number; skipped: number; reasons: string[] } | undefined
        if (rs) {
          if (rs.found === 0) {
            toast('No hay materiales subidos para esta materia. La IA genero sin contexto bibliografico.', { icon: '??', duration: 7000 })
          } else if (rs.parsed === 0) {
            toast.error(
              `Encontre ${rs.found} material(es) pero no pude leer ninguno.\n${(rs.reasons || []).slice(0, 3).join('\n')}` ,
              { duration: 10000 }
            )
          } else if (rs.skipped > 0) {
            toast(
              `Use ${rs.parsed} de ${rs.found} materiales. ${rs.skipped} saltado(s):\n${(rs.reasons || []).slice(0, 3).join('\n')}` ,
              { icon: '??', duration: 8000 }
            )
          } else {
            toast.success(`Usando ${rs.parsed} material(es) de tu biblioteca como referencia`, { duration: 4000 })
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Error al generar')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateVariant(kind: 'nee_sin_disc' | 'diac') {
    if (!result) return

    if (kind === 'nee_sin_disc') {
      if (!neeSinDiscEnabled || neeSinDiscCodes.length === 0) {
        return toast.error('Selecciona al menos una necesidad sin discapacidad para generar la adaptación.')
      }
    } else {
      if (!neeConDiscEnabled || !neeConDiscCode) {
        return toast.error('Selecciona el tipo de discapacidad para generar el DIAC.')
      }
    }

    setGeneratingVariant(kind)
    try {
      const res = await fetch('/api/planificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generate_only_variant: true,
          parent_planificacion_id: result.id,
          variant_kind: kind,
          nee_codes: kind === 'diac' ? [neeConDiscCode] : neeSinDiscCodes,
          diac_student_name: kind === 'diac' ? diacStudentName.trim() : '',
          diac_grado_real: kind === 'diac' ? diacGradoReal.trim() : '',
          subject: result.subject,
          grade: result.grade,
          topic: result.topic,
          duration: result.duration,
        }),
      })
      const data = await readApiResponse(res)

      const variant = data.variant as Planificacion
      setVariants(prev => {
        const filtered = prev.filter(v => (v as any).tipo_documento !== (variant as any).tipo_documento)
        return [...filtered, variant]
      })
      setActiveTab(kind)
      toast.success(kind === 'diac' ? 'DIAC generado' : 'Adaptación NEE generada')
    } catch (err: any) {
      toast.error(err.message ?? 'Error al generar la adaptación')
    } finally {
      setGeneratingVariant(null)
    }
  }


  function handleCopy(content: string) {
    navigator.clipboard.writeText(content)
    toast.success('Copiado al portapapeles')
  }

  async function handleAutoSchedule() {
    if (!result || !mondayStartDate) return
    setScheduling(true)
    const t = toast.loading('Agendando semana...')
    try {
      const res = await scheduleAdaptationWeek({
        planificacionId: result.id,
        mondayDate: mondayStartDate
      })
      if (res.ok) {
        toast.success('¡Semana programada en el calendario!', { id: t })
      } else {
        toast.error(res.error || 'Error al agendar', { id: t })
      }
    } catch (err: any) {
      toast.error(err.message, { id: t })
    } finally {
      setScheduling(false)
    }
  }

  const isExternalTrimesterMode = isPlannerSoloTeacher && mode === 'parcial'
  const showSemana           = mode === 'clase'
  const showTopic            = mode === 'clase' || mode === 'rubrica' || isExternalTrimesterMode
  const showTrimestreParcial = mode !== 'adaptacion' && mode !== 'diagnostica'
  const showParcialSelector  = showTrimestreParcial && !isExternalTrimesterMode
  const periodoGridCols = showSemana
    ? (showParcialSelector ? 'grid-cols-3' : 'grid-cols-2')
    : (showParcialSelector ? 'grid-cols-2' : 'grid-cols-1')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
      {/* ── FORM PANEL ── */}
      <div className="bg-surface rounded-2xl border border-surface2 p-6 lg:sticky lg:top-24 space-y-5">
        <h2 className="font-display text-base font-bold tracking-tight flex items-center gap-2">
          <Sparkles size={18} style={{ color: '#7C6DFA' }} />
          Configurar planificacion
        </h2>

        {/* Mode selector */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-ink3 mb-2">Tipo de generacion</label>
          <div className="grid grid-cols-2 gap-2">
            {generationModes.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all text-left ${
                    mode === m.id
                      ? 'text-white shadow-md border-transparent'
                      : 'bg-bg border-surface2 text-ink3 hover:border-ink4'
                  }`}
                  style={mode === m.id ? { backgroundColor: '#7C6DFA' } : {}}
                >
                  <Icon size={14} />
                  <div>
                    <div className="font-semibold">{m.label}</div>
                    <div className={`text-[10px] ${mode === m.id ? 'text-white/70' : 'text-ink4'}`}>{m.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Subject selector — from teacher's real data */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-ink3 mb-1.5">
            <GraduationCap size={12} className="inline mr-1" />
            Materia y Curso
          </label>
          <select
            value={subjectId}
            onChange={e => setSubjectId(e.target.value)}
            className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
          >
            <option value="">Seleccionar...</option>
            {subjectOptions.map((s: any) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {selectedSubject && (
            <div className="mt-2">
              {!showHoursEditor ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface2 text-ink3">
                    <Clock size={10} className="inline mr-0.5" /> {weeklyHours} h/sem
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface2 text-ink3">
                    {minutesHora} min/hora
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet/10 text-violet">
                    Total semanal: {totalMinutes} min
                  </span>
                  {daysOfWeek.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface2 text-ink3">
                      {daysOfWeek.map(d => ['L','M','X','J','V','S','D'][d-1]).join(' ')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowHoursEditor(true)}
                    className="text-[10px] font-semibold text-violet underline ml-1"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-violet/30 bg-violet/5 p-2 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-violet">
                    Configurar carga semanal
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="block text-[10px] text-ink3 mb-0.5">Horas / semana</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={weeklyHours}
                        onChange={e =>
                          setEditedWeeklyHours(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                        }
                        className="w-full bg-white border border-surface2 rounded-md px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[10px] text-ink3 mb-0.5">Min / hora pedagógica</span>
                      <select
                        value={minutesHora}
                        onChange={e => setEditedPeriodMinutes(Number(e.target.value))}
                        className="w-full bg-white border border-surface2 rounded-md px-2 py-1 text-xs"
                      >
                        <option value={40}>40 min</option>
                        <option value={45}>45 min</option>
                        <option value={50}>50 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </label>
                  </div>
                  <div className="text-[10px] text-ink3">
                    Total semanal: <strong>{totalMinutes} min</strong> ({weeklyHours} sesiones de {minutesHora} min)
                  </div>

                  {/* ── Días de la semana ────────────────────────────────────────────── */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-violet mb-1">
                      Días que dictas esta materia
                    </div>
                    <div className="flex gap-1">
                      {[
                        { v: 1, l: 'L' },
                        { v: 2, l: 'M' },
                        { v: 3, l: 'X' },
                        { v: 4, l: 'J' },
                        { v: 5, l: 'V' },
                        { v: 6, l: 'S' },
                        { v: 7, l: 'D' },
                      ].map(d => {
                        const active = daysOfWeek.includes(d.v)
                        return (
                          <button
                            key={d.v}
                            type="button"
                            onClick={() => {
                              const current = daysOfWeek
                              const next = active
                                ? current.filter(x => x !== d.v)
                                : [...current, d.v].sort()
                              setEditedDaysOfWeek(next)
                            }}
                            className={`flex-1 text-xs font-bold py-1 rounded-md border transition-all ${
                              active
                                ? 'bg-violet text-white border-violet'
                                : 'bg-white text-ink3 border-surface2 hover:border-violet/50'
                            }`}
                          >
                            {d.l}
                          </button>
                        )
                      })}
                    </div>
                    {daysOfWeek.length > 0 && daysOfWeek.length !== weeklyHours && (
                      <div className="text-[9px] text-amber mt-1">
                        ⚠ Marcaste {daysOfWeek.length} día{daysOfWeek.length > 1 ? 's' : ''} pero la materia tiene {weeklyHours} sesión{weeklyHours > 1 ? 'es' : ''}/semana.
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setEditedWeeklyHours(null)
                        setEditedPeriodMinutes(null)
                        setEditedDaysOfWeek(null)
                        setShowHoursEditor(false)
                      }}
                      className="text-[10px] font-semibold text-ink3 underline"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHoursEditor(false)}
                      className="px-2 py-1 rounded-md text-[10px] font-bold bg-violet text-white"
                    >
                      Aplicar
                    </button>
                  </div>
                  <div className="text-[9px] text-ink3 italic leading-tight">
                    Se guardará como predeterminado para esta materia.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Banner: Semana de Adaptación → curso anterior diagnosticado */}
        {mode === 'adaptacion' && gradeLabel && (
          <div className="rounded-xl border border-amber/30 bg-amber/5 p-3">
            <div className="flex items-start gap-2">
              <div className="text-base leading-none">📚</div>
              <div className="flex-1 text-xs">
                <div className="font-bold text-ink mb-0.5">Diagnóstico del curso anterior</div>
                <div className="text-ink3 leading-snug">
                  Esta planificación NO genera contenido nuevo de <strong>{gradeLabel}</strong>.
                  Hace un diagnóstico de las DCDs clave de{' '}
                  <strong className="text-amber-700">{getPreviousLevel(gradeLabel).label}</strong>{' '}
                  para nivelar a los estudiantes antes de avanzar.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trimestre + Parcial + Semana */}
        {showTrimestreParcial && (
          <div className={`grid ${periodoGridCols} gap-2`}>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1">Trimestre</label>
              <select
                value={trimestre}
                onChange={e => setTrimestre(Number(e.target.value))}
                className="w-full bg-bg border border-surface2 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-violet/50"
              >
                {TRIMESTRES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {showParcialSelector && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1">Parcial</label>
                <select
                  value={parcial}
                  onChange={e => setParcial(Number(e.target.value))}
                  className="w-full bg-bg border border-surface2 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-violet/50"
                >
                  {Array.from({ length: parcialesCount }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Parcial {i + 1} (Unidad)</option>
                  ))}
                </select>
              </div>
            )}
            {showSemana && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1">Semana</label>
                <select
                  value={semana}
                  onChange={e => setSemana(Number(e.target.value))}
                  className="w-full bg-bg border border-surface2 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-violet/50"
                >
                  {SEMANAS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* ── Bloque EFL / Lengua Extranjera ──────────────────────────── */}
        {isLanguage && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <div className="text-base leading-none">🌐</div>
              <div className="text-[11px] text-cyan-900 leading-snug">
                <strong>Modo Lengua Extranjera (CEFR):</strong> la IA estructurará
                el documento por las 5 destrezas comunicativas MinEduc EFL
                (Communication, Oral, Reading, Writing, Language through the Arts)
                con DCDs específicas <code className="text-[10px]">EFL.x.x.x</code>.
                {mode === 'parcial' && (
                  <div className="mt-1.5 pt-1.5 border-t border-cyan-200">
                    <strong>Parcial EFL:</strong> en vez de 6 clases semanales,
                    se generan <strong>3 mini-units de ~2 semanas</strong> cada
                    una (más coherente con CEFR).
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Nivel CEFR */}
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-cyan-900 mb-1">
                  Nivel CEFR
                </label>
                <select
                  value={cefrLevel}
                  onChange={e => setCefrLevel(e.target.value as CEFRLevel | '')}
                  className="w-full bg-white border border-cyan-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="">— Selecciona nivel —</option>
                  {CEFR_LEVELS.map(l => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* Unit number / total */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-cyan-900 mb-1">
                  Unit #
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  placeholder="Ej. 3"
                  value={unitNumber}
                  onChange={e => setUnitNumber(e.target.value)}
                  className="w-full bg-white border border-cyan-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-cyan-900 mb-1">
                  Total units
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  placeholder="Ej. 12"
                  value={unitTotal}
                  onChange={e => setUnitTotal(e.target.value)}
                  className="w-full bg-white border border-cyan-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-end">
                <div className="text-[10px] text-cyan-800 italic leading-tight">
                  {unitNumber && unitTotal
                    ? `Generando: Unit ${unitNumber} of ${unitTotal}`
                    : 'Opcional — ayuda a la IA a calibrar progresión'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inserciones curriculares MinEduc 2025-2026 */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1.5">
            Inserciones curriculares
          </label>
          <p className="text-[10px] text-ink4 mb-2 leading-snug">
            Selecciona las que se integren naturalmente al tema. La IA las distribuirá <strong>dentro</strong> de las DCDs (no en sección aparte).
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {INSERCIONES.map(i => {
              const active = inserciones.includes(i.id)
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() =>
                    setInserciones(prev =>
                      prev.includes(i.id)
                        ? prev.filter(x => x !== i.id)
                        : [...prev, i.id]
                    )
                  }
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold border transition-all ${
                    active
                      ? `${i.bg} ${i.border} ${i.text}`
                      : 'bg-bg border-surface2 text-ink3 hover:border-ink4'
                  }`}
                  title={i.description}
                >
                  <span className="text-base leading-none">{i.emoji}</span>
                  <span className="flex-1 text-left">{i.label}</span>
                  {active && <span className="text-[14px] leading-none">✓</span>}
                </button>
              )
            })}
          </div>
          {inserciones.length === 0 && (
            <p className="text-[10px] text-amber-600 mt-1.5 italic">
              ⚠ No has seleccionado inserciones — la IA generará la planificación sin integrarlas.
            </p>
          )}
        </div>

        {/* Estrategia metodológica */}
        {(mode === 'clase' || mode === 'parcial') && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1.5">
              Estrategia metodológica
            </label>
            <select
              value={methodology}
              onChange={e => setMethodology(e.target.value)}
              className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
            >
              {METHODOLOGIES.map(m => (
                <option key={m.code} value={m.code}>
                  {m.name} — {m.description}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-ink4 mt-1">
              Define las fases de las actividades en la clase.
            </p>
          </div>
        )}

        {/* Topic */}
        {showTopic && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1.5">
              {mode === 'clase' ? 'Tema / Destreza de la clase' : 'Tema / Actividad a evaluar'}
            </label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder={mode === 'clase' ? 'Ej: La celula eucariota y sus organulos' : 'Ej: Proyecto de investigacion'}
              className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
            />
          </div>
        )}

        {/* Cuadernillo reference */}
        {(mode === 'clase' || mode === 'parcial') && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1.5">
              Ref. Cuadernillo de Trabajo (opcional)
            </label>
            <input
              value={cuadernillo}
              onChange={e => setCuadernillo(e.target.value)}
              placeholder="Ej: Pagina 45-48, Ejercicios 1 al 5"
              className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
            />
          </div>
        )}

        {/* Extra notes */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1.5">Notas adicionales (opcional)</label>
          <textarea
            value={extra}
            onChange={e => setExtra(e.target.value)}
            placeholder="Contexto especial, NEE del grupo, recursos disponibles..."
            className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50 resize-none h-16"
          />
        </div>

        {/* ── NEE: Adaptación no significativa (sin discapacidad) ── */}
        {(mode === 'clase' || (mode === 'parcial' && !isExternalTrimesterMode)) && (
          <div className="rounded-xl border border-surface2 bg-bg p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={neeSinDiscEnabled}
                onChange={e => setNeeSinDiscEnabled(e.target.checked)}
                className="accent-violet-600"
              />
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink2">
                Generar adaptación NEE (sin discapacidad)
              </span>
            </label>
            <p className="text-[10px] text-ink4 -mt-1 pl-6">
              Adaptación no significativa: mismos objetivos, diferente metodología.
            </p>
            {neeSinDiscEnabled && (
              <div className="grid grid-cols-1 gap-1 pl-6">
                {NEE_SIN_DISCAPACIDAD.map(n => (
                  <label key={n.code} className="flex items-start gap-2 text-[11px] text-ink2 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={neeSinDiscCodes.includes(n.code)}
                      onChange={() => toggleNeeSinDiscCode(n.code)}
                      className="accent-violet-600 mt-0.5"
                    />
                    <span>{n.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── NEE: DIAC (con discapacidad) ── */}
        {(mode === 'clase' || (mode === 'parcial' && !isExternalTrimesterMode)) && (
          <div className="rounded-xl border border-surface2 bg-bg p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={neeConDiscEnabled}
                onChange={e => setNeeConDiscEnabled(e.target.checked)}
                className="accent-teal-600"
              />
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink2">
                Generar DIAC (con discapacidad)
              </span>
            </label>
            <p className="text-[10px] text-ink4 -mt-1 pl-6">
              Adaptación significativa: objetivos individualizados al nivel real.
            </p>
            {neeConDiscEnabled && (
              <div className="pl-6 space-y-2">
                <select
                  value={neeConDiscCode}
                  onChange={e => setNeeConDiscCode(e.target.value)}
                  className="w-full bg-surface border border-surface2 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-teal-500/50"
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
                  className="w-full bg-surface border border-surface2 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-teal-500/50"
                />
                <input
                  value={diacGradoReal}
                  onChange={e => setDiacGradoReal(e.target.value)}
                  placeholder="Grado curricular real (ej: 2do EGB)"
                  className="w-full bg-surface border border-surface2 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-teal-500/50"
                />
              </div>
            )}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: '#7C6DFA' }}
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {isExternalTrimesterMode
                ? 'Generando trimestre...'
                : mode === 'parcial' && isEFL
                  ? 'Generando 3 EFL mini-units...'
                  : mode === 'parcial' || mode === 'abp'
                    ? 'Generando 6 semanas...'
                    : 'Generando...'}
            </>
          ) : (
            <>
              <Sparkles size={16} />
              {isExternalTrimesterMode
                ? 'Generar trimestre con IA'
                : mode === 'parcial' && isEFL
                  ? 'Generar parcial (3 EFL units)'
                  : mode === 'parcial' || mode === 'abp'
                    ? 'Generar proyecto / parcial'
                    : 'Generar con IA'}
            </>
          )}
        </button>

        {(mode === 'parcial' || mode === 'abp') && (
          <p className="text-[10px] text-ink4 text-center">
            {isExternalTrimesterMode
              ? 'Primero se generara la planificacion trimestral base. Luego podras sacar NEE o DIAC por separado desde el resultado.'
              : 'Se generaran 6 planificaciones (1 por semana del proyecto/parcial)'}
          </p>
        )}
      </div>

      {/* ── RESULT PANEL ── */}
      <div className="bg-surface rounded-2xl border border-surface2 overflow-hidden min-h-[480px] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface2">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink2">
            {(result || results.length > 0) && <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#10b981' }} />}
            {result ? result.title : results.length > 0 ? `Parcial T${trimestre}-P${parcial} — ${subjectName}` : 'Resultado'}
          </div>
          {result && (
            <div className="flex gap-2">
              <button onClick={() => handleCopy(result.content)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface2 text-xs font-medium text-ink3 hover:bg-surface2 transition-colors">
                <Copy size={12} /> Copiar
              </button>
              <button
                onClick={() => router.push(`/dashboard/historial/${result.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                style={{ backgroundColor: '#7C6DFA' }}
              >
                <ExternalLink size={12} /> Ver completo
              </button>
            </div>
          )}
        </div>

        {/* ── Auto-Scheduling Banner (Special for Adaptation) ── */}
        {result && (result.type === 'adaptacion' || result.type === 'diagnostica') && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-violet/5 border border-violet/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet text-white flex items-center justify-center shadow-sm">
                <CalendarDays size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Agendar esta semana</p>
                <p className="text-xs text-ink3">Registra automáticamente las sesiones en el calendario.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-ink4 uppercase">Lunes de inicio</span>
                <input
                  type="date"
                  value={mondayStartDate}
                  onChange={e => setMondayStartDate(e.target.value)}
                  className="bg-white border border-surface2 rounded-lg px-2 py-1 text-xs"
                />
              </div>
              <button
                onClick={handleAutoSchedule}
                disabled={scheduling}
                className="btn-primary h-9 px-4 text-xs flex items-center gap-2"
                style={{ backgroundColor: '#7C6DFA' }}
              >
                {scheduling ? 'Agendando...' : 'Programar semana'}
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-3 border-surface2 rounded-full mx-auto relative" style={{ borderTopColor: '#7C6DFA', animation: 'spin 1s linear infinite' }} />
              <div>
                <p className="text-sm font-medium text-ink2">Generando planificacion MINEDUC...</p>
                <p className="text-xs text-ink4 mt-1">Formato {methodology} con tiempos calculados</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !result && results.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-ink3">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(124,109,250,0.08)' }}>
              <ClipboardList size={28} style={{ color: '#7C6DFA' }} />
            </div>
            <p className="text-base font-medium mb-1">Tu planificacion aparecera aqui</p>
            <p className="text-sm text-ink4">
              {isExternalTrimesterMode
                ? 'Selecciona materia y trimestre. La IA adaptara tu PUD al formato oficial con competencias e inserciones curriculares.'
                : <>Selecciona materia, trimestre y tema, luego presiona <strong className="text-ink2">Generar con IA</strong></>}
            </p>
          </div>
        )}

        {/* Tabs (solo si hay variantes NEE) */}
        {result && isExternalTrimesterMode && (
          <div className="mx-6 mt-4 rounded-xl border border-surface2 bg-bg p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-ink2">Adaptaciones sobre esta planificación base</p>
              <p className="text-xs text-ink4 mt-1">
                Genera NEE o DIAC como segundo paso para evitar cortes o timeouts en el trimestre completo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleGenerateVariant('nee_sin_disc')}
                disabled={generatingVariant !== null || !neeSinDiscEnabled || neeSinDiscCodes.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#7C6DFA' }}
              >
                {generatingVariant === 'nee_sin_disc' ? 'Generando NEE...' : 'Generar adaptación NEE'}
              </button>
              <button
                onClick={() => handleGenerateVariant('diac')}
                disabled={generatingVariant !== null || !neeConDiscEnabled || !neeConDiscCode}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#0f766e' }}
              >
                {generatingVariant === 'diac' ? 'Generando DIAC...' : 'Generar DIAC'}
              </button>
            </div>
          </div>
        )}

        {result && variants.length > 0 && (
          <div className="flex gap-1 px-6 pt-3 border-b border-surface2 bg-bg">
            {([
              { id: 'regular' as const,       label: '📄 Regular',        show: true },
              { id: 'nee_sin_disc' as const,  label: '♿ NEE s/disc',      show: variants.some(v => (v as any).tipo_documento === 'nee_sin_disc') },
              { id: 'diac' as const,          label: '🧩 DIAC',           show: variants.some(v => (v as any).tipo_documento === 'diac') },
            ]).filter(t => t.show).map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                  activeTab === t.id
                    ? 'text-violet2 border-violet2 bg-surface'
                    : 'text-ink3 border-transparent hover:text-ink2'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Single result (regular o variant activa) */}
        {result && (() => {
          const active =
            activeTab === 'regular'
              ? result
              : variants.find(v => (v as any).tipo_documento === activeTab) || result
          return (
            <div className="flex-1 p-6 overflow-y-auto">
              <pre className="text-sm text-ink2 whitespace-pre-wrap leading-relaxed font-body">
                {active.content}
              </pre>
            </div>
          )
        })()}

        {/* Parcial results — multiple weeks */}
        {results.length > 0 && (
          <div className="flex-1 overflow-y-auto divide-y divide-surface2">
            {results.map((r, idx) => (
              <div key={r.id} className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-bold text-sm" style={{ color: '#7C6DFA' }}>
                    Semana {idx + 1}{idx === 5 ? ' (Aporte)' : ''}
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={() => handleCopy(r.content)} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-surface2 text-[11px] text-ink3 hover:bg-surface2">
                      <Copy size={10} /> Copiar
                    </button>
                    <button onClick={() => router.push(`/dashboard/historial/${r.id}`)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-white" style={{ backgroundColor: '#7C6DFA' }}>
                      <ExternalLink size={10} /> Ver
                    </button>
                  </div>
                </div>
                <pre className="text-xs text-ink2 whitespace-pre-wrap leading-relaxed font-body">
                  {r.content}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
