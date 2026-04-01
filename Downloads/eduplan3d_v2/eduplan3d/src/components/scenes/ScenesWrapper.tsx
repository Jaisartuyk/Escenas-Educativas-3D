'use client'
import { useState } from 'react'
import { ScenesClient } from './ScenesClient'
import { CustomScenesList } from './CustomScenesList'

export function ScenesWrapper() {
  const [tab, setTab] = useState<'base' | 'custom'>('base')

  return (
    <div>
      <div className="flex gap-4 border-b border-[rgba(120,100,255,0.14)] mb-6">
        <button 
          onClick={() => setTab('base')}
          className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${tab === 'base' ? 'border-violet2 text-violet2' : 'border-transparent text-ink3 hover:text-ink'}`}
        >
          Modelos Base (Integrados)
        </button>
        <button 
          onClick={() => setTab('custom')}
          className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${tab === 'custom' ? 'border-violet2 text-violet2' : 'border-transparent text-ink3 hover:text-ink'}`}
        >
          Mis Modelos Interactivos
        </button>
      </div>

      {tab === 'base' && <ScenesClient />}
      {tab === 'custom' && <CustomScenesList />}
    </div>
  )
}
