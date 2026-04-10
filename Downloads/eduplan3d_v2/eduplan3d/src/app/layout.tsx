// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#4F46E5',
}

export const metadata: Metadata = {
  title: { default: 'EduPlan 3D', template: '%s | EduPlan 3D' },
  description: 'Planificaciones docentes inteligentes con escenas 3D didácticas para secundaria y bachillerato',
  keywords: ['planificaciones', 'docentes', 'educación', 'currículo', '3D', 'IA'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EduPlan 3D',
  },
  openGraph: {
    title: 'EduPlan 3D',
    description: 'Planificaciones docentes inteligentes',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${bricolage.variable} ${instrument.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
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
        {/* Service Worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .catch(() => {})
                })
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
