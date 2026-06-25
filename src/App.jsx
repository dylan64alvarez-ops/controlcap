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

const COLORS = {
  azul: '#0072DA',
  morado: '#8131B0',
  amarillo: '#FFCF00',
  rojo: '#DA2B1F',
  grafito: '#414042',
  fondo: '#F8FAFC',
  borde: '#E2E8F0',
}

export default function App() {
  const [pagina, setPagina] = useState('dashboard')
  const [anio, setAnio] = useState('todos')
  const [stats, setStats] = useState({ capacitaciones: 0, colaboradores: 0, participantes: 0, horas: 0, presupuesto: 0 })
  const [cargando, setCargando] = useState(false)
  const [graficas, setGraficas] = useState({ gerencias: [], generos: [], mensual: [] })
  const [gerenciaSeleccionada, setGerenciaSeleccionada] = useState(null)

  useEffect(() => { cargarStats() }, [anio])

  async function cargarStats() {
    setCargando(true)

    let query = supabase.from('stats_por_anio').select('*')
    if (anio !== 'todos') query = query.eq('anio', parseInt(anio))
    const { data: statsData } = await query

    let capacitaciones = 0, colaboradores = 0, participantes = 0, horas = 0

    if (statsData && statsData.length > 0) {
      if (anio !== 'todos') {
        const row = statsData[0]
        capacitaciones = Number(row.capacitaciones_unicas || 0)
        colaboradores  = Number(row.colaboradores_unicos || 0)
        participantes  = Number(row.total_participantes || 0)
        horas          = Number(row.total_horas || 0)
      } else {
        const { data: totales } = await supabase.rpc('get_totales_globales').maybeSingle()
        if (totales) {
          capacitaciones = Number(totales.capacitaciones_unicas || 0)
          colaboradores  = Number(totales.colaboradores_unicos || 0)
          participantes  = Number(totales.total_participantes || 0)
          horas          = Number(totales.total_horas || 0)
        } else {
          statsData.forEach(r => {
            participantes += Number(r.total_participantes || 0)
            horas         += Number(r.total_horas || 0)
          })
          const { count: cCap } = await supabase.from('capacitaciones').select('*', { count: 'exact', head: true })
          const { count: cCol } = await supabase.from('colaboradores').select('*', { count: 'exact', head: true })
          capacitaciones = cCap || 0
          colaboradores  = cCol || 0
        }
      }
    }

    const { data: preData } = await supabase.from('presupuesto').select('importe').eq('cd', 'CR')
    const totalPre = preData?.reduce((s, r) => s + Number(r.importe), 0) || 0

    setStats({ capacitaciones, colaboradores, participantes, horas, presupuesto: totalPre })

    // Cargar datos de gráficas
    await cargarGraficas()
    setCargando(false)
  }

  async function cargarGraficas() {
    const anioFiltro = anio !== 'todos' ? parseInt(anio) : null

    // Gráfica 1: Participaciones por gerencia
    let qGerencia = supabase
      .from('participantes')
      .select('colaborador_id, colaboradores(gerencia), capacitaciones(fecha_inicio)')
      .not('colaborador_id', 'is', null)

    // Query directa con SQL para gerencia
    const { data: gerData } = await supabase.rpc('stats_por_gerencia', { anio_filtro: anioFiltro }).catch(() => ({ data: null }))

    if (!gerData) {
      // Fallback: query manual
      let qP = supabase
        .from('participantes')
        .select(`
          colaboradores!inner(gerencia, departamento, genero),
          capacitaciones!inner(fecha_inicio, horas)
        `)
        .not('colaborador_id', 'is', null)

      const { data: pData } = await qP

      if (pData) {
        // Filtrar por año si aplica
        const filtrado = anioFiltro
          ? pData.filter(p => {
              const fecha = p.capacitaciones?.fecha_inicio
              return fecha && new Date(fecha).getFullYear() === anioFiltro
            })
          : pData

        // Agrupar por gerencia
        const gerMap = {}
        const genMap = { FEMENINO: 0, MASCULINO: 0, OTRO: 0 }
        const mesMap = {}

        filtrado.forEach(p => {
          const ger = p.colaboradores?.gerencia || 'Sin gerencia'
          const dep = p.colaboradores?.departamento || 'Sin departamento'
          const gen = p.colaboradores?.genero || 'OTRO'
          const fecha = p.capacitaciones?.fecha_inicio
          const mes = fecha ? new Date(fecha).getMonth() + 1 : null
          const hrs = Number(p.capacitaciones?.horas || 0)

          if (!gerMap[ger]) gerMap[ger] = { total: 0, departamentos: {} }
          gerMap[ger].total++
          if (!gerMap[ger].departamentos[dep]) gerMap[ger].departamentos[dep] = 0
          gerMap[ger].departamentos[dep]++

          if (gen === 'FEMENINO') genMap.FEMENINO++
          else if (gen === 'MASCULINO') genMap.MASCULINO++
          else genMap.OTRO++

          if (mes) {
            if (!mesMap[mes]) mesMap[mes] = { participaciones: 0, horas: 0 }
            mesMap[mes].participaciones++
            mesMap[mes].horas += hrs
          }
        })

        const gerencias = Object.entries(gerMap)
          .map(([nombre, data]) => ({
            nombre: nombre.replace('Gerencia ', 'Ger. '),
            total: data.total,
            departamentos: Object.entries(data.departamentos)
              .map(([dep, cnt]) => ({ nombre: dep, total: cnt }))
              .sort((a, b) => b.total - a.total)
          }))
          .sort((a, b) => b.total - a.total)

        const totalGen = genMap.FEMENINO + genMap.MASCULINO + genMap.OTRO
        const generos = [
          { label: 'Femenino', valor: genMap.FEMENINO, pct: totalGen ? Math.round(genMap.FEMENINO / totalGen * 100) : 0, color: COLORS.morado },
          { label: 'Masculino', valor: genMap.MASCULINO, pct: totalGen ? Math.round(genMap.MASCULINO / totalGen * 100) : 0, color: COLORS.azul },
          { label: 'Otro', valor: genMap.OTRO, pct: totalGen ? Math.round(genMap.OTRO / totalGen * 100) : 0, color: COLORS.grafito },
        ]

        const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic']
        const mensual = meses.map((label, i) => ({
          label,
          participaciones: mesMap[i + 1]?.participaciones || 0,
          horas: mesMap[i + 1]?.horas || 0,
        }))

        setGraficas({ gerencias, generos, mensual })
        setGerenciaSeleccionada(null)
      }
    }
  }

  // Componente gráfica de barras
  function GraficaBarras({ datos, colorBarra, titulo, campoValor = 'total', labelKey = 'nombre' }) {
    if (!datos || datos.length === 0) return <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Sin datos</div>
    const maxVal = Math.max(...datos.map(d => d[campoValor]))
    return (
      <div>
        {datos.map((d, i) => (
          <div key={i} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: COLORS.grafito, marginBottom: '3px' }}>
              <span style={{ maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d[labelKey]}</span>
              <span style={{ fontWeight: '600', color: colorBarra }}>{d[campoValor]}</span>
            </div>
            <div
              onClick={() => d.departamentos && setGerenciaSeleccionada(gerenciaSeleccionada?.nombre === d.nombre ? null : d)}
              style={{ background: '#E2E8F0', borderRadius: '4px', height: '20px', cursor: d.departamentos ? 'pointer' : 'default', overflow: 'hidden' }}
            >
              <div style={{
                background: colorBarra,
                height: '100%',
                width: `${maxVal > 0 ? (d[campoValor] / maxVal * 100) : 0}%`,
                borderRadius: '4px',
                transition: 'width 0.5s ease',
                opacity: gerenciaSeleccionada && gerenciaSeleccionada.nombre !== d.nombre ? 0.4 : 1
              }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Componente donut
  function GraficaDonut({ datos }) {
    if (!datos || datos.length === 0) return null
    const total = datos.reduce((s, d) => s + d.valor, 0)
    if (total === 0) return <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Sin datos</div>

    let acumulado = 0
    const radio = 60
    const cx = 80, cy = 80
    const segmentos = datos.filter(d => d.valor > 0).map(d => {
      const inicio = acumulado
      acumulado += (d.valor / total) * 360
      return { ...d, inicio, fin: acumulado }
    })

    function polarToCartesian(angle) {
      const rad = (angle - 90) * Math.PI / 180
      return { x: cx + radio * Math.cos(rad), y: cy + radio * Math.sin(rad) }
    }

    function arcPath(inicio, fin) {
      const s = polarToCartesian(inicio)
      const e = polarToCartesian(fin)
      const large = fin - inicio > 180 ? 1 : 0
      return `M ${cx} ${cy} L ${s.x} ${s.y} A ${radio} ${radio} 0 ${large} 1 ${e.x} ${e.y} Z`
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <svg width="160" height="160">
          {segmentos.map((s, i) => (
            <path key={i} d={arcPath(s.inicio, s.fin)} fill={s.color} stroke="white" strokeWidth="2" />
          ))}
          <circle cx={cx} cy={cy} r="35" fill="white" />
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="bold" fill={COLORS.grafito}>{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#94A3B8">total</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {datos.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12px', color: COLORS.grafito, fontWeight: '500' }}>{d.label}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>{d.valor} ({d.pct}%)</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Componente tendencia mensual
  function GraficaTendencia({ datos }) {
    if (!datos || datos.every(d => d.participaciones === 0)) return <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Sin datos</div>
    const maxP = Math.max(...datos.map(d => d.participaciones), 1)
    const maxH = Math.max(...datos.map(d => d.horas), 1)
    const W = 480, H = 120, pad = 30

    const puntosP = datos.map((d, i) => ({
      x: pad + (i / (datos.length - 1)) * (W - pad * 2),
      y: H - pad - (d.participaciones / maxP) * (H - pad * 2),
      val: d.participaciones
    }))
    const puntosH = datos.map((d, i) => ({
      x: pad + (i / (datos.length - 1)) * (W - pad * 2),
      y: H - pad - (d.horas / maxH) * (H - pad * 2),
      val: d.horas
    }))

    const lineaP = puntosP.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const lineaH = puntosH.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
      <div>
        <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`}>
          {datos.map((d, i) => {
            const x = pad + (i / (datos.length - 1)) * (W - pad * 2)
            return (
              <text key={i} x={x} y={H + 15} textAnchor="middle" fontSize="9" fill="#94A3B8">{d.label}</text>
            )
          })}
          <path d={lineaP} fill="none" stroke={COLORS.azul} strokeWidth="2.5" strokeLinejoin="round" />
          <path d={lineaH} fill="none" stroke={COLORS.morado} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="5,3" />
          {puntosP.map((p, i) => p.val > 0 && <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={COLORS.azul} />)}
          {puntosH.map((p, i) => p.val > 0 && <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={COLORS.morado} />)}
        </svg>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '20px', height: '3px', background: COLORS.azul, borderRadius: '2px' }} />
            <span style={{ fontSize: '11px', color: '#64748B' }}>Participaciones</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '20px', height: '3px', background: COLORS.morado, borderRadius: '2px', borderTop: '2px dashed ' + COLORS.morado }} />
            <span style={{ fontSize: '11px', color: '#64748B' }}>Horas</span>
          </div>
        </div>
      </div>
    )
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
            <span style={{ color: '#FFCF00' }}>Control</span>Cap
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Universidad Corporativa</div>
        </div>
        <nav style={{ padding: '10px 0' }}>
          {menuItems.map(item => (
            <div key={item.id} onClick={() => irA(item.id)}
              style={{
                padding: '9px 20px', cursor: 'pointer',
                background: pagina === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                borderLeft: pagina === item.id ? `3px solid ${COLORS.amarillo}` : '3px solid transparent',
                fontSize: '13px',
              }}>
              {item.label}
            </div>
          ))}
        </nav>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, background: COLORS.fondo, overflow: 'auto' }}>

        {/* Header */}
        <div style={{ background: 'white', padding: '15px 30px', borderBottom: `1px solid ${COLORS.borde}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                      background: anio === a ? COLORS.azul : '#F1F5F9',
                      color: anio === a ? 'white' : '#64748B',
                    }}>
                    {a === 'todos' ? 'Todos' : a}
                  </button>
                ))}
                <button onClick={cargarStats}
                  style={{ background: '#EEF0FF', color: COLORS.morado, border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', marginLeft: '4px' }}>
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
                <span style={{ background: '#EEF0FF', color: COLORS.morado, padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                  {anio === 'todos' ? 'Todos los años' : `Año ${anio}`}
                </span>
                {cargando && <span style={{ fontSize: '12px', color: '#94A3B8' }}>⏳ Calculando...</span>}
              </div>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
                {[
                  { label: 'Capacitaciones',  valor: stats.capacitaciones.toLocaleString(), color: COLORS.morado, icon: '🎓', sub: 'únicas por nombre',  dest: 'capacitaciones' },
                  { label: 'Colaboradores',    valor: stats.colaboradores.toLocaleString(),  color: COLORS.amarillo, icon: '📋', sub: 'únicos por correo', dest: 'colaboradores' },
                  { label: 'Participaciones',  valor: stats.participantes.toLocaleString(),  color: COLORS.azul,   icon: '👥', sub: 'registros totales',  dest: 'participantes' },
                  { label: 'Horas impartidas', valor: stats.horas.toLocaleString(),          color: COLORS.morado, icon: '⏱️', sub: 'total acumulado',    dest: 'capacitaciones' },
                  { label: 'Presupuesto (CR)', valor: '₡' + stats.presupuesto.toLocaleString(), color: COLORS.rojo, icon: '💰', sub: 'ejecutado',        dest: 'presupuesto' },
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

              {/* Gráficas fila 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>

                {/* Barras por gerencia */}
                <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                        {gerenciaSeleccionada ? `📂 ${gerenciaSeleccionada.nombre}` : '🏢 Participaciones por Gerencia'}
                      </div>
                      {gerenciaSeleccionada && (
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Desglose por departamento</div>
                      )}
                    </div>
                    {gerenciaSeleccionada && (
                      <button onClick={() => setGerenciaSeleccionada(null)}
                        style={{ background: '#F1F5F9', border: 'none', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#64748B' }}>
                        ← Volver
                      </button>
                    )}
                  </div>
                  {cargando ? (
                    <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Cargando...</div>
                  ) : gerenciaSeleccionada ? (
                    <GraficaBarras
                      datos={gerenciaSeleccionada.departamentos}
                      colorBarra={COLORS.morado}
                      campoValor="total"
                      labelKey="nombre"
                    />
                  ) : (
                    <GraficaBarras
                      datos={graficas.gerencias}
                      colorBarra={COLORS.azul}
                      campoValor="total"
                      labelKey="nombre"
                    />
                  )}
                  {!gerenciaSeleccionada && graficas.gerencias.length > 0 && (
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '10px', textAlign: 'center' }}>
                      💡 Haz clic en una barra para ver los departamentos
                    </div>
                  )}
                </div>

                {/* Donut género */}
                <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', marginBottom: '16px' }}>
                    👥 Distribución por Género
                  </div>
                  {cargando ? (
                    <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Cargando...</div>
                  ) : (
                    <GraficaDonut datos={graficas.generos} />
                  )}
                </div>
              </div>

              {/* Gráfica tendencia mensual */}
              <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', marginBottom: '16px' }}>
                  📈 Tendencia Mensual — Participaciones y Horas
                </div>
                {cargando ? (
                  <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Cargando...</div>
                ) : (
                  <GraficaTendencia datos={graficas.mensual} />
                )}
              </div>

              {/* Accesos rápidos */}
              <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '16px', color: '#1E293B' }}>Acciones rápidas</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {[
                    { label: 'Nueva capacitación',   icon: '🎓', pagina: 'capacitaciones' },
                    { label: 'Agregar participante', icon: '👥', pagina: 'participantes' },
                    { label: 'Generar reportes',     icon: '📄', pagina: 'reportes' },
                    { label: 'Carga masiva',         icon: '📤', pagina: 'importar-capacitaciones' },
                  ].map(acc => (
                    <div key={acc.label} onClick={() => irA(acc.pagina)}
                      style={{ padding: '16px', background: COLORS.fondo, borderRadius: '10px', cursor: 'pointer', border: `1px solid ${COLORS.borde}`, textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', marginBottom: '6px' }}>{acc.icon}</div>
                      <div style={{ fontSize: '13px', color: COLORS.azul, fontWeight: '500' }}>{acc.label}</div>
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
