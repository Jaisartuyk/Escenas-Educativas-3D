const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function test() {
  const { data: profile } = await supabase.from('profiles').select('*').limit(1).single()
  console.log('Profile found:', profile.id, 'Institution:', profile.institution_id)

  const { data: inst } = await supabase.from('institutions').select('settings').eq('id', profile.institution_id).single()
  
  const payload = {
    config: { recesos: [4, 6], cursos: ['8vo'], horarios: [], nPeriodos: 8, anio: '2024', jornada: 'MATUTINA' },
    docentes: [
      { id: profile.id, materias: ['Matematicas'] }
    ]
  }

  const { error: err1 } = await supabase
    .from('institutions')
    .update({ settings: { ...inst.settings, horarios: payload } })
    .eq('id', profile.institution_id)
    
  console.log('Update settings error:', err1)

  // Simulation of subject sync
  try {
     const { data: existingSubjects } = await supabase.from('subjects').select('*').eq('institution_id', profile.institution_id)
     console.log('Existing subjects length:', existingSubjects?.length)
     
     const crypto = require('crypto')
     const { error: subErr } = await supabase.from('subjects').insert([{
       id: crypto.randomUUID(),
       institution_id: profile.institution_id,
       name: 'Matematicas Test',
       teacher_id: profile.id
     }])
     
     console.log('Insert subject error:', subErr)
  } catch (e) {
     console.log('Crash:', e)
  }
}

test()
