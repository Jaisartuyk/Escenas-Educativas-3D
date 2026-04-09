'use client'

import { useState, useRef } from 'react'
import { X, Camera, Phone, Mail, User2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { updateProfileMetadata } from '@/lib/actions/users'
import { createClient } from '@/lib/supabase/client'

export function ProfileDetailsPanel({ 
  user, 
  metadata, 
  institutionId, 
  onClose 
}: { 
  user: any, 
  metadata: any, 
  institutionId: string, 
  onClose: () => void 
}) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(metadata || {})
  const [avatarUrl, setAvatarUrl] = useState(metadata?.avatar_url || null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const isStudent = user.role === 'student'

  const handleSave = async () => {
    setLoading(true)
    const payload = { ...data, avatar_url: avatarUrl }
    const res = await updateProfileMetadata(institutionId, user.id, payload)
    if (res.error) toast.error(res.error)
    else toast.success('Perfil actualizado')
    setLoading(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const t = toast.loading('Subiendo imagen...')
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${ext}`
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      setAvatarUrl(publicUrl)
      toast.success('Imagen subida', { id: t })
    } catch (err: any) {
      toast.error('Error al subir imagen: ' + err.message, { id: t })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0F0C20] border-l border-[rgba(120,100,255,0.15)] h-full shadow-2xl flex flex-col animate-slide-left" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">Ficha del Personal</h2>
          <button onClick={onClose} className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-full transition-colors"><X size={18} /></button>
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
            <p className="text-xs text-ink3 uppercase tracking-wider font-bold">{isStudent ? 'Estudiante' : 'Docente'}</p>
          </div>

          {/* Form Section */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider flex items-center gap-1.5 mb-1.5"><Mail size={12}/> Email (Sistema)</label>
              <input readOnly value={user.email} className="w-full bg-surface border border-transparent rounded-xl px-4 py-2.5 text-sm text-ink3 cursor-not-allowed" />
            </div>
            
            {isStudent ? (
              <>
                <div className="pt-2 border-t border-[rgba(255,255,255,0.05)]">
                  <h4 className="text-xs font-bold text-teal mb-3 uppercase tracking-wider">Datos del Representante</h4>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 block">Nombre del Padre/Madre</label>
                  <input value={data.parent_name || ''} onChange={e => setData({...data, parent_name: e.target.value})} placeholder="Ej. Carlos Pérez" className="input-base" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 flex items-center gap-1.5"><Phone size={12}/> Teléfono de Emergencia</label>
                  <input value={data.emergency_phone || ''} onChange={e => setData({...data, emergency_phone: e.target.value})} placeholder="+593 9..." className="input-base" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 flex items-center gap-1.5"><Mail size={12}/> Correo del Representante</label>
                  <input type="email" value={data.parent_email || ''} onChange={e => setData({...data, parent_email: e.target.value})} placeholder="padre@correo.com" className="input-base" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink3 uppercase mb-1.5 flex items-center gap-1.5">Dirección / Notas</label>
                  <textarea value={data.address || ''} onChange={e => setData({...data, address: e.target.value})} placeholder="Avenida principal..." className="input-base min-h-[80px]" />
                </div>
              </>
            ) : (
              <>
                <div className="pt-2 border-t border-[rgba(255,255,255,0.05)]">
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

        <div className="p-5 border-t border-[rgba(255,255,255,0.05)]">
          <button onClick={handleSave} disabled={loading} className="btn-primary w-full py-3 flex justify-center items-center gap-2">
            {loading ? 'Guardando...' : <><Save size={18}/> Guardar Perfil</>}
          </button>
        </div>
      </div>
    </div>
  )
}
