'use client'

import { useState } from 'react'
import { X, User, Users, HeartPulse, BrainCircuit, GraduationCap, MapPin, Receipt, ShieldAlert } from 'lucide-react'

// Utilidad para calcular edad exacta
function calcularEdad(fechaNacimiento: string | undefined): string {
  if (!fechaNacimiento) return '--'
  const dob = new Date(fechaNacimiento)
  if (isNaN(dob.getTime())) return '--'
  
  const diffMs = Date.now() - dob.getTime()
  const ageDate = new Date(diffMs)
  const years = Math.abs(ageDate.getUTCFullYear() - 1970)
  const months = ageDate.getUTCMonth()
  const days = ageDate.getUTCDate() - 1
  return `${years} años, ${months} meses, ${days} días`
}

export function FichaEstudianteModal({ student, onClose }: { student: any, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('Perfil')

  const TABS = [
    { id: 'Perfil', icon: User },
    { id: 'Datos Familiares', icon: Users },
    { id: 'Representante', icon: ShieldAlert },
    { id: 'Socio-Económicos', icon: Receipt },
    { id: 'Médicos', icon: HeartPulse },
    { id: 'Físicos', icon: BrainCircuit },
    { id: 'Académicos', icon: GraduationCap },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
      <div 
        className="w-full max-w-5xl bg-surface border border-surface2 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Title */}
        <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.05)] flex items-center justify-between">
          <h2 className="font-display font-medium text-xl text-slate-700">Perfil Administrativo</h2>
          <button onClick={onClose} className="p-2 text-ink3 hover:bg-[rgba(0,0,0,0.05)] rounded-full transition-colors"><X size={20} /></button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50 border-b border-[rgba(0,0,0,0.05)] flex overflow-x-auto custom-scrollbar shadow-inner">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors border-b-2
                  ${isActive 
                    ? 'border-indigo-600 outline-none text-indigo-700 bg-white shadow-[0_-2px_0_0_inset_#4f46e5]' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                  }`}
              >
                <Icon size={14} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                {tab.id}
              </button>
            )
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white custom-scrollbar">
          
          {activeTab === 'Perfil' && (
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Columna Izquierda: Foto y Código */}
              <div className="flex-none flex flex-col items-center w-full lg:w-48 space-y-3">
                <div className="w-48 h-48 rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-50 relative p-1 shadow-sm">
                  {student.avatar_url ? (
                    <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover rounded shadow-inner" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                      <User size={64} />
                      <span className="text-[10px] mt-2 font-semibold">SIN FOTO</span>
                    </div>
                  )}
                </div>
                <div className="w-full bg-emerald-100 border border-emerald-200 text-emerald-700 py-2 rounded-lg font-bold text-center text-sm shadow-inner flex items-center justify-center gap-2">
                  <GraduationCap size={14} /> {student.student_code || 'N/A'}
                </div>
              </div>

              {/* Columna Derecha: Data Grid */}
              <div className="flex-1 space-y-8">
                {/* Nombre Principal */}
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-2xl lg:text-3xl text-slate-700 uppercase tracking-tight">{student.full_name}</h1>
                  {student.username && (
                     <span className="bg-[#2D7A31] text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                       {student.username}
                     </span>
                  )}
                </div>

                {/* Grid Form Field (Solo Lectura) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                  
                  {/* Left Data Column */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">N° Documento</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.dni || student.document_number || 'No registrado'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">T. Documento</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.document_type || 'Cédula'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">País nacimiento</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.birth_country || 'Ecuador'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">C. Nacimiento</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.birth_city || 'No registrada'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">F. Nacimiento</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.birth_date || 'No registrada'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">Edad</span>
                       <span className="text-slate-700 font-medium col-span-2">{calcularEdad(student.birth_date)}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">Género</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.gender || 'No especificado'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">Etnia</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.ethnicity || 'Mestizo'}</span>
                    </div>
                  </div>

                  {/* Right Data Column */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">País</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.current_country || 'Ecuador'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">Ciudad</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.current_city || 'No registrada'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">Parroquia</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.parish || 'No registrada'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">Dirección</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.address || 'No registrada'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">Código único eléctrico</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.cuel || 'No aplica'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">Celular / Teléfono</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.phone || 'No registrado'}</span>
                    </div>
                    <div className="grid grid-cols-3 border-b border-slate-100 pb-2">
                       <span className="text-slate-400 font-semibold text-xs col-span-1 flex items-center">Correo</span>
                       <span className="text-slate-700 font-medium col-span-2">{student.email || 'No registrado'}</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {activeTab !== 'Perfil' && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-4">
               {(() => {
                 const ContentIcon = TABS.find(t => t.id === activeTab)?.icon
                 return ContentIcon ? <ContentIcon size={48} className="opacity-20" /> : null
               })()}
               <p className="font-medium text-lg text-slate-400">Información de {activeTab} aún no registrada por secretaria</p>
               <p className="text-sm text-slate-300">Este bloque solo es de visualización para perfil de Tutoría.</p>
            </div>
          )}

        </div>
        
        {/* Footer info (optional reference) */}
        <div className="px-6 py-3 bg-[rgba(0,0,0,0.02)] border-t border-[rgba(0,0,0,0.05)] text-center text-xs text-slate-400 font-semibold tracking-wider uppercase">
          Documento Privado · {new Date().getFullYear()} · Sistema Admin
        </div>
      </div>
    </div>
  )
}
