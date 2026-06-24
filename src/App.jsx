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

    // Usar la vista stats_por_anio para cálculos exactos
    let query = supabase.from('stats_por_anio').select('*')
    if (anio !== 'todos') {
      query = query.eq('anio', parseInt(anio))
    }
    const { data: statsData, error } = await query

    let capacitaciones = 0
    let colaboradores = 0
    let participantes = 0
    let horas = 0

    if (statsData && statsData.length > 0) {
      if (anio !== 'todos') {
        // Un solo año
        const row = statsData[0]
        capacitaciones = Number(row.capacitaciones_unicas || 0)
        colaboradores  = Number(row.colaboradores_unicos || 0)
        participantes  = Number(row.total_participantes || 0)
        horas          = Number(row.total_horas || 0)
      } else {
        // Todos los años — sumar filas pero colaboradores/caps únicos no suman directamente
        // Para "todos" hacemos query sin filtro de año
        const { data: totales } = await supabase.rpc('get_totales_globales').maybeSingle()
        if (totales) {
          capacitaciones = Number(totales.capacitaciones_unicas || 0)
          colaboradores  = Number(totales.colaboradores_unicos || 0)
          participantes  = Number(totales.total_participantes || 0)
          horas          = Number(totales.total_horas || 0)
        } else {
          // Fallback: sumar las filas de la vista
          statsData.forEach(r => {
            participantes += Number(r.total_participantes || 0)
            horas         += Number(r.total_horas || 0)
          })
          // Para caps y colabs únicos en todos los años, query separada
          const { count: cCap } = await supabase
            .from('capacitaciones').select('*', { count: 'exact', head: true })
          const { count: cCol } = await supabase
            .from('colaboradores').select('*', { count: 'exact', head: true })
          capacitaciones = cCap || 0
          colaboradores  = cCol || 0
        }
      }
    }

    // Presupuesto ejecutado
    const { data: preData } = await supabase
      .from('presupuesto').select('importe').eq('cd', 'CR')
    const totalPre = preData?.reduce((s, r) => s + Number(r.importe), 0) || 0

    setStats({ capacitaciones, colaboradores, participantes, horas, presupuesto: totalPre })
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {pagina === 'dashboard' && (
              <>
                <span style={{ fontSize: '12px', color: '#94A3B8', marginRight: '4px' }}>Año:</span>
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
                  style={{ background: '#EEF0FF', color: '#5B4EE8', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginLeft: '4px' }}>
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
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Mostrando:</span>
                <span style={{ background: '#EEF0FF', color: '#5B4EE8', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                  {anio === 'todos' ? 'Todos los años' : `Año ${anio}`}
                </span>
                {cargando && <span style={{ fontSize: '12px', color: '#94A3B8' }}>⏳ Calculando...</span>}
              </div>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
                {[
                  { label: 'Capacitaciones',   valor: stats.capacitaciones.toLocaleString(),  color: '#5B4EE8', icon: '🎓', sub: 'únicas por nombre',  dest: 'capacitaciones' },
                  { label: 'Colaboradores',     valor: stats.colaboradores.toLocaleString(),   color: '#D97706', icon: '📋', sub: 'únicos por correo',  dest: 'colaboradores' },
                  { label: 'Participaciones',   valor: stats.participantes.toLocaleString(),   color: '#0F9B72', icon: '👥', sub: 'registros totales',  dest: 'participantes' },
                  { label: 'Horas impartidas',  valor: stats.horas.toLocaleString(),           color: '#7C3AED', icon: '⏱️', sub: 'total acumulado',   dest: 'capacitaciones' },
                  { label: 'Presupuesto (CR)',  valor: '₡' + stats.presupuesto.toLocaleString(), color: '#DC2626', icon: '💰', sub: 'ejecutado',       dest: 'presupuesto' },
                ].map(kpi => (
                  <div key={kpi.label} onClick={() => irA(kpi.dest)}
                    style={{ background: 'white', borderRadius: '12px', padding: '18px', borderLeft: `4px solid ${kpi.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: 'pointer' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>{kpi.icon} {kpi.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: kpi.color }}>
                      {cargando ? '...' : kpi.valor}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Accesos rápidos */}
              <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '16px', color: '#1E293B' }}>
                  Acciones rápidas
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {[
                    { label: 'Nueva capacitación',   icon: '🎓', pagina: 'capacitaciones' },
                    { label: 'Agregar participante', icon: '👥', pagina: 'participantes' },
                    { label: 'Generar reportes',     icon: '📄', pagina: 'reportes' },
                    { label: 'Carga masiva',         icon: '📤', pagina: 'importar-capacitaciones' },
                  ].map(acc => (
                    <div key={acc.label} onClick={() => irA(acc.pagina)}
                      style={{ padding: '16px', background: '#F8FAFC', borderRadius: '10px', cursor: 'pointer', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', marginBottom: '6px' }}>{acc.icon}</div>
                      <div style={{ fontSize: '13px', color: '#5B4EE8', fontWeight: '500' }}>{acc.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {pagina === 'colaboradores'           && <Colaboradores />}
          {pagina === 'capacitaciones'          && <Capacitaciones onCambio={cargarStats} />}
          {pagina === 'presupuesto'             && <Presupuesto onCambio={cargarStats} />}
          {pagina === 'traslados'               && <Traslados onCambio={cargarStats} />}
          {pagina === 'participantes'           && <Participantes onCambio={cargarStats} />}
          {pagina === 'reportes'                && <Reportes />}
          {pagina === 'importar'                && <Importar onImportado={cargarStats} />}
          {pagina === 'importar-capacitaciones' && <ImportarCapacitaciones onImportado={cargarStats} />}

          {!paginasActivas.includes(pagina) && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚧</div>
              <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>Módulo: {pagina}</div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>Este módulo se construye en el siguiente paso</div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
