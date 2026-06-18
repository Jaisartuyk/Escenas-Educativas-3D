// src/components/recursos/RecursosDidacticosClient.tsx
'use client'

import { useState } from 'react'
import { RecursosModal } from './RecursosModal'

interface Subject {
  id: string
  materia: string
  curso: string
  recentTopics: string | null
}

export function RecursosDidacticosClient({ initialSubjects }: { initialSubjects: Subject[] }) {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)

  if (initialSubjects.length === 0) {
    return (
      <div className="bg-surface border border-surface2 rounded-2xl p-12 text-center space-y-4">
        <div className="text-4xl">📚</div>
        <h3 className="text-lg font-bold text-ink">Aún no tienes materias registradas</h3>
        <p className="text-ink3 max-w-md mx-auto">
          Para ver recursos didácticos, primero registra tus materias en la sección "Mis Materias".
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialSubjects.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSubject(s)}
            className="group relative flex flex-col text-left bg-surface border border-surface2 rounded-2xl p-6 transition-all hover:shadow-xl hover:border-violet/30 active:scale-[0.98]"
          >
            <div className="h-12 w-12 rounded-xl bg-violet/10 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
              🎓
            </div>
            
            <h3 className="font-bold text-ink text-lg leading-tight mb-1">{s.materia}</h3>
            <p className="text-violet2 text-sm font-semibold mb-4">{s.curso}</p>
            
            <div className="mt-auto space-y-2">
              <p className="text-[10px] uppercase tracking-wider font-bold text-ink4">Temas recientes:</p>
              <p className="text-xs text-ink3 line-clamp-2">
                {s.recentTopics || 'Sin planificaciones recientes. Se usarán temas generales.'}
              </p>
            </div>

            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-violet2 text-xs font-bold bg-violet/5 px-2 py-1 rounded-lg">
                Ver recursos →
              </span>
            </div>
          </button>
        ))}
      </div>

      {selectedSubject && (
        <RecursosModal
          subject={selectedSubject}
          onClose={() => setSelectedSubject(null)}
        />
      )}
    </>
  )
}
