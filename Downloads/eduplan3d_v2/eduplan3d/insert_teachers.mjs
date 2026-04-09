import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan credenciales de Supabase en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const institutionId = '3734e510-a6de-4e4f-87b1-772556bf0070';

async function run() {
  console.log(`Buscando institución: ${institutionId}`);
  
  const { data: inst, error: fetchErr } = await supabase
    .from('institutions')
    .select('settings')
    .eq('id', institutionId)
    .single();

  if (fetchErr) {
    console.error("Error obteniendo la institución:", fetchErr);
    return;
  }

  let settings = inst.settings || {};
  let horarios = settings.horarios || {
    config: {
      institutionName: 'Unidas Educativa "24 de Julio"',
      academicYear: '2026 - 2027',
      shift: 'Vespertina',
      periodsPerDay: 8,
      breakAfterPeriod: 4,
      daysPerWeek: 5
    },
    horasPorCurso: {},
    horario: {}
  };

  const nuevosDocentes = [
    {
      id: "doc-1",
      name: "Ing. Giler Tapia, Oswaldo Xavier",
      area: "Ciencias Exactas",
      maxHours: 35,
      subjects: ["MATEMATICA", "FISICA"]
    },
    {
      id: "doc-2",
      name: "Lcdo. Parrales Alfredo Juan",
      area: "Ciencias Sociales",
      maxHours: 35,
      subjects: ["EE.SS", "HISTORIA"]
    },
    {
      id: "doc-3",
      name: "Msc. Cedeño Carvajal, José Luis",
      area: "General",
      maxHours: 35,
      subjects: ["ECA", "CIUDADANIA", "EMPRENDIMIENTO"]
    },
    {
      id: "doc-4",
      name: "Lcdo. Haz Bernal, Barkly",
      area: "Idiomas",
      maxHours: 35,
      subjects: ["INGLES"]
    },
    {
      id: "doc-5",
      name: "Lcdo. Palacios Nieto, George Steven",
      area: "Tecnología",
      maxHours: 35,
      subjects: ["ROBOTICA"]
    },
    {
      id: "doc-6",
      name: "Lcdo. Yagual Sánchez, Johnny Luis",
      area: "Tecnología",
      maxHours: 35,
      subjects: ["COMPUTACION"]
    }
  ];

  horarios.docentes = nuevosDocentes;
  settings.horarios = horarios;

  const { error: updateErr } = await supabase
    .from('institutions')
    .update({ settings })
    .eq('id', institutionId);

  if (updateErr) {
    console.error("Error al guardar docentes:", updateErr);
  } else {
    console.log("¡Docentes insertados correctamente en el JSON de Horarios de la Institución!");
  }
}

run();
