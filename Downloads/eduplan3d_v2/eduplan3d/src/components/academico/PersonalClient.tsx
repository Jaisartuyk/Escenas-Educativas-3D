'use client'

import { useState } from 'react'
import { Plus, Download, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { createInstitutionUser } from '@/lib/actions/users'
import { ProfileDetailsPanel } from './ProfileDetailsPanel'

export function PersonalClient({ institutionId, teachers, students, horariosDocentes, directoryMetadata }: { institutionId: string, teachers: any[], students: any[], horariosDocentes: any[], directoryMetadata: any }) {
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [showRegistrarForm, setShowRegistrarForm] = useState(false)
  
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
      setShowRegistrarForm(false) // Close form on success
      // Next JS router refresh is handled by the server action's revalidatePath
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {!showRegistrarForm ? (
        <div 
          onClick={() => setShowRegistrarForm(true)} 
          className="flex justify-between items-center bg-[rgba(124,109,250,0.05)] border border-[rgba(124,109,250,0.2)] rounded-2xl p-5 cursor-pointer hover:bg-[rgba(124,109,250,0.08)] transition-all transform hover:scale-[1.01]"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-violet2 flex text-white items-center justify-center shadow-[0_0_15px_rgba(124,109,250,0.5)]">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="font-bold text-violet2 text-lg drop-shadow-sm">Empadronar Nuevo Personal o Alumno</h3>
              <p className="text-sm text-ink3">Genera credenciales oficiales y seguras para brindar acceso al sistema.</p>
            </div>
          </div>
          <button className="btn-primary text-sm px-6 py-2.5 font-bold tracking-wide">Abrir Registro</button>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-[rgba(255,255,255,0.05)] p-6 shadow-xl animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-display font-bold text-lg flex items-center gap-2"><UserPlus size={18} className="text-violet2" /> Registro Seguro de Puerta Cerrada</h3>
              <p className="text-sm text-ink3 mt-1">Garantiza credenciales seguras y el alta sin exposición al público.</p>
            </div>
            <button onClick={() => setShowRegistrarForm(false)} className="text-ink4 hover:text-ink2 text-sm bg-bg px-4 py-2 rounded-lg border border-transparent hover:border-surface transition-all">Cancelar</button>
          </div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-bg/50 p-5 rounded-xl border border-[rgba(255,255,255,0.02)]">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Rol Asignado</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="input-base">
                <option value="student">Estudiante</option>
                <option value="teacher">Profesor (Docente)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Nombre Completo</label>
              <input type="text" required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="Ej. Juan Pérez" className="input-base" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Cédula / DNI</label>
              <input type="text" required value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} placeholder="09XXXXXXXX" className="input-base" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Correo Vinculado</label>
              <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="juan@escuela.com" className="input-base" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Contraseña Maestra Inicial</label>
              <input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Define una clave secreta..." className="input-base" />
            </div>
            <div className="md:col-span-2 mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
               <button type="submit" disabled={loading} className="w-full btn-primary py-3.5 flex items-center justify-center gap-2">
                 {loading ? 'Sincronizando Base de Datos...' : <><Plus size={18}/> Validar y Empadronar Cuenta</>}
               </button>
            </div>
          </form>
        </div>
      )}

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
