import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://dwilhgtgwykwutdianjd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3aWxoZ3Rnd3lrd3V0ZGlhbmpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYyMzI3MiwiZXhwIjoyMDkwMTk5MjcyfQ.3Rlblx2GHGrzoS3LoWWM1UcPSuGUCVfTMsiUsB0_aVI';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const LETAMENDI = '52572a7d-ba27-477b-8020-20d882cc30bb';

async function checkData() {
  try {
    const { data: config } = await admin.from('schedule_configs').select('*').eq('institution_id', LETAMENDI).single();
    const { data: courses } = await admin.from('courses').select('id, name').eq('institution_id', LETAMENDI);
    const courseIds = courses.map(c => c.id);
    const { data: subjects } = await admin.from('subjects').select('id, name, weekly_hours, teacher_id, course_id').in('course_id', courseIds);
    const { data: teachers } = await admin.from('profiles').select('id, full_name').eq('institution_id', LETAMENDI).eq('role', 'teacher');

    const result = { config, courses, subjects, teachers };
    fs.writeFileSync('tmp/letamendi_data.json', JSON.stringify(result, null, 2));
    console.log('Data saved to tmp/letamendi_data.json');
  } catch (err) {
    console.error(err);
  }
}

checkData();
