'use client'

import { useState, useRef } from 'react'
import { X, Camera, Phone, Mail, User2, Save, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { updateProfileMetadata, deleteInstitutionUser } from '@/lib/actions/users'
import { createClient } from '@/lib/supabase/client'

export function ProfileDetailsPanel({ 
  user, 
  metadata, 
  institutionId, 
  onClose,
  onUpdate
}: { 
  user: any, 
  metadata: any, 
  institutionId: string, 
  onClose: () => void,
  onUpdate: (meta: any) => void
}) {
  const [loading, setLoading] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [data, setData] = useState(metadata || {})
  const [avatarUrl, setAvatarUrl] = useState(metadata?.avatar_url || null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const isStudent = user.role === 'student'
  const isParent = user.role === 'parent'

  const handleSave = async () => {
    setLoading(true)
    const payload = { ...data, avatar_url: avatarUrl }
    const res = await updateProfileMetadata(institutionId, user.id, payload)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Perfil actualizado')
      onUpdate(payload) // Optimistic UI update
      onClose() // Auto-close modal
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    setLoading(true)
    const res = await deleteInstitutionUser(user.id)
    if (res.error) {
      toast.error(res.error)
      setLoading(false)
    } else {
      toast.success('Miembro eliminado permanentemente')
      onClose()
      window.location.reload() // Hard refresh to update lists in parent
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const t = toast.loading('Subiendo imagen...')
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${ext}`
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileName', fileName)

      const res = await fetch('/api/avatars', {
        method: 'POST',
        body: formData
      })
      const apiData = await res.json()

      if (!res.ok || apiData.error) throw new Error(apiData.error || 'Fallo al subir.')

      setAvatarUrl(apiData.publicUrl)
      toast.success('Imagen subida', { id: t })
    } catch (err: any) {
      toast.error('Error al subir imagen: ' + err.message, { id: t })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-surface border-l border-[rgba(120,100,255,0.15)] h-full shadow-2xl flex flex-col animate-slide-left" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[rgba(0,0,0,0.05)] flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">Ficha del Personal</h2>
          <button onClick={onClose} className="p-2 hover:bg-[rgba(0,0,0,0.1)] rounded-full transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group cursor-pointer mb-3" onClick={() => fileRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-2 border-violet2" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-surface2 border-2 border-dashed border-violet2/50 flex items-center justify-center text-violet2 group-hover:bg-[rgba(124,109,250,0.1)] transition-colors">
                  <User2 size={32} />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera size={20} className="text-white" />
              </div>
              <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </div>
            <h3 className="font-bold text-lg text-center">{user.full_name}</h3>
            <p className="text-xs text-ink3 uppercase tracking-wider font-bold">
              {user.role === 'student' ? 'Estudiante' : 
               user.role === 'parent' ? 'Representante' :
               user.role === 'teacher' ? 'Docente' :
               user.role === 'secretary' ? 'Secretaría' : 
               user.role === 'supervisor' ? 'Supervisor' : 'Rector'}
            </p>
          </div>

          {/* Form Section */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider flex items-center gap-1.5 mb-1.5"><Mail size={12}/> Email (Sistema)</label>
              <input readOnly value={user.email} className="w-full bg-surface border border-transparent rounded-xl px-4 py-2.5 text-sm text-ink3 cursor-not-allowed" />
            </div>
            
            {isStudent ? (
              <>
                <div className="pt-2 border-t border-[rgba(0,0,0,0.05)]">
                  <h4 className="text-xs font-bold text-teal mb-3 uppercase tracking-wider">Datos de la Madre</h4>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 block">Nombres Completos</label>
                  <input value={data.mother_name || ''} onChange={e => setData({...data, mother_name: e.target.value})} placeholder="Ej. Ana Villamar" className="input-base" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 flex items-center gap-1.5"><Phone size={12}/> Teléfono</label>
                    <input value={data.mother_phone || ''} onChange={e => setData({...data, mother_phone: e.target.value})} placeholder="+593 9..." className="input-base" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 flex items-center gap-1.5"><Mail size={12}/> Email</label>
                    <input type="email" value={data.mother_email || ''} onChange={e => setData({...data, mother_email: e.target.value})} placeholder="ana@correo.com" className="input-base" />
                  </div>
                </div>

                <div className="pt-2 mt-2 border-t border-[rgba(0,0,0,0.05)]">
                  <h4 className="text-xs font-bold text-[#F8D25A] mb-3 uppercase tracking-wider">Datos del Padre</h4>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 block">Nombres Completos</label>
                  <input value={data.father_name || ''} onChange={e => setData({...data, father_name: e.target.value})} placeholder="Ej. Carlos Pérez" className="input-base" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 flex items-center gap-1.5"><Phone size={12}/> Teléfono</label>
                    <input value={data.father_phone || ''} onChange={e => setData({...data, father_phone: e.target.value})} placeholder="+593 9..." className="input-base" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 flex items-center gap-1.5"><Mail size={12}/> Email</label>
                    <input type="email" value={data.father_email || ''} onChange={e => setData({...data, father_email: e.target.value})} placeholder="carlos@correo.com" className="input-base" />
                  </div>
                </div>

                <div className="pt-2 mt-2 border-t border-[rgba(0,0,0,0.05)]">
                  <h4 className="text-xs font-bold text-violet2 mb-3 uppercase tracking-wider">Representación y Emergencia</h4>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 block">¿Quién es el representante oficial?</label>
                  <select value={data.representative || 'MADRE'} onChange={e => setData({...data, representative: e.target.value})} className="input-base">
                    <option value="MADRE">Madre</option>
                    <option value="PADRE">Padre</option>
                    <option value="AMBOS">Ambos</option>
                    <option value="OTRO">Otro (Familiar/Tutor)</option>
                  </select>
                </div>

                {data.representative === 'OTRO' && (
                  <div>
                    <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 block">Nombre del Tutor Alterno</label>
                    <input value={data.other_representative_name || ''} onChange={e => setData({...data, other_representative_name: e.target.value})} placeholder="Ej. Abuela María" className="input-base" />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 flex items-center gap-1.5"><Phone size={12}/> Teléfono Principal de Emergencia</label>
                  <input value={data.emergency_phone || ''} onChange={e => setData({...data, emergency_phone: e.target.value})} placeholder="Línea prioritaria" className="input-base" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 flex items-center gap-1.5">Dirección / Notas Médicas</label>
                  <textarea value={data.address || ''} onChange={e => setData({...data, address: e.target.value})} placeholder="Dirección, alergias, o instrucciones especiales..." className="input-base min-h-[80px]" />
                </div>
              </>
            ) : isParent ? (
              <>
                <div className="pt-2 border-t border-[rgba(0,0,0,0.05)]">
                  <h4 className="text-xs font-bold text-amber-500 mb-3 uppercase tracking-wider">Datos del Representante</h4>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 block">Relación con el estudiante</label>
                  <input value={data.parent_relationship || ''} onChange={e => setData({...data, parent_relationship: e.target.value})} placeholder="MADRE / PADRE / OTRO" className="input-base" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 flex items-center gap-1.5"><Phone size={12}/> Teléfono</label>
                  <input value={data.phone || ''} onChange={e => setData({...data, phone: e.target.value})} placeholder="+593 9..." className="input-base" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 block">Estudiante vinculado</label>
                  <input readOnly value={data.linked_student_name || ''} className="w-full bg-surface border border-transparent rounded-xl px-4 py-2.5 text-sm text-ink3 cursor-not-allowed" />
                </div>
              </>
            ) : (
              <>
                <div className="pt-2 border-t border-[rgba(0,0,0,0.05)]">
                  <h4 className="text-xs font-bold text-violet2 mb-3 uppercase tracking-wider">Datos del Profesional</h4>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 block">Especialidad / Cargo Fijo</label>
                  <input value={data.specialty || ''} onChange={e => setData({...data, specialty: e.target.value})} placeholder="Ing. en Ciencias Computacionales" className="input-base" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 flex items-center gap-1.5"><Phone size={12}/> Teléfono Personal</label>
                  <input value={data.phone || ''} onChange={e => setData({...data, phone: e.target.value})} placeholder="+593 9..." className="input-base" />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-[rgba(0,0,0,0.05)] space-y-3">
          {!showConfirmDelete ? (
            <>
              <button onClick={handleSave} disabled={loading} className="btn-primary w-full py-3 flex justify-center items-center gap-2">
                {loading ? 'Guardando...' : <><Save size={18}/> Guardar Perfil</>}
              </button>
              
              <div className="pt-4 border-t border-dashed border-[rgba(0,0,0,0.05)]">
                <button 
                  onClick={() => setShowConfirmDelete(true)} 
                  disabled={loading}
                  className="w-full py-2.5 text-xs font-bold text-red-500/60 hover:text-red-500 flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 size={14} /> Eliminar Miembro del Sistema
                </button>
              </div>
            </>
          ) : (
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100 flex flex-col gap-3 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 text-red-500 rounded-lg">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-700 leading-tight">¿Eliminar permanentemente?</p>
                  <p className="text-[11px] text-red-600 mt-0.5">Se borrará su acceso, perfil, pagos y planificaciones. Esta acción no se puede deshacer.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleDelete} 
                  disabled={loading}
                  className="flex-1 bg-red-500 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-red-600 transition-colors"
                >
                  {loading ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
                <button 
                  onClick={() => setShowConfirmDelete(false)} 
                  disabled={loading}
                  className="px-4 bg-white text-ink3 text-xs font-bold py-2.5 rounded-xl border border-red-200 hover:bg-red-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
