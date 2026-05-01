'use client'

import { useState, useRef } from 'react'
import { X, Camera, Phone, Mail, User2, Save, Trash2, AlertTriangle, KeyRound, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { updateProfileMetadata, deleteInstitutionUser, createParentAccessFromStudentProfile } from '@/lib/actions/users'
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
  const [creatingRepresentative, setCreatingRepresentative] = useState<'MADRE' | 'PADRE' | 'OTRO' | null>(null)
  const [creatingParent, setCreatingParent] = useState(false)
  const [parentAccessForms, setParentAccessForms] = useState({
    MADRE: {
      full_name: metadata?.mother_name || '',
      email: metadata?.mother_email || '',
      phone: metadata?.mother_phone || '',
      dni: metadata?.mother_dni || '',
      password: metadata?.mother_dni || '',
    },
    PADRE: {
      full_name: metadata?.father_name || '',
      email: metadata?.father_email || '',
      phone: metadata?.father_phone || '',
      dni: metadata?.father_dni || '',
      password: metadata?.father_dni || '',
    },
    OTRO: {
      full_name: metadata?.other_representative_name || '',
      email: metadata?.other_representative_email || '',
      phone: metadata?.other_representative_phone || metadata?.emergency_phone || '',
      dni: metadata?.other_representative_dni || '',
      password: metadata?.other_representative_dni || '',
    },
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const isStudent = user.role === 'student'
  const isParent = user.role === 'parent'

  const representativeConfigs = [
    {
      key: 'MADRE' as const,
      title: 'Madre',
      name: data.mother_name,
      email: data.mother_email,
      phone: data.mother_phone,
      linkedId: data.mother_parent_user_id,
      login: data.mother_parent_login,
      accent: 'text-teal',
      border: 'border-teal/20',
      bg: 'bg-teal/5',
    },
    {
      key: 'PADRE' as const,
      title: 'Padre',
      name: data.father_name,
      email: data.father_email,
      phone: data.father_phone,
      linkedId: data.father_parent_user_id,
      login: data.father_parent_login,
      accent: 'text-amber-500',
      border: 'border-amber-200',
      bg: 'bg-amber-50/60',
    },
    {
      key: 'OTRO' as const,
      title: 'Representante',
      name: data.other_representative_name,
      email: data.other_representative_email,
      phone: data.other_representative_phone || data.emergency_phone,
      linkedId: data.other_parent_user_id,
      login: data.other_parent_login,
      accent: 'text-violet2',
      border: 'border-violet2/20',
      bg: 'bg-violet2/5',
    },
  ].filter((item) => item.name)

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

  const syncRepresentativeForm = (relationship: 'MADRE' | 'PADRE' | 'OTRO') => {
    if (relationship === 'MADRE') {
      setParentAccessForms(prev => ({
        ...prev,
        MADRE: {
          ...prev.MADRE,
          full_name: data.mother_name || '',
          email: data.mother_email || '',
          phone: data.mother_phone || '',
          dni: prev.MADRE.dni || data.mother_dni || '',
          password: prev.MADRE.password || data.mother_dni || '',
        }
      }))
    } else if (relationship === 'PADRE') {
      setParentAccessForms(prev => ({
        ...prev,
        PADRE: {
          ...prev.PADRE,
          full_name: data.father_name || '',
          email: data.father_email || '',
          phone: data.father_phone || '',
          dni: prev.PADRE.dni || data.father_dni || '',
          password: prev.PADRE.password || data.father_dni || '',
        }
      }))
    } else {
      setParentAccessForms(prev => ({
        ...prev,
        OTRO: {
          ...prev.OTRO,
          full_name: data.other_representative_name || '',
          email: data.other_representative_email || '',
          phone: data.other_representative_phone || data.emergency_phone || '',
          dni: prev.OTRO.dni || data.other_representative_dni || '',
          password: prev.OTRO.password || data.other_representative_dni || '',
        }
      }))
    }
  }

  const handleCreateParentAccess = async (relationship: 'MADRE' | 'PADRE' | 'OTRO') => {
    const form = parentAccessForms[relationship]
    if (!form.full_name?.trim()) {
      return toast.error('Necesitamos el nombre del representante para crear su acceso')
    }
    if (!form.password?.trim()) {
      return toast.error('Necesitamos una contraseña inicial para el representante')
    }

    setCreatingParent(true)
    const res = await createParentAccessFromStudentProfile({
      institution_id: institutionId,
      student_id: user.id,
      relationship,
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      dni: form.dni,
      password: form.password,
      is_primary: data.representative === relationship || (relationship === 'OTRO' && data.representative === 'OTRO'),
    })

    if (res.error) {
      toast.error(res.error)
    } else {
      const nextMeta = {
        ...data,
        ...(res.studentMetadata || {}),
      }
      setData(nextMeta)
      onUpdate({ ...nextMeta, avatar_url: avatarUrl })
      setCreatingRepresentative(null)
      toast.success(`Acceso de ${relationship === 'MADRE' ? 'madre' : relationship === 'PADRE' ? 'padre' : 'representante'} creado`)
      toast((`Usuario: ${res.login} | Contraseña: ${res.password}`), { icon: '🔐', duration: 7000 })
      if (res.warning) toast(res.warning as string, { icon: 'ℹ️' })
    }
    setCreatingParent(false)
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
                <div className="pt-2 mt-2 border-t border-[rgba(0,0,0,0.05)]">
                  <h4 className="text-xs font-bold text-violet2 mb-3 uppercase tracking-wider">Accesos de representantes</h4>
                  <p className="text-xs text-ink4 mb-3">
                    Si este estudiante ya tiene madre, padre o tutor registrado, puedes crearle sus credenciales desde aquÃ­ mismo.
                  </p>
                  <div className="space-y-3">
                    {representativeConfigs.map((rep) => {
                      const form = parentAccessForms[rep.key]
                      const isOpen = creatingRepresentative === rep.key
                      return (
                        <div key={rep.key} className={`rounded-2xl border p-4 ${rep.border} ${rep.bg}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={`text-sm font-bold ${rep.accent}`}>{rep.title}</p>
                              <p className="text-sm text-ink mt-1">{rep.name}</p>
                              <p className="text-xs text-ink4 mt-1">
                                {rep.linkedId
                                  ? <>Acceso activo: <span className="font-semibold text-ink3">{rep.login || rep.email}</span></>
                                  : rep.email
                                  ? <>Correo registrado: <span className="font-semibold text-ink3">{rep.email}</span></>
                                  : 'AÃºn no tiene acceso creado'}
                              </p>
                            </div>
                            {rep.linkedId ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={12} />
                                Con acceso
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  syncRepresentativeForm(rep.key)
                                  setCreatingRepresentative(prev => prev === rep.key ? null : rep.key)
                                }}
                                className="inline-flex items-center gap-2 rounded-xl bg-violet2 px-3 py-2 text-xs font-bold text-white hover:bg-violet transition-colors"
                              >
                                <KeyRound size={14} />
                                {isOpen ? 'Ocultar' : 'Crear acceso'}
                              </button>
                            )}
                          </div>

                          {isOpen && !rep.linkedId && (
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase text-ink3">Nombre completo</label>
                                <input
                                  value={form.full_name}
                                  onChange={e => setParentAccessForms(prev => ({ ...prev, [rep.key]: { ...prev[rep.key], full_name: e.target.value } }))}
                                  className="input-base"
                                  placeholder="Nombre del representante"
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase text-ink3">Correo o usuario <span className="normal-case font-normal text-ink4">(opcional)</span></label>
                                <input
                                  value={form.email}
                                  onChange={e => setParentAccessForms(prev => ({ ...prev, [rep.key]: { ...prev[rep.key], email: e.target.value } }))}
                                  className="input-base"
                                  placeholder="Si lo dejas vacÃ­o, usamos cÃ©dula o usuario interno"
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase text-ink3">CÃ©dula <span className="normal-case font-normal text-ink4">(opcional)</span></label>
                                <input
                                  value={form.dni}
                                  onChange={e => setParentAccessForms(prev => ({ ...prev, [rep.key]: { ...prev[rep.key], dni: e.target.value, password: prev[rep.key].password || e.target.value } }))}
                                  className="input-base"
                                  placeholder="Ãštil si quieres usarla como usuario o clave"
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase text-ink3">TelÃ©fono</label>
                                <input
                                  value={form.phone}
                                  onChange={e => setParentAccessForms(prev => ({ ...prev, [rep.key]: { ...prev[rep.key], phone: e.target.value } }))}
                                  className="input-base"
                                  placeholder="+593 9..."
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold uppercase text-ink3">ContraseÃ±a inicial</label>
                                <input
                                  value={form.password}
                                  onChange={e => setParentAccessForms(prev => ({ ...prev, [rep.key]: { ...prev[rep.key], password: e.target.value } }))}
                                  className="input-base"
                                  placeholder="Puede ser cÃ©dula, telÃ©fono o una temporal"
                                />
                              </div>
                              <div className="md:col-span-2 rounded-xl border border-violet2/15 bg-white p-3">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-violet2 mb-1">Credenciales que se crearÃ¡n</p>
                                <p className="text-sm text-ink2">
                                  <span className="text-ink3">Usuario:</span>{' '}
                                  <strong>{form.email || form.dni || `parent.${rep.key.toLowerCase()}.${user.id}@classnova.local`}</strong>
                                  <span className="mx-2 text-ink4">|</span>
                                  <span className="text-ink3">ContraseÃ±a:</span>{' '}
                                  <strong>{form.password || 'Pendiente'}</strong>
                                </p>
                              </div>
                              <div className="md:col-span-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleCreateParentAccess(rep.key)}
                                  disabled={creatingParent}
                                  className="inline-flex items-center gap-2 rounded-xl bg-violet2 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet transition-colors disabled:opacity-60"
                                >
                                  <KeyRound size={16} />
                                  {creatingParent ? 'Creando acceso...' : 'Crear credenciales'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {representativeConfigs.length === 0 && (
                      <p className="text-xs text-ink4 italic">
                        Primero completa el nombre de la madre, padre o representante para poder generar su acceso.
                      </p>
                    )}
                  </div>
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
