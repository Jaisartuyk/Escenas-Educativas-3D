import fs from 'fs';

const data = JSON.parse(fs.readFileSync('tmp/letamendi_data.json', 'utf8'));

const teacherHours = {};
data.subjects.forEach(s => {
  if (s.teacher_id) {
    const name = data.teachers.find(t => t.id === s.teacher_id)?.full_name || 'Desconocido';
    teacherHours[name] = (teacherHours[name] || 0) + s.weekly_hours;
  }
});

let output = '| Docente | Horas Docencia Semanal | Estado de Carga |\n';
output += '|---|---|---|\n';
Object.entries(teacherHours).sort((a,b) => b[1] - a[1]).forEach(([name, hours]) => {
  let rec = 'Carga Óptima (20-30h)';
  if (hours > 30) rec = '⚠️ **Sobrecarga** (>30h). Difícil de cuadrar.';
  if (hours < 15) rec = 'Baja carga (<15h).';
  output += `| ${name} | ${hours}h | ${rec} |\n`;
});

fs.writeFileSync('tmp/teacher_analysis.txt', output);
console.log('Results saved to tmp/teacher_analysis.txt');
