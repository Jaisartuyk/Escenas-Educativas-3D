
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');
const processEnv = {};
for (const line of env) {
  if (line.includes('=')) {
    const [key, ...val] = line.split('=');
    processEnv[key.trim()] = val.join('=').trim();
  }
}

const supabase = createClient(
  processEnv.NEXT_PUBLIC_SUPABASE_URL,
  processEnv.SUPABASE_SERVICE_ROLE_KEY
);

const searchTerms = [
  'Yance Robles Daphne', 'Pin Hidalgo Carolina', 'Sanchez Lopez Adriana',
  'Manzano Eduardo', 'Manzano Muñoz Eduardo', 'Chalen Gean', 'Calderon', 
  'Gonzalez Plaza Elian', 'Saigua Adriana', 'Sayga Adriana', 'Celi Aron', 'Hurtado Vera',
  'Marquez', 'Leon Vera Chloe', 'Bravo Karla', 'Segura larrea', 'Segura',
  'Veloz Vargas Axel', 'Mejia Fraijo', 'Cruz Santo Julieth', 'Jaime Lopez Dana',
  'Franco Bohorquez Dario', 'Alvarado Quispe Eithan', 'Engracia Loor Hector', 'Espinoza Jhon',
  'Cagua Veliz Darik', 'Mosquera Yarik', 'Freire Lino Luana', 'Lindao Ramirez',
  'Chalen Pincay', 'Mosquera', 'Borbor Granados', 'Marichena', 'Cercado'
];

async function run() {
  const { data: inst } = await supabase.from('institutions').select('id, name, settings').eq('name', 'UNIDAD EDUCATIVA PARTICULAR CORONEL MIGUEL DE LETAMENDI').single();
  const { data: students } = await supabase.from('profiles').select('id, full_name').eq('institution_id', inst.id).eq('role', 'student');
  
  const directory = (inst.settings || {}).directory || {};
  const matchedStudents = new Set();
  const safeParentIds = new Set();

  for (const student of (students||[])) {
    if (!student.full_name) continue;
    let name = student.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const term of searchTerms) {
      let normTerm = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const parts = normTerm.split(' ').filter(Boolean);
      if (parts.every(p => name.includes(p))) {
        matchedStudents.add(student);
        const meta = directory[student.id] || {};
        if (meta.mother_parent_user_id) safeParentIds.add(meta.mother_parent_user_id);
        if (meta.father_parent_user_id) safeParentIds.add(meta.father_parent_user_id);
        if (meta.other_parent_user_id) safeParentIds.add(meta.other_parent_user_id);
      }
    }
  }

  const { data: parents } = await supabase.from('profiles').select('id, full_name, email').eq('institution_id', inst.id).eq('role', 'parent');
  
  const safeParents = (parents||[]).filter(p => safeParentIds.has(p.id));

  console.log('\n--- DESBLOQUEANDO PADRES A SALVO ---');
  let successCount = 0;
  for (const p of safeParents) {
    console.log('Unbanning: ' + p.full_name);
    const { error } = await supabase.auth.admin.updateUserById(p.id, { ban_duration: 'none' });
    if (error) {
      console.error('Error unbanning ' + p.id + ':', error.message);
    } else {
      successCount++;
    }
  }
  
  console.log('\n--- RESUMEN FINAL ---');
  console.log('Alumnos Encontrados totales: ' + matchedStudents.size);
  console.log('Padres DESBLOQUEADOS (asegurados): ' + successCount);
}

run().catch(console.error);

