// src/app/superadmin/layout.tsx
// Standalone layout — no dashboard sidebar

export const dynamic = 'force-dynamic'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a10] text-white">
      {children}
    </div>
  )
}
