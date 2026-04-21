'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, UserSquare2 } from 'lucide-react'
import { FichaEstudianteModal } from './FichaEstudianteModal'

// Paleta de colores atractiva para las tarjetas
const CARD_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-900',
  'bg-violet-50 border-violet-200 text-violet-900',
  'bg-teal-50 border-teal-200 text-teal-900',
  'bg-rose-50 border-rose-200 text-rose-900',
  'bg-amber-50 border-amber-200 text-amber-900',
  'bg-emerald-50 border-emerald-200 text-emerald-900',
  'bg-indigo-50 border-indigo-200 text-indigo-900',
  'bg-pink-50 border-pink-200 text-pink-900'
]

function getColorForId(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length]
}

export function DirectorioTutorClient({ courses = [], students = [] }: any) {
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)

  const filteredStudents = useMemo(() => {
    return students
      .filter((s: any) => selectedCourse === '' || s.courseId === selectedCourse)
      .filter((s: any) => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name))
  }, [students, selectedCourse, searchQuery])

  return (
    <div className="space-y-6">
      {/* Caja de herramientas */}
      <div className="px-4">
        <div className="bg-surface border border-surface2 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-auto min-w-[220px]">
               <select 
                  value={selectedCourse} 
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full appearance-none bg-bg border border-surface2 rounded-xl pl-4 pr-8 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-400"
               >
                  {courses.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} {c.parallel || ''}</option>
                  ))}
               </select>
               <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
             </div>
          </div>

          <div className="relative w-full md:max-w-xs">
            <input 
              type="text" 
              placeholder="Buscar estudiante..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg border border-surface2 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
            />
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3" />
          </div>

        </div>
      </div>

      {/* Grid de Estudiantes */}
      <div className="px-4 pb-12">
        {courses.length === 0 ? (
          <div className="bg-surface border border-surface2 rounded-2xl p-12 text-center">
             <h3 className="text-lg font-bold text-ink">Sin Cursos</h3>
             <p className="text-ink3 text-sm">No administras tutorías actualmente.</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-12">
             <h3 className="text-lg font-bold text-ink3">No se encontraron estudiantes para los filtros actuales.</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredStudents.map((st: any) => {
              const colorClass = getColorForId(st.id)

              return (
                <div 
                  key={st.id}
                  onClick={() => setSelectedStudent(st)}
                  className={`relative group overflow-hidden rounded-2xl border cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 bg-surface`}
                >
                  {/* Encabezado colreado */}
                  <div className={`h-20 w-full ${colorClass.split(' ')[0]} border-b ${colorClass.split(' ')[1]}`}></div>
                  
                  {/* Avatar flotante */}
                  <div className="px-4 flex flex-col items-center -mt-10 mb-4 pointer-events-none">
                    <div className="w-20 h-20 bg-white rounded-full p-1 shadow-sm mb-2 relative">
                      {st.avatar_url ? (
                        <img src={st.avatar_url} alt={st.full_name} className="w-full h-full rounded-full object-cover bg-surface2" />
                      ) : (
                        <div className={`w-full h-full rounded-full flex items-center justify-center font-display font-bold text-xl ${colorClass}`}>
                          {st.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-ink text-center leading-tight line-clamp-2" title={st.full_name}>
                      {st.full_name}
                    </h3>
                  </div>

                  <div className="px-4 pb-4 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface to-transparent pt-6 pointer-events-none">
                    <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 uppercase tracking-widest text-center py-1.5 rounded-lg flex items-center justify-center gap-1.5">
                      <UserSquare2 size={12} /> Abrir Ficha
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Ficha Completa */}
      {selectedStudent && (
        <FichaEstudianteModal 
          student={selectedStudent} 
          onClose={() => setSelectedStudent(null)} 
        />
      )}
    </div>
  )
}
