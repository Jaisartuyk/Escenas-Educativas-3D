// src/types/horarios.ts

export type Dia = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes'

export interface Docente {
  id:       string
  titulo:   string
  nombre:   string
  materias: string[]
  jornada?: 'MATUTINA' | 'VESPERTINA' | 'AMBAS'
  nivel?:   'Escuela' | 'Colegio' | 'AMBOS'
}

export interface InstitucionConfig {
  nombre:    string
  anio:      string
  jornada:   'MATUTINA' | 'VESPERTINA'
  nivel?:    'Colegio' | 'Escuela'
  nPeriodos: number
  cursos:    string[]
  horarios:  string[]   // label de cada período, ej. "07:00-07:45"
  recesos:   number[]   // array of indexes that are breaks (e.g. [4])
  tutores:   Record<string, string>  // curso → nombre tutor
}

// { curso → { materia → horas_semanales } }
export type HorasPorCurso = Record<string, Record<string, number>>

// { curso → { dia → materia[] (length = nPeriodos) } }
export type HorarioGrid = Record<string, Record<Dia, string[]>>

export interface HorariosState {
  config:        InstitucionConfig
  docentes:      Docente[]
  horasPorCurso: HorasPorCurso
  horario:       HorarioGrid
  step:          number
  docentePorCurso?: Record<string, Record<string, string>>
}

