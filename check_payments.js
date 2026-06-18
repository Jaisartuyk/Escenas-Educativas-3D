const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  // Find Anita Perez
  const { data: students, error: sErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', '%ANITA PEREZ%')
    
  if (sErr) console.error(sErr)
  console.log('Students found:', students)
  
  if (students && students.length > 0) {
    const studentId = students[0].id
    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      
    if (pErr) console.error(pErr)
    console.log('Payments for ANITA PEREZ:', payments)
  }
}

check()
