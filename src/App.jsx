import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Importar from './pages/Importar.jsx'
import Colaboradores from './pages/Colaboradores.jsx'
import Capacitaciones from './pages/Capacitaciones.jsx'
import Presupuesto from './pages/Presupuesto.jsx'
import Traslados from './pages/Traslados.jsx'
import Participantes from './pages/Participantes.jsx'
import Reportes from './pages/Reportes.jsx'
import ImportarCapacitaciones from './pages/ImportarCapacitaciones.jsx'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function App() {
  const [pagina, setPagina] = useState('dashboard')
  const [anio, setAnio] = useState('todos')
  const [stats, setStats] = useState({
    capacitaciones: 0,
    colaboradores: 0,
    participantes: 0,
    horas: 0,
    presupuesto: 0
  })
  const [cargando, setCargando] = useState(false)

  useEffect(() => { cargarStats() }, [anio])

  async function cargarStats() {
    setCargando(true)

    // 1. Obtener capacitaciones filtradas por año
    let qCap = supabase
      .from('capacitaciones')
      .select('id, nombre, horas, fecha_inicio')

    if (anio !== 'todos') {
      qCap = qCap
        .gte('fecha_inicio', `${anio}-01-01`)
        .lte('fecha_inicio', `${anio}-12-31`)
    }

    const { data: capsData } = await qCap

    // Capacitaciones únicas por nombre
    const nombresUnicos = new Set(capsData?.map(c => c.nombre?.trim()) || [])
    const totalCaps = nombresUnicos.size

    // IDs de capacitaciones del período
    const capIds = capsData?.map(c => c.id) || []

    // Mapa de horas por capacitación ID
    const horasPorCapId = {}
    capsData?.forEach(c => { horasPorCapId[c.id] = Number(c.horas || 0) })

    // 2. Obtener participantes de esas capacitaciones
    let totalHoras = 0
    let correosUnicos = new Set()
    let totalPart = 0

    if (capIds.length > 0) {
      // Supabase tiene límite de 1000 en IN, hacemos lotes
      const lote = 200
      for (let i = 0; i < capIds.length; i += lote) {
        const batch = capIds.slice(i, i + lote)
        const { data: partsData } = await supabase
          .from('participantes')
          .select('colaborador_id, capacitacion_id, colaboradores(correo)')
          .in('capacitacion_id', batch)

        partsData?.forEach(p => {
          totalPart++
          // Horas = horas de la capacitación × cada participante
          totalHoras += horasPorCapId[p.capacitacion_id] || 0
          // Correo único
          const correo = p.colaboradores?.correo?.toLowerCase().trim()
          if (correo && correo !== '-' && correo.includes('@')) {
            correosUnicos.add(correo)
          }
        })
      }
    }

    // 3. Presupuesto ejecutado (sin filtro de año por ahora)
    const { data: preData } = await supabase
      .from('presupuesto')
      .select('importe')
      .eq('cd', 'CR')

    const totalPre = preData?.reduce((s, r) => s + Number(r.importe), 0) || 0

    setStats({
      capacitaciones: totalCaps,
      colaboradores: correosUnicos.size,
      participantes: totalPart,
      horas: totalHoras,
      presupuesto: totalPre
    })
    setCargando(false)
  }

  const menuItems = [
    { id: 'dashboard',               label: '📊 Dashboard' },
    { id: 'capacitaciones',          label: '🎓 Capacitaciones' },
    { id: 'participantes',           label: '👥 Participantes' },
    { id: 'presupuesto',             label: '💰 Presupuesto' },
    { id: 'traslados',               label: '↔️ Traslados' },
    { id: 'colaboradores',           label: '📋 Colaboradores' },
    { id: 'reportes',                label: '📄 Reportes' },
    { id: 'importar',                label: '📥 Importar colaboradores' },
    { id: 'importar-capacitaciones', label: '📤 Importar capacitaciones' },
  ]

  function irA(id) {
    setPagina(id)
    if (id === 'dashboard') cargarStats()
  }

  const paginasActivas = [
    'dashboard', 'importar', 'colaboradores', 'capacitaciones',
    'presupuesto', 'traslados', 'participantes', 'reportes',
    'importar-capacitaciones'
  ]

  const anios = ['todos', '2026', '2025', '2024', '2023', '2022']

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>

      {/* Menú lateral */}
      <div style={{ width: '230px', background: '#1B2560', color: 'white', padding: '20px 0', flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            <span style={{ color: '#F59E0B' }}>Control</span>Cap
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
            Universidad Corporativa
          </div>
        </div>
        <nav style={{ padding: '10px 0' }}>
          {menuItems.map(item => (
            <div key={item.id} onClick={() => irA(item.id)}
              style={{
                padding: '9px 20px', cursor: 'pointer',
                background: pagina === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                borderLeft: pagina === item.id ? '3px solid #F59E0B' : '3px solid transparent',
                fontSize: '13px',
              }}>
              {item.label}
            </div>
          ))}
        </nav>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, background: '#F8FAFC', overflow: 'auto' }}>

        {/* Header */}
        <div style={{ background: 'white', padding: '15px 30px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '18px', fontWeight: '500' }}>
            {menuItems.find(m => m.id === pagina)?.label.split(' ').slice(1).join(' ') || pagina}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pagina === 'dashboard' && (
              <>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>Año:</span>
                {anios.map(a => (
                  <button key={a} onClick={() => setAnio(a)}
                    style={{
                      padding: '5px 11px', borderRadius: '20px', border: 'none',
                      cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                      background: anio === a ? '#5B4EE8' : '#F1F5F9',
                      color: anio === a ? 'white' : '#64748B',
                    }}>
                    {a === 'todos' ? 'Todos' : a}
                  </button>
                ))}
                <button onClick={cargarStats}
                  style={{ background: '#EEF0FF', color: '#5B4EE8', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                  {cargando ? '⏳' : '🔄'}
                </button>
              </>
            )}
            <div style={{ fontSize: '12px', color: '#64748B', marginLeft: '8px' }}>CoopeAnde N.º 1</div>
          </div>
        </div>

        {/* Páginas */}
        <div style={{ padding: '30px' }}>

          {pagina === 'dashboard' && (
            <div>

              {/* Indicador año */}
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Mostrando:</span>
                <span style={{ background: '#EEF0FF', color: '#5B4EE8', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                  {anio === 'todos' ? 'Todos los años' : `Año ${anio}`}
                </span>
                {cargando && <span style={{ fontSize: '12px', color: '#94A3B8' }}>Calculando...</span>}
              </div>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
                {[
                  { label: 'Capacitaciones',     valor: stats.capacitaciones,              color: '#5B4EE8', icon: '🎓', sub: 'únicas por nombre',   dest: 'capacitaciones' },
                  { label: 'Colaboradores',       valor: stats.colaboradores,               color: '#D97706', icon: '📋', sub: 'únicos por correo',   dest: 'colaboradores' },
                  { label: 'Participaciones',     valor: stats.participantes.toLocaleString(), color: '#0F9B72', icon: '👥', sub: 'registros totales', dest: 'participantes' },
                  { label: 'Horas impartidas',    valor: stats.horas.toLocaleString(),      color: '#7C3AED', icon: '⏱️', sub: 'total acumulado',    dest: 'capacitaciones' },
                  { label: 'Presupuesto (CR)',    valor: '₡' + stats.presupuesto.toLocaleString(), color: '#DC2626', icon: '💰', sub: 'ejecutado',   dest: 'presupuesto' },
                ].map(kpi => (
                  <div key={kpi.label} onClick={() => irA(kpi.dest)}