export const DIAS: Dia[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

export const TODAS_MATERIAS = [
  'LENGUA', 'MATEMATICA', 'FISICA', 'QUIMICA', 'BIOLOGIA', 'CC.NN',
  'EE.SS', 'HISTORIA', 'FILOSOFIA', 'CIUDADANIA', 'INGLES', 'ECA',
  'COMPUTACION', 'ROBOTICA', 'ED. FISICA', 'INST. FORMAL', 'EMPRENDIMIENTO',
]

export const HORARIOS_VESPERTINA = [
  '12:45-13:30', '13:30-14:15', '14:15-15:00', '15:00-15:45',
  '15:45-16:10', '16:10-16:55', '16:55-17:40', '17:40-18:20',
]

export const HORARIOS_MATUTINA = [
  '07:00-07:45', '07:45-08:30', '08:30-09:15', '09:15-10:00',
  '10:00-10:30', '10:30-11:15', '11:15-12:00', '12:00-12:45',
]

export const DEFAULT_CURSOS_ESCUELA = [
  'INICIAL 1', 'INICIAL 2',
  '1RO BÁSICA', '2DO BÁSICA', '3RO BÁSICA', '4TO BÁSICA', '5TO BÁSICA', '6TO BÁSICA', '7MO BÁSICA',
]

export const DEFAULT_CURSOS_COLEGIO = [
  '8VO', '9NO', '10MO', '1ERO BGU', '2DO BGU', '3ERO BGU'
]

export const DEFAULT_DOCENTES: Docente[] = [
  { id: '1', titulo: 'Ing.',  nombre: 'Giler Tapia, Oswaldo Xavier',   materias: ['MATEMATICA', 'FISICA'], jornada: 'AMBAS', nivel: 'Colegio' },
  { id: '2', titulo: 'Lcdo.', nombre: 'Parrales Alfredo Juan',          materias: ['EE.SS', 'HISTORIA', 'FILOSOFIA'], jornada: 'AMBAS', nivel: 'Colegio' },
  { id: '3', titulo: 'Msc.',  nombre: 'Cedeño Carvajal, José Luis',     materias: ['ECA', 'CIUDADANIA', 'EMPRENDIMIENTO'], jornada: 'AMBAS', nivel: 'AMBOS' },
  { id: '4', titulo: 'Lcdo.', nombre: 'Haz Bernal, Barkly',             materias: ['INGLES'], jornada: 'AMBAS', nivel: 'AMBOS' },
  { id: '5', titulo: 'Lcdo.', nombre: 'Palacios Nieto, George Steven',  materias: ['ROBOTICA'], jornada: 'AMBAS', nivel: 'AMBOS' },
  { id: '6', titulo: 'Lcdo.', nombre: 'Yagual Sánchez, Johnny Luis',    materias: ['COMPUTACION'], jornada: 'AMBAS', nivel: 'Colegio' },
  { id: '7', titulo: 'Prof.', nombre: 'Bustamante Vera, Ana María',     materias: ['LENGUA', 'MATEMATICA', 'CC.NN', 'EE.SS'], jornada: 'MATUTINA', nivel: 'Escuela' },
]

export const DEFAULT_HORAS: HorasPorCurso = {
  '8VO':      { LENGUA:5, MATEMATICA:5, 'EE.SS':3, 'CC.NN':2, BIOLOGIA:2, QUIMICA:2, INGLES:5, ECA:2, CIUDADANIA:2, COMPUTACION:2, ROBOTICA:2, 'ED. FISICA':2, 'INST. FORMAL':2, EMPRENDIMIENTO:2 },
  '9NO':      { LENGUA:5, MATEMATICA:5, 'EE.SS':3, 'CC.NN':2, BIOLOGIA:2, QUIMICA:2, INGLES:5, ECA:2, CIUDADANIA:2, COMPUTACION:2, ROBOTICA:2, 'ED. FISICA':2, 'INST. FORMAL':2, EMPRENDIMIENTO:2 },
  '10MO':     { LENGUA:5, MATEMATICA:5, 'EE.SS':3, 'CC.NN':2, BIOLOGIA:2, QUIMICA:2, INGLES:5, ECA:2, CIUDADANIA:2, COMPUTACION:2, ROBOTICA:2, 'ED. FISICA':2, 'INST. FORMAL':2, EMPRENDIMIENTO:2 },
  '1ERO BGU': { LENGUA:5, MATEMATICA:5, HISTORIA:3, BIOLOGIA:3, QUIMICA:3, FISICA:3, INGLES:5, ECA:2, CIUDADANIA:2, COMPUTACION:2, ROBOTICA:2, 'ED. FISICA':2, 'INST. FORMAL':2, EMPRENDIMIENTO:2 },
  '2DO BGU':  { LENGUA:5, MATEMATICA:5, HISTORIA:3, BIOLOGIA:2, QUIMICA:3, FISICA:3, INGLES:4, ECA:2, CIUDADANIA:2, COMPUTACION:2, ROBOTICA:2, 'ED. FISICA':2, 'INST. FORMAL':2, EMPRENDIMIENTO:3 },
  '3ERO BGU': { LENGUA:5, MATEMATICA:5, HISTORIA:3, BIOLOGIA:3, QUIMICA:3, FISICA:3, INGLES:4, ECA:2, CIUDADANIA:2, COMPUTACION:2, ROBOTICA:2, 'ED. FISICA':2, 'INST. FORMAL':2, EMPRENDIMIENTO:2 },
}

// Configuración predeterminada limpia para una nueva institución
export function getEmptyConfig(institutionName: string): InstitucionConfig {
  return {
    nombre:    institutionName,
    anio:      new Date().getFullYear() + ' - ' + (new Date().getFullYear() + 1),
    jornada:   'VESPERTINA', // Default safe
    nivel:     'Colegio',
    nPeriodos: 8,
    cursos:    ['8VO', '9NO', '10MO', '1ERO BGU', '2DO BGU', '3ERO BGU'], // Default Mineduc
    horarios:  HORARIOS_VESPERTINA,
    recesos:   [4], // By default, index 4 is the break
    tutores:   {}, // Vacío para que el usuario asigne a sus propios docentes
  }
}

export const DEFAULT_CONFIG: InstitucionConfig = {
  nombre:    'UNIDAD EDUCATIVA PARTICULAR LICEO "24 DE JULIO"',
  anio:      '2026 - 2027',
  jornada:   'VESPERTINA',
  nivel:     'Colegio',
  nPeriodos: 8,
  cursos:    ['8VO', '9NO', '10MO', '1ERO BGU', '2DO BGU', '3ERO BGU'],
  horarios:  HORARIOS_VESPERTINA,
  recesos:   [4],
  tutores: {
    '8VO':       'Ing. Giler Tapia, Oswaldo Xavier',
    '9NO':       'Jhonny Yagual Sanchez',
    '10MO':      'Msc. Cedeño Carvajal José Luis',
    '1ERO BGU':  'Lcdo. Parrales Alfredo Juan',
    '2DO BGU':   '—',
    '3ERO BGU':  'Lcdo. Haz Bernal Barkly',
  },
}
