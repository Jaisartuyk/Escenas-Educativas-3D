// src/components/ui/FeatureCard.tsx
interface Props {
  icon: string
  title: string
  desc: string
  bg: string
}

const BG_MAP: Record<string, string> = {
  violet: 'bg-[rgba(124,109,250,0.15)]',
  rose:   'bg-[rgba(240,98,146,0.15)]',
  teal:   'bg-[rgba(38,215,180,0.15)]',
  amber:  'bg-[rgba(255,179,71,0.15)]',
}

export function FeatureCard({ icon, title, desc, bg }: Props) {
  return (
    <div className="relative group card p-7 overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-[rgba(120,100,255,0.3)]">
      {/* Top accent on hover */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-violet to-violet2 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5 ${BG_MAP[bg] ?? BG_MAP.violet}`}>
        {icon}
      </div>
      <h3 className="font-display text-[17px] font-bold tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-ink2 leading-relaxed">{desc}</p>
    </div>
  )
}
