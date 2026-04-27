// src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import nextDynamic from 'next/dynamic'
import { AcademicYearProvider } from '@/lib/context/AcademicYearContext'
import { ReadOnlyYearBanner } from '@/components/layout/ReadOnlyYearBanner'
import { VIEWING_YEAR_COOKIE } from '@/types/academic-year'
import type { AcademicYear } from '@/types/academic-year'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

const Sidebar = nextDynamic(() => import('@/components/layout/Sidebar').then(m => m.Sidebar), { ssr: false })
const Topbar = nextDynamic(() => import('@/components/layout/Topbar').then(m => m.Topbar), { ssr: false })
const OnboardingModal = nextDynamic(() => import('@/components/onboarding/OnboardingModal').then(mod => mod.OnboardingModal), { ssr: false })
const FloatingAura = nextDynamic(() => import('@/components/aura/FloatingAura').then(m => m.FloatingAura), { ssr: false })

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, institution_id, plan, email, role, planner_ia_enabled')
    .eq('id', user!.id)
    .single()

  const isPlannerSolo     = profile?.plan === 'planner_solo'
  const isMissingInstitution = !profile?.institution_id && !isPlannerSolo
  const isHorariosOnly = profile?.role === 'horarios_only'

  // ── Fetch Institution Data ──────────────────────────────────────────────────
  let institution = null
  if (profile?.institution_id) {
    const { data } = await (supabase as any)
      .from('institutions')
      .select('name, settings, planner_ia_enabled')
      .eq('id', profile.institution_id)
      .single()
    institution = data
  }

  // Regla efectiva: el docente institucional ve Planificador IA y Biblioteca
  // solo si su institución contrató el servicio Y el SuperAdmin lo habilitó
  // a él específicamente. Los planner_solo (externos) siempre tienen acceso.
  const plannerIaAccess = isPlannerSolo
    ? true
    : !!(institution?.planner_ia_enabled && profile?.planner_ia_enabled)

  // ── Fetch Academic Years (solo si tiene institución) ────────────────────────
  let academicYears: AcademicYear[] = []
  let currentYearId: string | null  = null
  let viewingYearId: string | null  = null

  if (profile?.institution_id) {
    const admin = createAdminClient()
    const { data: yearsData } = await (admin as any)
      .from('academic_years')
      .select('*')
      .eq('institution_id', profile.institution_id)
      .order('label', { ascending: false })

    academicYears = (yearsData || []) as AcademicYear[]
    const current = academicYears.find(y => y.is_current)
    currentYearId = current?.id || null

    // Resolver año que el usuario está viendo desde cookie
    const cookieStore = cookies()
    const cookieVal = cookieStore.get(VIEWING_YEAR_COOKIE)?.value
    if (cookieVal && academicYears.some(y => y.id === cookieVal)) {
      viewingYearId = cookieVal
    } else {
      viewingYearId = currentYearId
    }
  }

  // Logo logic: if name matches our known asset, use it
  const logoUrl = institution?.name?.includes('LETAMENDI') ? '/icon/logo-institucion.png' : null

  return (
    <AcademicYearProvider
      initialYears={academicYears}
      initialCurrentId={currentYearId}
      initialViewingId={viewingYearId}
    >
      <div className="min-h-screen flex bg-bg relative">
        {isMissingInstitution && <OnboardingModal profileName={profile?.full_name || 'Usuario'} />}
        <Sidebar
          role={isHorariosOnly ? 'horarios_only' : profile?.role}
          plan={profile?.plan}
          institutionName={isPlannerSolo ? undefined : institution?.name}
          logoUrl={isPlannerSolo ? null : logoUrl}
          plannerIaAccess={plannerIaAccess}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar profile={profile} institutionName={institution?.name} />
          <ReadOnlyYearBanner />
          <main className="flex-1 p-4 pt-16 lg:p-8 lg:pt-8 max-w-[1200px] w-full mx-auto">
            {children}
          </main>
        </div>
        {/* Aura — copiloto pedagógico flotante (oculto para horarios_only y estudiantes) */}
        {profile?.role !== 'horarios_only' && profile?.role !== 'student' && profile?.role !== 'parent' && (
          <FloatingAura />
        )}
      </div>
    </AcademicYearProvider>
  )
}
