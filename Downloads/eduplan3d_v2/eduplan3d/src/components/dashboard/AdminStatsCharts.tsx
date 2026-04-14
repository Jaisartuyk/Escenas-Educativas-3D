'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'

interface Props {
  data: {
    planningTrend: any[]
    contentDistribution: any[]
    attendanceByLevel: any[]
    roleDistribution: any[]
  }
}

const COLORS = ['#7C6DFA', '#26D7B4', '#FFB347', '#F06292', '#4FC3F7']

export function AdminStatsCharts({ data }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      
      {/* 📈 Tendencia de Planificación */}
      <div className="card p-6 flex flex-col h-[400px]">
        <h3 className="font-display text-sm font-bold mb-6 flex items-center gap-2">
          <span>📈</span> Actividad de Planificación (Últimos 14 días)
        </h3>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.planningTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,100,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#64748B' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#64748B' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFF', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(120,100,255,0.14)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  fontSize: '12px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#7C6DFA" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#7C6DFA', strokeWidth: 2, stroke: '#FFF' }}
                activeDot={{ r: 6 }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 📊 Asistencia por Nivel */}
      <div className="card p-6 flex flex-col h-[400px]">
        <h3 className="font-display text-sm font-bold mb-6 flex items-center gap-2">
          <span>🏫</span> Asistencia por Nivel Educativo (%)
        </h3>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.attendanceByLevel}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,100,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="level" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#64748B' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#64748B' }}
                domain={[0, 100]}
              />
              <Tooltip 
                 cursor={{ fill: 'rgba(124,109,250,0.05)' }}
                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar 
                dataKey="percentage" 
                fill="#26D7B4" 
                radius={[6, 6, 0, 0]} 
                barSize={40}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 🍰 Distribución de Contenido */}
      <div className="card p-6 flex flex-col h-[350px]">
        <h3 className="font-display text-sm font-bold mb-6 flex items-center gap-2">
          <span>🎯</span> Tipos de Documentos Generados
        </h3>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.contentDistribution}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={8}
                dataKey="value"
                animationDuration={1500}
              >
                {data.contentDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 👥 Usuarios Registrados */}
      <div className="card p-6 flex flex-col h-[350px]">
        <h3 className="font-display text-sm font-bold mb-6 flex items-center gap-2">
          <span>👥</span> Composición de la Institución
        </h3>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={data.roleDistribution}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#64748B' }}
                width={80}
              />
              <Tooltip cursor={{ fill: 'none' }} />
              <Bar 
                dataKey="count" 
                fill="#7C6DFA" 
                radius={[0, 6, 6, 0]} 
                barSize={24}
                animationDuration={1500}
              >
                {data.roleDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}
