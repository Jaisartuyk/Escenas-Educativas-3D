import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'ClassNova Planificador — IA para docentes ecuatorianos',
  description: 'Genera planificaciones diarias, PUDs y planes anuales alineados al currículo MINEDUC en segundos con inteligencia artificial.',
}

const features = [
  { icon: '🤖', title: 'Generado por IA', desc: 'Planes de clase completos en segundos, con estructura ERCA y adaptaciones NEE incluidas.' },
  { icon: '📋', title: 'Formato MINEDUC', desc: 'Cumple exactamente con los estándares del Ministerio de Educación del Ecuador.' },
  { icon: '📚', title: 'Tu propio material', desc: 'Sube tus libros y el planificador los usa como referencia para cada actividad.' },
  { icon: '📅', title: 'Todos los tipos', desc: 'Plan Curricular Anual, PUD, plan semanal, plan diario y rúbricas de evaluación.' },
  { icon: '🗂️', title: 'Historial completo', desc: 'Todas tus planificaciones guardadas y organizadas por trimestre y parcial.' },
  { icon: '⚡', title: 'Sin institución', desc: 'No necesitas pertenecer a ningún colegio. Tu cuenta es tuya, completamente independiente.' },
]

const plans = [
  {
    name: 'Gratis',
    price: '$0',
    period: 'para siempre',
    color: 'border-[rgba(0,0,0,0.08)]',
    badge: '',
    features: [
      '5 planificaciones por mes',
      'Plan diario y semanal',
      'Historial de 30 días',
      'Exportar como texto',
    ],
    cta: 'Empezar gratis',
    ctaStyle: 'border border-violet2 text-violet2 hover:bg-violet2/5',
    href: '/planificador/registro',
  },
  {
    name: 'Pro',
    price: '$4.99',
    period: 'por mes',
    color: 'border-violet2/40 shadow-lg shadow-violet/10',
    badge: 'Más popular',
    features: [
      'Planificaciones ilimitadas',
      'Todos los tipos (PCA, PUD, diario)',
      'Biblioteca de documentos PDF',
      'Historial completo',
      'Exportar en Word / PDF',
      'Soporte prioritario',
    ],
    cta: 'Empezar Pro',
    ctaStyle: 'bg-violet2 text-white hover:bg-violet shadow-md',
    href: '/planificador/registro?plan=pro',
  },
]

export default function PlanificadorLandingPage() {
  return (
    <div className="min-h-screen bg-[#0d0d14] text-white">
      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧠</span>
          <span className="font-bold text-lg tracking-tight">ClassNova <span className="text-violet-400">Planificador</span></span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm text-white/60 hover:text-white transition-colors">
            Iniciar sesión
          </Link>
          <Link
            href="/planificador/registro"
            className="px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-400 transition-colors"
          >
            Registrarse gratis
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold mb-6">
          ✨ Powered by Claude AI — Especializado en MINEDUC Ecuador
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
          Planifica tus clases{' '}
          <span className="bg-gradient-to-r from-violet-400 to-teal-400 bg-clip-text text-transparent">
            con IA en segundos
          </span>
        </h1>
        <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
          Genera planes de clase, PUDs y planes anuales alineados al currículo ecuatoriano.
          Sin institución, sin complicaciones — solo tú y tus planificaciones.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/planificador/registro"
            className="px-8 py-4 rounded-2xl bg-violet-500 text-white font-bold text-base hover:bg-violet-400 transition-all hover:scale-[1.02] shadow-lg shadow-violet-500/25"
          >
            Empezar gratis — sin tarjeta
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-4 rounded-2xl border border-white/10 text-white/70 font-semibold text-base hover:border-white/30 hover:text-white transition-all"
          >
            Ya tengo cuenta →
          </Link>
        </div>
        <p className="text-xs text-white/30 mt-4">5 planificaciones gratis por mes. Sin compromisos.</p>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-10 text-white/90">
          Todo lo que necesitas para planificar mejor
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(f => (
            <div key={f.title} className="p-6 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-colors">
              <span className="text-3xl block mb-3">{f.icon}</span>
              <h3 className="font-bold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo preview ───────────────────────────────────────────── */}
      <section className="px-6 py-10 max-w-4xl mx-auto text-center">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-violet-500/10 to-teal-500/10 border border-violet-500/20">
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">Ejemplo de resultado</p>
          <div className="text-left bg-[#0d0d14] rounded-2xl p-5 text-sm text-white/70 leading-relaxed font-mono">
            <p className="text-violet-400 font-bold mb-2">📋 Plan de Clase — Matemáticas · 8vo EGB</p>
            <p><span className="text-teal-400">Tema:</span> Fracciones equivalentes</p>
            <p><span className="text-teal-400">Duración:</span> 45 min · <span className="text-teal-400">Parcial:</span> 1 · <span className="text-teal-400">Semana:</span> 3</p>
            <p className="mt-2"><span className="text-amber-400">EXPERIENCIA:</span> Los estudiantes observan 2 pizzas cortadas diferente...</p>
            <p><span className="text-amber-400">REFLEXIÓN:</span> ¿Por qué 1/2 y 2/4 representan la misma cantidad?...</p>
            <p><span className="text-amber-400">CONCEPTUALIZACIÓN:</span> El docente formaliza el concepto con tabla...</p>
            <p><span className="text-amber-400">APLICACIÓN:</span> Ejercicios del Cuadernillo págs. 34-35...</p>
            <p className="mt-2 text-white/30 text-xs">+ Adaptaciones NEE · Recursos · Criterios de evaluación</p>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────── */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2 text-white/90">Planes simples y transparentes</h2>
        <p className="text-center text-white/40 text-sm mb-10">Sin sorpresas. Cancela cuando quieras.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {plans.map(plan => (
            <div key={plan.name} className={`relative p-7 rounded-2xl border bg-white/[0.03] ${plan.color}`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-violet-500 text-white text-[10px] font-black uppercase tracking-wider">
                  {plan.badge}
                </div>
              )}
              <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className="text-white/40 text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-2.5 mb-7">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                    <span className="text-teal-400 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`block w-full py-3 rounded-xl text-center text-sm font-bold transition-all ${plan.ctaStyle}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] px-6 py-8 text-center text-white/30 text-xs max-w-6xl mx-auto">
        <p>© {new Date().getFullYear()} ClassNova · Hecho para docentes ecuatorianos 🇪🇨</p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <Link href="/legal/terminos" className="hover:text-white/60 transition-colors">Términos</Link>
          <Link href="/legal/privacidad" className="hover:text-white/60 transition-colors">Privacidad</Link>
          <Link href="/dashboard" className="hover:text-white/60 transition-colors">Para instituciones →</Link>
        </div>
      </footer>
    </div>
  )
}
