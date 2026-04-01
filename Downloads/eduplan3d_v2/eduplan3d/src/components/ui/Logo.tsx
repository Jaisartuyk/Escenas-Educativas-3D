// src/components/ui/Logo.tsx
import Link from 'next/link'

interface Props { size?: 'sm' | 'md' }

export function Logo({ size = 'md' }: Props) {
  const s = size === 'sm' ? 'text-[17px]' : 'text-[20px]'
  const icon = size === 'sm' ? 28 : 34

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
