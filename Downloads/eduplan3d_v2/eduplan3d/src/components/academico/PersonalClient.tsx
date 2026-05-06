'use client'

import { useState } from 'react'
import { Plus, Download, UserPlus, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { createInstitutionUser } from '@/lib/actions/users'
import { ProfileDetailsPanel } from './ProfileDetailsPanel'
import { ImportarEstudiantesModal } from './ImportarEstudiantesModal'

const LETAMENDI_NAME = 'UNIDAD EDUCATIVA PARTICULAR CORONEL MIGUEL DE LETAMENDI'

function normalizeInstitutionName(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function PersonalClient({ institutionId, currentRole, institutionName, teachers, students, parents = [], horariosDocentes, directoryMetadata, courses = [], enrollments: enrollmentsRef = [] }: { institutionId: string, currentRole: string, institutionName: string, teachers: any[], students: any[], parents?: any[], horariosDocentes: any[], directoryMetadata: any, courses?: any[], enrollments?: any[] }) {
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [showRegistrarForm, setShowRegistrarForm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  
  // Local state for optimistic updates
  const [localMetaData, setLocalMetaData] = useState(directoryMetadata || {})
  const isRestrictedSecretary = currentRole === 'secretary' && normalizeInstitutionName(institutionName) === LETAMENDI_NAME

  // Search & filter state
  const [searchTeachers, setSearchTeachers] = useState('')
  const [searchStudents, setSearchStudents] = useState('')
  const [searchParents, setSearchParents] = useState('')
  const [filterStudentCourse, setFilterStudentCourse] = useState('all')

  const [formData, setFormData] = useState({
    full_name: '',
    dni: '',
    email: '',
    password: '',
    role: 'student' as 'student' | 'teacher' | 'secretary' | 'supervisor' | 'rector',
    course_id: '',
    create_parent_account: false,
    parent_relationship: 'MADRE' as 'MADRE' | 'PADRE' | 'OTRO',
    parent_full_name: '',
    parent_dni: '',
    parent_email: '',
    parent_password: '',
    parent_phone: '',
  })
  const effectiveRole = isRestrictedSecretary ? 'student' : formData.role

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.full_name || !formData.password || !formData.dni) {
      return toast.error("Nombre, cédula y contraseña son obligatorios")
    }

    if (effectiveRole === 'student' && formData.create_parent_account) {
      if (!formData.parent_full_name || !formData.parent_dni || !formData.parent_password) {
        return toast.error("Para crear el acceso del representante necesitamos nombre, cédula y contraseña inicial")
      }
    }

    // Si no se pone correo, generar uno interno con la cédula
    const email = formData.email.trim() || `${formData.dni.trim()}@classnova.local`

    setLoading(true)
    const res = await createInstitutionUser({
      full_name: formData.full_name,
      dni: formData.dni,
      email,
      password: formData.password,
      role: effectiveRole,
      institution_id: institutionId,
      ...(effectiveRole === 'student' && formData.course_id ? { course_id: formData.course_id } : {}),
      ...(effectiveRole === 'student' && formData.create_parent_account ? {
        parentAccount: {
          full_name: formData.parent_full_name,
          dni: formData.parent_dni,
          email: formData.parent_email,
          password: formData.parent_password,
          phone: formData.parent_phone,
          relationship: formData.parent_relationship,
          is_primary: true,
        }
      } : {})
    })

    if (res.error) {
      toast.error(res.error)
    } else {
      const msg = effectiveRole === 'student'
        ? (formData.create_parent_account ? 'Estudiante y representante creados' : 'Estudiante creado/matriculado')
        : 
                  effectiveRole === 'teacher' ? 'Docente creado' :
                  effectiveRole === 'secretary' ? 'Secretaría creada' : 
                  effectiveRole === 'supervisor' ? 'Supervisor creado' : 'Rector creado'
      
      toast.success(`${msg} exitosamente`)
      if (res.warning) toast((res.warning as string), { icon: 'ℹ️' })
      setFormData({
        full_name: '', dni: '', email: '', password: '', role: 'student', course_id: '',
        create_parent_account: false, parent_relationship: 'MADRE',
        parent_full_name: '', parent_dni: '', parent_email: '', parent_password: '', parent_phone: ''
      })
      setShowRegistrarForm(false) // Close form on success
      // Next JS router refresh is handled by the server action's revalidatePath
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {!showRegistrarForm ? (
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Registro individual */}
          <div
            onClick={() => setShowRegistrarForm(true)}
            className="flex-1 flex justify-between items-center bg-[rgba(124,109,250,0.05)] border border-[rgba(124,109,250,0.2)] rounded-2xl p-5 cursor-pointer hover:bg-[rgba(124,109,250,0.08)] transition-all transform hover:scale-[1.01]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-violet2 flex text-white items-center justify-center shadow-[0_0_15px_rgba(124,109,250,0.5)]">
                <UserPlus size={20} />
              </div>
              <div>
                <h3 className="font-bold text-violet2 text-base drop-shadow-sm">
                  {isRestrictedSecretary ? 'Empadronar Nuevo Alumno' : 'Empadronar Nuevo Personal o Alumno'}
                </h3>
                <p className="text-sm text-ink3">
                  {isRestrictedSecretary ? 'Secretaría puede registrar únicamente estudiantes en esta institución.' : 'Registro individual con credenciales.'}
                </p>
              </div>
            </div>
            <button className="btn-primary text-sm px-5 py-2 font-bold tracking-wide flex-shrink-0">Abrir Registro</button>
          </div>

          {/* Importar desde Excel */}
          <div
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-4 bg-[rgba(38,215,180,0.05)] border border-[rgba(38,215,180,0.2)] rounded-2xl p-5 cursor-pointer hover:bg-[rgba(38,215,180,0.08)] transition-all transform hover:scale-[1.01] sm:w-64"
          >
            <div className="w-12 h-12 rounded-full bg-teal flex text-white items-center justify-center shadow-[0_0_15px_rgba(38,215,180,0.4)] flex-shrink-0">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="font-bold text-teal text-base">Importar desde Excel</h3>
              <p className="text-sm text-ink3">Carga masiva de estudiantes.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-[rgba(0,0,0,0.05)] p-6 shadow-xl animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-display font-bold text-lg flex items-center gap-2"><UserPlus size={18} className="text-violet2" /> Registro Seguro de Puerta Cerrada</h3>
              <p className="text-sm text-ink3 mt-1">Garantiza credenciales seguras y el alta sin exposición al público.</p>
            </div>
            <button onClick={() => setShowRegistrarForm(false)} className="text-ink4 hover:text-ink2 text-sm bg-bg px-4 py-2 rounded-lg border border-transparent hover:border-surface transition-all">Cancelar</button>
          </div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-bg/50 p-5 rounded-xl border border-[rgba(0,0,0,0.02)]">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Rol Asignado</label>
              <select value={effectiveRole} onChange={e => setFormData({...formData, role: e.target.value as any})} disabled={isRestrictedSecretary} className="input-base">
                <option value="student">Estudiante</option>
                {!isRestrictedSecretary && <option value="teacher">Profesor (Docente)</option>}
                {!isRestrictedSecretary && <option value="secretary">Secretaría / Administrativo</option>}
                {!isRestrictedSecretary && <option value="supervisor">Supervisor / Inspector</option>}
                {!isRestrictedSecretary && <option value="rector">Rector / Autoridad</option>}
              </select>
            </div>
            {isRestrictedSecretary && (
              <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                En Letamendi, el rol de secretaría solo puede crear alumnos desde este módulo.
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Nombre Completo</label>
              <input type="text" required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="Ej. Juan Pérez" className="input-base" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Cédula / DNI</label>
              <input type="text" required value={formData.dni} onChange={e => {
                const dni = e.target.value
                setFormData({...formData, dni, password: formData.password || dni })
              }} placeholder="09XXXXXXXX" className="input-base" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Correo Vinculado <span className="text-ink4 font-normal normal-case">(opcional)</span></label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Dejar vacío → ingresa con su cédula" className="input-base" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Contraseña Inicial <span className="text-ink4 font-normal normal-case">(por defecto: cédula)</span></label>
              <input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Se usa la cédula si no cambia" className="input-base" />
            </div>
            {formData.dni && (
              <div className="md:col-span-2 p-3 rounded-xl bg-[rgba(38,215,180,0.06)] border border-[rgba(38,215,180,0.15)]">
                <p className="text-[11px] font-bold text-teal uppercase tracking-wider mb-1">Credenciales de acceso:</p>
                <p className="text-sm text-ink2">
                  <span className="text-ink3">Usuario:</span> <strong>{formData.email || formData.dni}</strong>
                  <span className="text-ink4 mx-2">|</span>
                  <span className="text-ink3">Contraseña:</span> <strong>{formData.password || formData.dni}</strong>
                </p>
              </div>
            )}
            {effectiveRole === 'student' && courses.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Curso a Matricular</label>
                <select value={formData.course_id} onChange={e => setFormData({...formData, course_id: e.target.value})} className="input-base">
                  <option value="">Sin asignar (matricular después)</option>
                  {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.parallel}</option>)}
                </select>
                <p className="text-[10px] text-ink4">Se matriculará automáticamente al guardar.</p>
              </div>
            )}
            {effectiveRole === 'student' && (
              <div className="md:col-span-2 rounded-2xl border border-[rgba(124,109,250,0.12)] bg-[rgba(124,109,250,0.04)] p-4 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.create_parent_account}
                    onChange={e => setFormData({
                      ...formData,
                      create_parent_account: e.target.checked,
                      parent_password: e.target.checked ? (formData.parent_password || formData.parent_dni || '') : formData.parent_password,
                    })}
                    className="h-4 w-4 rounded border-surface2 text-violet2 focus:ring-violet2"
                  />
                  <div>
                    <p className="text-sm font-bold text-violet2">Crear acceso para representante</p>
                    <p className="text-xs text-ink3">Genera credenciales propias para el padre, madre o tutor legal del estudiante.</p>
                  </div>
                </label>

                {formData.create_parent_account && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Tipo de representante</label>
                      <select
                        value={formData.parent_relationship}
                        onChange={e => setFormData({ ...formData, parent_relationship: e.target.value as 'MADRE' | 'PADRE' | 'OTRO' })}
                        className="input-base"
                      >
                        <option value="MADRE">Madre</option>
                        <option value="PADRE">Padre</option>
                        <option value="OTRO">Tutor / Otro</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Nombre completo</label>
                      <input
                        type="text"
                        value={formData.parent_full_name}
                        onChange={e => setFormData({ ...formData, parent_full_name: e.target.value })}
                        placeholder="Ej. Ana Villamar"
                        className="input-base"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Cédula / DNI</label>
                      <input
                        type="text"
                        value={formData.parent_dni}
                        onChange={e => setFormData({
                          ...formData,
                          parent_dni: e.target.value,
                          parent_password: formData.parent_password || e.target.value,
                        })}
                        placeholder="09XXXXXXXX"
                        className="input-base"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Correo del representante <span className="text-ink4 font-normal normal-case">(opcional)</span></label>
                      <input
                        type="email"
                        value={formData.parent_email}
                        onChange={e => setFormData({ ...formData, parent_email: e.target.value })}
                        placeholder="Dejar vacío → ingresa con su cédula"
                        className="input-base"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Teléfono</label>
                      <input
                        type="text"
                        value={formData.parent_phone}
                        onChange={e => setFormData({ ...formData, parent_phone: e.target.value })}
                        placeholder="+593 9..."
                        className="input-base"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink3 uppercase tracking-wider">Contraseña inicial</label>
                      <input
                        type="text"
                        value={formData.parent_password}
                        onChange={e => setFormData({ ...formData, parent_password: e.target.value })}
                        placeholder="Por defecto: cédula"
                        className="input-base"
                      />
                    </div>

                    {formData.parent_dni && (
                      <div className="md:col-span-2 p-3 rounded-xl bg-white border border-[rgba(124,109,250,0.12)]">
                        <p className="text-[11px] font-bold text-violet2 uppercase tracking-wider mb-1">Credenciales del representante:</p>
                        <p className="text-sm text-ink2">
                          <span className="text-ink3">Usuario:</span> <strong>{formData.parent_email || formData.parent_dni}</strong>
                          <span className="text-ink4 mx-2">|</span>
                          <span className="text-ink3">Contraseña:</span> <strong>{formData.parent_password || formData.parent_dni}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="md:col-span-2 mt-4 pt-4 border-t border-[rgba(0,0,0,0.05)]">
               <button type="submit" disabled={loading} className="w-full btn-primary py-3.5 flex items-center justify-center gap-2">
                 {loading ? 'Sincronizando Base de Datos...' : <><Plus size={18}/> Validar y Empadronar Cuenta</>}
               </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ── PERSONAL / DOCENTES ── */}
        <div className="bg-bg border border-surface rounded-2xl p-5">
           <h4 className="font-bold mb-3 text-violet2 uppercase text-xs tracking-wider">Personal de la Institución ({teachers.length})</h4>
           <input
             type="text"
             value={searchTeachers}
             onChange={e => setSearchTeachers(e.target.value)}
             placeholder="🔍 Buscar docente..."
             className="input-base w-full text-xs mb-3"
           />
           {(() => {
             const q = searchTeachers.toLowerCase().trim()
             const filtered = teachers
               .filter(t => {
                 if (!q) return true
                 return (t.full_name || '').toLowerCase().includes(q) || (t.email || '').toLowerCase().includes(q)
               })
               .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
             return (
               <>
                 {q && <p className="text-[10px] text-ink4 mb-2">{filtered.length} de {teachers.length} encontrados</p>}
                 <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                   {filtered.map(t => {
                     const meta = localMetaData[t.id] || {}
                     return (
                     <div key={t.id} onClick={() => setSelectedUser(t)} className="p-3 bg-surface rounded-xl border border-[rgba(0,0,0,0.02)] cursor-pointer hover:bg-[rgba(124,109,250,0.05)] transition-colors flex items-center gap-3">
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
                   {filtered.length === 0 && <p className="text-xs text-ink4 italic text-center py-4">{q ? 'Sin resultados' : 'Sin profesores verificados.'}</p>}
                 </div>
               </>
             )
           })()}
        </div>

        {/* ── ALUMNOS ── */}
        <div className="bg-bg border border-surface rounded-2xl p-5">
           <h4 className="font-bold mb-3 text-teal">Alumnos Inscritos ({students.length})</h4>
           <input
             type="text"
             value={searchStudents}
             onChange={e => setSearchStudents(e.target.value)}
             placeholder="🔍 Buscar alumno..."
             className="input-base w-full text-xs mb-2"
           />
           {courses.length > 0 && (
             <select
               value={filterStudentCourse}
               onChange={e => setFilterStudentCourse(e.target.value)}
               className="input-base w-full text-xs mb-3"
             >
               <option value="all">Todos los cursos</option>
               {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.parallel}</option>)}
             </select>
           )}
           {(() => {
             const q = searchStudents.toLowerCase().trim()
             const filtered = students
               .filter(s => {
                 if (filterStudentCourse !== 'all') {
                   const enrolled = (enrollmentsRef || []).some((e: any) => e.student_id === s.id && e.course_id === filterStudentCourse)
                   if (!enrolled) return false
                 }
                 if (!q) return true
                 return (s.full_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
               })
               .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
             return (
               <>
                 {(q || filterStudentCourse !== 'all') && <p className="text-[10px] text-ink4 mb-2">{filtered.length} de {students.length} encontrados</p>}
                 <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                   {filtered.map(s => {
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
                   {filtered.length === 0 && <p className="text-xs text-ink4 italic text-center py-4">{q || filterStudentCourse !== 'all' ? 'Sin resultados' : 'Sin alumnos verificados.'}</p>}
                 </div>
               </>
             )
           })()}
         </div>

        {/* ── REPRESENTANTES ── */}
        <div className="bg-bg border border-surface rounded-2xl p-5">
           <h4 className="font-bold mb-3 text-amber-500 uppercase text-xs tracking-wider">Representantes ({parents.length})</h4>
           <input
             type="text"
             value={searchParents}
             onChange={e => setSearchParents(e.target.value)}
             placeholder="🔍 Buscar representante..."
             className="input-base w-full text-xs mb-3"
           />
           {(() => {
             const q = searchParents.toLowerCase().trim()
             const filtered = parents
               .filter(p => {
                 if (!q) return true
                 return (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
               })
               .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
             return (
               <>
                 {q && <p className="text-[10px] text-ink4 mb-2">{filtered.length} de {parents.length} encontrados</p>}
                 <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                   {filtered.map(p => {
                     const meta = localMetaData[p.id] || {}
                     return (
                     <div key={p.id} onClick={() => setSelectedUser(p)} className="p-3 bg-[rgba(248,210,90,0.08)] rounded-xl border border-[rgba(248,210,90,0.18)] cursor-pointer hover:bg-[rgba(248,210,90,0.13)] transition-colors flex items-center gap-3">
                       {meta.avatar_url ? (
                         <img src={meta.avatar_url} className="w-10 h-10 rounded-full object-cover border border-amber-400" />
                       ) : (
                         <div className="w-10 h-10 rounded-full bg-[rgba(248,210,90,0.18)] flex items-center justify-center text-amber-600 font-bold text-xs">{p.full_name.charAt(0)}</div>
                       )}
                       <div>
                         <p className="font-medium text-sm">{p.full_name}</p>
                         <p className="text-xs text-ink4">{p.email}</p>
                       </div>
                     </div>
                     )
                   })}
                   {filtered.length === 0 && <p className="text-xs text-ink4 italic text-center py-4">{q ? 'Sin resultados' : 'Sin representantes con acceso aún.'}</p>}
                 </div>
               </>
             )
           })()}
         </div>
      </div>

      {selectedUser && (
        <ProfileDetailsPanel
          user={selectedUser}
          metadata={localMetaData[selectedUser.id] || {}}
          institutionId={institutionId}
          currentRole={currentRole}
          institutionName={institutionName}
          onClose={() => setSelectedUser(null)}
          onUpdate={(newMeta) => setLocalMetaData((prev:any) => ({ ...prev, [selectedUser.id]: newMeta }))}
        />
      )}

      {showImportModal && (
        <ImportarEstudiantesModal
          institutionId={institutionId}
          courses={courses}
          onClose={() => setShowImportModal(false)}
          onDone={() => window.location.reload()}
        />
      )}
    </div>
  )
}
