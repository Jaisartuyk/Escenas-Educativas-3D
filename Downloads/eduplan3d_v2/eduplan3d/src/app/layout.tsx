// src/app/layout.tsx
import type { Metadata } from 'next'
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['300', '400', '500', '600', '700', '800'],
})

const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: { default: 'EduPlan 3D', template: '%s | EduPlan 3D' },
  description: 'Planificaciones docentes inteligentes con escenas 3D didácticas para secundaria y bachillerato',
  keywords: ['planificaciones', 'docentes', 'educación', 'currículo', '3D', 'IA'],
  openGraph: {
    title: 'EduPlan 3D',
    description: 'Planificaciones docentes inteligentes',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${bricolage.variable} ${instrument.variable}`}>
      <body className="bg-bg text-ink font-body antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1a1730',
              color: '#f0eeff',
              border: '1px solid rgba(120,100,255,0.2)',
              fontFamily: 'var(--font-instrument)',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#26d7b4', secondary: '#1a1730' } },
            error:   { iconTheme: { primary: '#f06292', secondary: '#1a1730' } },
          }}
        />
      </body>
    </html>
  )
}
