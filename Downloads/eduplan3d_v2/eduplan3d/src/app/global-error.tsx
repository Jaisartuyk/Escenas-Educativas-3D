'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('GLOBAL SSR EXCEPTION:', error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ padding: '40px', background: '#300', color: 'white', fontFamily: 'monospace', minHeight: '100vh', zIndex: 99999, position: 'relative' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>¡React SSR Server Crash!</h2>
          <p style={{ marginBottom: '8px' }}><strong>Digest:</strong> {error.digest}</p>
          <p style={{ marginBottom: '16px' }}><strong>Message:</strong> {error.message}</p>
          <pre style={{ background: 'black', padding: '16px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {error.stack}
          </pre>
          <button onClick={() => reset()} style={{ marginTop: '24px', padding: '8px 16px', background: 'white', color: '#300', borderRadius: '4px' }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
