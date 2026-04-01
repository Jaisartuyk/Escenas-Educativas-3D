// src/app/landing/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { FeatureCard } from '@/components/ui/FeatureCard'
import { PlanCard } from '@/components/ui/PlanCard'

export const metadata: Metadata = { title: 'Inicio' }

const FEATURES = [
  { icon: '📋', title: 'Planificaciones automáticas', bg: 'violet',
    desc: 'Genera planificaciones de clase, unidades didácticas y rúbricas alineadas al currículo MINEDUC en segundos.' },
  { icon: '🔬', title: 'Escenas 3D interactivas', bg: 'rose',
    desc: 'Célula eucariota, sistema solar, ADN y más en 3D animado. Los estudiantes aprenden rotando modelos reales.' },
  { icon: '⚡', title: 'IA especializada en educación', bg: 'teal',
    desc: 'Prompts optimizados con destrezas, indicadores y metodologías activas para secundaria y bachillerato.' },
  { icon: '📂', title: 'Biblioteca de planificaciones', bg: 'amber',
    desc: 'Guarda, organiza y reutiliza todo. Exporta a Word o PDF en un clic.' },
  { icon: '🎯', title: 'Rúbricas de evaluación', bg: 'violet',
    desc: 'Descriptores por nivel de desempeño listos para imprimir y compartir con estudiantes.' },
  { icon: '🌐', title: 'Multimateria y multinivel', bg: 'teal',
    desc: 'Compatible con todas las asignaturas de 8° EGB a 3° BGU.' },
]

const PLANS = [
  {
    name: 'Starter', price: '$0', period: 'Para siempre gratis',
    desc: 'Para empezar sin compromisos', featured: false,
    features: ['10 planificaciones/mes', '3 escenas 3D', 'Exportar como texto', 'Historial 30 días'],
    cta: 'Empezar gratis', href: '/auth/register',
  },
  {
    name: 'Pro', price: '$9', period: 'Facturado anual — $7/mes',
    desc: 'Para docentes comprometidos', featured: true,
    features: ['Planificaciones ilimitadas', 'Todas las escenas 3D', 'Exportar Word y PDF', 'Historial completo', 'Soporte prioritario', 'Nuevas funciones primero'],
    cta: 'Empezar Pro', href: '/auth/register?plan=pro',
  },
  {
    name: 'Institución', price: '$49', period: 'Hasta 20 docentes',
    desc: 'Para colegios y unidades educativas', featured: false,
    features: ['Todo de Pro', 'Panel de administración', 'Biblioteca compartida', 'Capacitación incluida', 'SLA garantizado'],
    cta: 'Contactar ventas', href: 'mailto:hola@eduplan3d.io',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-12 h-16 bg-bg/70 backdrop-blur-xl border-b border-[rgba(120,100,255,0.14)]">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="#features" className="btn-ghost">Características</Link>
          <Link href="#planes"   className="btn-ghost">Planes</Link>
          <Link href="/auth/login"    className="btn-ghost">Iniciar sesión</Link>
          <Link href="/auth/register" className="btn-primary text-sm px-5 py-2">
            Empezar gratis →
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-32 text-center relative overflow-hidden">
        <div className="absolute w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(124,109,250,0.18)_0%,transparent_70%)] -top-24 left-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(240,98,146,0.10)_0%,transparent_70%)] bottom-0 right-[10%] pointer-events-none" />

        <div className="animate-fade-up flex items-center gap-2 px-4 py-1.5 rounded-full bg-[rgba(124,109,250,0.12)] border border-[rgba(124,109,250,0.3)] text-violet2 text-xs font-bold tracking-wide mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-teal animate-[pulse-dot_2s_infinite]" />
          Nuevo — Escenas 3D con IA generativa
        </div>

        <h1 className="animate-fade-up [animation-delay:100ms] font-display font-extrabold text-[clamp(40px,6vw,76px)] leading-[1.06] tracking-[-2px] max-w-4xl mb-6">
          Planificaciones docentes<br />
          <span className="gradient-text">inteligentes y en 3D</span>
        </h1>

        <p className="animate-fade-up [animation-delay:200ms] text-lg text-ink2 max-w-xl leading-relaxed mb-12 font-normal">
          La plataforma SaaS para docentes de secundaria y bachillerato que genera planificaciones, unidades didácticas y escenarios 3D interactivos en segundos.
        </p>

        <div className="animate-fade-up [animation-delay:300ms] flex gap-3 flex-wrap justify-center">
          <Link href="/auth/register" className="btn-primary px-9 py-4 text-base">
            Comenzar gratis — sin tarjeta
          </Link>
          <Link href="/auth/login" className="btn-secondary px-8 py-4 text-base">
            Ver demo en vivo
          </Link>
        </div>

        <div className="animate-fade-up [animation-delay:500ms] flex gap-12 mt-20">
          {[['2.4k+','Docentes activos'],['18k+','Planificaciones generadas'],['94%','Satisfacción'],['6','Escenas 3D']].map(([n, l]) => (
            <div key={l} className="text-center">
              <div className="font-display text-[32px] font-extrabold tracking-[-1px] gradient-text">{n}</div>
              <div className="text-xs text-ink3 mt-1 font-medium tracking-wide uppercase">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-28 px-12 max-w-6xl mx-auto w-full">
        <p className="text-center text-[11px] font-bold uppercase tracking-[2px] text-violet2 mb-4">Funcionalidades</p>
        <h2 className="font-display text-[clamp(28px,4vw,44px)] font-extrabold text-center tracking-[-1.5px] leading-[1.1] mb-16">
          Todo lo que un docente<br />necesita en un solo lugar
        </h2>
        <div className="grid grid-cols-3 gap-5">
          {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* ── PLANS ── */}
      <section id="planes" className="py-24 px-12 max-w-5xl mx-auto w-full">
        <p className="text-center text-[11px] font-bold uppercase tracking-[2px] text-violet2 mb-4">Precios</p>
        <h2 className="font-display text-[clamp(28px,4vw,44px)] font-extrabold text-center tracking-[-1.5px] leading-[1.1] mb-16">
          Un plan para cada docente
        </h2>
        <div className="grid grid-cols-3 gap-5">
          {PLANS.map(p => <PlanCard key={p.name} {...p} />)}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[rgba(120,100,255,0.14)] px-12 py-8 flex items-center justify-between text-ink3 text-sm">
        <Logo size="sm" />
        <span>© 2025 EduPlan 3D — Hecho para docentes ecuatorianos 🇪🇨</span>
        <div className="flex gap-6">
          <Link href="/legal/privacidad" className="hover:text-ink transition-colors">Privacidad</Link>
          <Link href="/legal/terminos"   className="hover:text-ink transition-colors">Términos</Link>
        </div>
      </footer>
    </div>
  )
}
