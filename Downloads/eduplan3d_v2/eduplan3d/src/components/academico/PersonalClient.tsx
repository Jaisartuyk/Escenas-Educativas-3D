'use client'

import { useState } from 'react'
import { Plus, Download, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { createInstitutionUser } from '@/lib/actions/users'
import { ProfileDetailsPanel } from './ProfileDetailsPanel'

export function PersonalClient({ institutionId, teachers, students, horariosDocentes, directoryMetadata }: { institutionId: string, teachers: any[], students: any[], horariosDocentes: any[], directoryMetadata: any }) {
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  
  // Local state for optimistic updates
  const [localMetaData, setLocalMetaData] = useState(directoryMetadata || {})

  const [formData, setFormData] = useState({
    full_name: '',
    dni: '',
    email: '',
    password: '',
    role: 'student' as 'student' | 'teacher'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.full_name || !formData.email || !formData.password || !formData.dni) {
      return toast.error("Todos los campos son obligatorios")
    }

    setLoading(true)
    const res = await createInstitutionUser({
      ...formData,
      institution_id: institutionId
    })

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(formData.role === 'student' ? 'Estudiante creado exitosamente' : 'Docente creado exitosamente')
      setFormData({ full_name: '', dni: '', email: '', password: '', role: 'student' })
      // Next JS router refresh is handled by the server action's revalidatePath
    }
    setLoading(false)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-surface rounded-2xl border border-[rgba(255,255,255,0.02)] p-6">
        <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2"><UserPlus size={18} className="text-violet" /> Registrar Nuevo Usuario (Admin-First)</h3>
        <p className="text-sm text-ink3 mb-6">Por seguridad, el auto-registro abierto requiere aprobación. Use este formulario para emitir credenciales oficiales garantizadas de "Puerta Cerrada".</p>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink3 uppercase">Rol</label>
            <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="w-full bg-bg border border-surface rounded-xl px-4 py-2 text-sm outline-none focus:border-violet">
              <option value="student">Estudiante</option>
              <option value="teacher">Profesor (Docente)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink3 uppercase">Nombre Completo</label>
            <input type="text" required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="Ej. Juan Pérez" className="w-full bg-bg border border-surface rounded-xl px-4 py-2 text-sm outline-none focus:border-violet" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink3 uppercase">Cédula / DNI</label>
            <input type="text" required value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} placeholder="09XXXXXXXX" className="w-full bg-bg border border-surface rounded-xl px-4 py-2 text-sm outline-none focus:border-violet" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink3 uppercase">Correo Institucional / Personal</label>
            <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="juan.perez@escuela.com" className="w-full bg-bg border border-surface rounded-xl px-4 py-2 text-sm outline-none focus:border-violet" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink3 uppercase">Contraseña Inicial</label>
            <input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Define una clave secreta" className="w-full bg-bg border border-surface rounded-xl px-4 py-2 text-sm outline-none focus:border-violet" />
          </div>
          <div className="md:col-span-2 mt-2">
             <button type="submit" disabled={loading} className="disabled:opacity-50 w-full bg-violet hover:bg-violet2 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-glow flex items-center justify-center gap-2">
               {loading ? 'Procesando en Supabase...' : <><Plus size={18}/> Empadronar Cuenta</>}
             </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg border border-surface rounded-2xl p-5">
           <h4 className="font-bold mb-4">Directorio de Docentes ({teachers.length})</h4>
           <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
             {teachers.map(t => {
               const meta = localMetaData[t.id] || {}
               return (
               <div key={t.id} onClick={() => setSelectedUser(t)} className="p-3 bg-surface rounded-xl border border-[rgba(255,255,255,0.02)] cursor-pointer hover:bg-[rgba(124,109,250,0.05)] transition-colors flex items-center gap-3">
                 {meta.avatar_url ? (
                   <img src={meta.avatar_url} className="w-10 h-10 rounded-full object-cover border border-violet2" />
                 ) : (
                   <div className="w-10 h-10 rounded-full bg-[rgba(124,109,250,0.15)] flex items-center justify-center text-violet2 font-bold text-xs">{t.full_name.charAt(0)}</div>
                 )}
                 <div>
                   <p className="font-medium text-sm">{t.full_name}</p>
                   <p className="text-xs text-ink4">{t.email}</p>
                 </div>
               </div>
               )
             })}
             {teachers.length === 0 && <p className="text-xs text-ink4 italic">Sin profesores verificados.</p>}
           </div>
        </div>
        <div className="bg-bg border border-surface rounded-2xl p-5">
           <h4 className="font-bold mb-4 text-teal">Alumnos Inscritos ({students.length})</h4>
           <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
             {students.map(s => {
               const meta = localMetaData[s.id] || {}
               return (
               <div key={s.id} onClick={() => setSelectedUser(s)} className="p-3 bg-[rgba(38,215,180,0.05)] text-teal rounded-xl border border-[rgba(38,215,180,0.1)] cursor-pointer hover:bg-[rgba(38,215,180,0.1)] transition-colors flex items-center gap-3">
                 {meta.avatar_url ? (
                   <img src={meta.avatar_url} className="w-10 h-10 rounded-full object-cover border border-teal" />
                 ) : (
                   <div className="w-10 h-10 rounded-full bg-[rgba(38,215,180,0.15)] flex items-center justify-center text-teal font-bold text-xs">{s.full_name.charAt(0)}</div>
                 )}
                 <div>
                   <p className="font-medium text-sm">{s.full_name}</p>
                   <p className="text-xs opacity-70">{s.email}</p>
                 </div>
               </div>
               )
             })}
             {students.length === 0 && <p className="text-xs text-ink4 italic">Sin alumnos verificados.</p>}
           </div>
        </div>

        <div className="md:col-span-2 bg-[#F8D25A]/5 border border-[#F8D25A]/20 rounded-2xl p-5">
           <h4 className="font-bold mb-2 text-[#F8D25A] flex items-center gap-2"><Download size={16}/> Sugerencias desde "Generador de Horarios"</h4>
           <p className="text-xs text-ink3 mb-4">Estos profesores fueron escritos en el JSON del Horario pero aún no tienen cuenta real. Importalos para habilitarles su panel docente interactivo.</p>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
             {horariosDocentes.map((hd: any, idx: number) => {
               // Check if it's already in teachers
               const nameToMatch = hd.nombre || hd.name || ''
               const isAlreadyRegistered = teachers.some((t:any) => t.full_name.toLowerCase() === nameToMatch.toLowerCase())
               
               if (isAlreadyRegistered) return null

               return (
                 <div key={idx} className="flex flex-col gap-2 p-3 bg-bg/50 border border-[rgba(255,255,255,0.05)] rounded-xl">
                    <p className="font-medium text-sm text-ink">{nameToMatch}</p>
                    <button 
                      onClick={() => setFormData({...formData, role: 'teacher', full_name: nameToMatch, password: nameToMatch.split(' ')[0].toLowerCase() + '123'})}
                      className="text-xs w-full bg-[#F8D25A]/10 hover:bg-[#F8D25A]/20 text-[#F8D25A] transition-colors py-1.5 rounded-lg border border-[#F8D25A]/20"
                    >
                      Completar y Empadronar
                    </button>
                 </div>
               )
             })}
             {horariosDocentes.filter((hd:any) => !teachers.some((t:any) => t.full_name.toLowerCase() === (hd.nombre || hd.name || '').toLowerCase())).length === 0 && (
                <p className="text-xs text-ink4 italic w-full col-span-full">Todos los docentes de Horarios ya tienen cuenta activa.</p>
             )}
           </div>
        </div>
      </div>

      {selectedUser && (
        <ProfileDetailsPanel 
          user={selectedUser} 
          metadata={localMetaData[selectedUser.id] || {}} 
          institutionId={institutionId} 
          onClose={() => setSelectedUser(null)} 
          onUpdate={(newMeta) => setLocalMetaData((prev:any) => ({ ...prev, [selectedUser.id]: newMeta }))}
        />
      )}
    </div>
  )
}
