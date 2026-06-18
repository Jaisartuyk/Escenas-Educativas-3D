import { createAdminClient } from './src/lib/supabase/admin'

async function check() {
  const admin = createAdminClient()
  
  // Find Anita Perez
  const { data: students } = await admin
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', '%ANITA PEREZ%')
    
  console.log('Students found:', students)
  
  if (students && students.length > 0) {
    const studentId = students[0].id
    const { data: payments } = await admin
      .from('payments' as any)
      .select('*')
      .eq('student_id', studentId)
      
    console.log('Payments for ANITA PEREZ:', payments)
  }
}

check()
