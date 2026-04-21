import fs from 'fs';

const data = JSON.parse(fs.readFileSync('tmp/letamendi_data.json', 'utf8'));

const colegioCourses = [
  { id: '46337fc2-03ff-474c-b3b0-f20605695ae0', name: '8VO' },
  { id: 'fc88bde9-7d46-4f31-98f5-fb504effadaa', name: '9NO' },
  { id: '15c617eb-a402-4590-aad7-23fdae482bc6', name: '10MO' },
  { id: 'a0976a80-92be-4ef2-8a96-827e18c6386d', name: '1ERO BGU' },
  { id: 'ec1fc70b-1849-4e12-9462-f78c671df04f', name: '2DO BGU' },
  { id: '4846e066-1c7f-415c-a26e-85e04fca802e', name: '3ERO BGU' }
];

let output = '| Curso | Horas Asignadas | Faltantes (para 39) | Materias Críticas (SIN DOCENTE) |\n';
output += '|---|---|---|---|\n';

colegioCourses.forEach(c => {
  const subjects = data.subjects.filter(s => s.course_id === c.id);
  const totalHours = subjects.reduce((acc, s) => acc + s.weekly_hours, 0);
  const diff = 39 - totalHours;
  const noTeacher = subjects.filter(s => !s.teacher_id).map(s => s.name).join(', ');
  
  output += `| ${c.name} | ${totalHours}h | ${diff}h | ${noTeacher} |\n`;
});

fs.writeFileSync('tmp/analysis_results.txt', output);
console.log('Results saved to tmp/analysis_results.txt');
