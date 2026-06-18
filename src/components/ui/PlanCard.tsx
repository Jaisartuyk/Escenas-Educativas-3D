// src/components/ui/PlanCard.tsx
import Link from 'next/link'

interface Props {
  name: string
  price: string
  period: string
  desc: string
  featured: boolean
  features: string[]
  cta: string
  href: string
}

export function PlanCard({ name, price, period, desc, featured, features, cta, href }: Props) {
  return (
    <div className={`relative card p-7 flex flex-col transition-all duration-200 ${
      featured
        ? 'border-2 border-violet bg-bg3'
        : 'hover:border-[rgba(120,100,255,0.3)] hover:-translate-y-1'
    }`}>
      {featured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet to-violet2 text-white text-[11px] font-bold px-4 py-1 rounded-full whitespace-nowrap">
          ⭐ Más popular
        </div>
      )}

      <div className="mb-5">
        <h3 className="font-display text-xl font-bold mb-0.5">{name}</h3>
        <p className="text-xs text-ink3">{desc}</p>
      </div>

      <div className="mb-1">
        <span className="font-display text-[42px] font-extrabold tracking-[-2px]">{price}</span>
        <span className="text-ink3 text-sm ml-1">/mes</span>
      </div>
      <p className="text-xs text-ink3 mb-6">{period}</p>

      <ul className="space-y-2.5 mb-8 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-ink2">
            <span className="text-teal font-bold mt-px text-xs">✓</span>
            {f}
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={`text-center text-sm font-semibold py-3 rounded-xl transition-all ${
          featured
            ? 'bg-gradient-to-br from-violet to-violet2 text-white shadow-[0_4px_20px_rgba(124,109,250,0.3)] hover:opacity-90'
            : 'border border-[rgba(120,100,255,0.26)] text-ink2 hover:border-violet hover:text-ink hover:bg-surface'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}
