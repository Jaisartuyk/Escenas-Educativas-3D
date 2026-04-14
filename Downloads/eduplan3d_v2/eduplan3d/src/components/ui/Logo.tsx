// src/components/ui/Logo.tsx
import Link from 'next/link'

interface Props { 
  size?: 'sm' | 'md'
  institutionName?: string
  logoUrl?: string
}

export function Logo({ size = 'md', institutionName, logoUrl }: Props) {
  const s = size === 'sm' ? 'text-[15px]' : 'text-[17px]'
  const icon = size === 'sm' ? 28 : 34

  // Si hay nombre de institución, mostramos su logo o un placeholder estilizado
  if (institutionName) {
    return (
      <Link href="/dashboard" className={`font-display font-bold tracking-tight flex items-center gap-3 ${s} max-w-[200px]`}>
        <div 
          style={{ width: icon, height: icon }}
          className="rounded-lg bg-white border border-[rgba(120,100,255,0.1)] flex items-center justify-center flex-shrink-0 overflow-hidden"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={institutionName} className="w-full h-full object-contain" />
          ) : (
            <span className="text-violet font-bold text-xs">{institutionName.charAt(0)}</span>
          )}
        </div>
        <span className="truncate leading-tight text-ink">{institutionName}</span>
      </Link>
    )
  }

  return (
    <Link href="/" className={`font-display font-extrabold tracking-tight flex items-center gap-2.5 ${s}`}>
      <span
        style={{ width: icon, height: icon }}
        className="rounded-[9px] bg-gradient-to-br from-violet to-violet2 flex items-center justify-center flex-shrink-0"
      >
        <svg width={icon * 0.52} height={icon * 0.52} viewBox="0 0 18 18" fill="none">
          <rect x="1" y="1" width="7" height="7" rx="2" fill="white" opacity=".9"/>
          <rect x="10" y="1" width="7" height="7" rx="2" fill="white" opacity=".6"/>
          <rect x="1" y="10" width="7" height="7" rx="2" fill="white" opacity=".6"/>
          <rect x="10" y="10" width="7" height="7" rx="2" fill="white" opacity=".85"/>
        </svg>
      </span>
      Edu<span className="text-violet2">Plan</span> 3D
    </Link>
  )
}
