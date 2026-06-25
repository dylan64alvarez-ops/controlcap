import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Importar from './pages/Importar.jsx'
import Colaboradores from './pages/Colaboradores.jsx'
import Capacitaciones from './pages/Capacitaciones.jsx'
import Presupuesto from './pages/Presupuesto.jsx'
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
  const [graficas, setGraficas] = useState({ gerenciasPartic: [], gerenciasHoras: [], generos: [], mensual: [] })
  const [drillPartic, setDrillPartic] = useState(null)
  const [drillHoras, setDrillHoras] = useState(null)

  useEffect(() => { cargarStats() }, [anio])

  async function cargarStats() {
    setCargando(true)

    let query = supabase.from('stats_por_anio').select('*')
    if (anio !== 'todos') query = query.eq('anio', parseInt(anio))
    const { data: statsData } = await query

    let capacitaciones = 0, colaboradores = 0, participantes = 0, horas = 0, presupuesto = 0

    if (statsData && statsData.length > 0) {
      if (anio !== 'todos') {
        const row = statsData[0]
        capacitaciones = Number(row.capacitaciones_unicas || 0)
        colaboradores  = Number(row.colaboradores_unicos || 0)
        participantes  = Number(row.total_participantes || 0)
        horas          = Number(row.total_horas || 0)
        presupuesto    = Number(row.total_costo || 0)
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
            presupuesto   += Number(r.total_costo || 0)
          })
          const { count: cCap } = await supabase.from('capacitaciones').select('*', { count: 'exact', head: true })
          const { count: cCol } = await supabase.from('colaboradores').select('*', { count: 'exact', head: true })
          capacitaciones = cCap || 0
          colaboradores  = cCol || 0
        }
      }
    }

    setStats({ capacitaciones, colaboradores, participantes, horas, presupuesto })
    await cargarGraficas()
    setCargando(false)
  }

  async function cargarGraficas() {
    const anioFiltro = anio !== 'todos' ? parseInt(anio) : null

    let q = supabase.from('stats_graficas').select('*')
    if (anioFiltro) q = q.eq('anio', anioFiltro)
    const { data } = await q
    if (!data) return

    const gerMapP = {}, gerMapH = {}
    const mesMap = {}

    data.forEach(row => {
      const ger = row.gerencia || 'Sin gerencia'
      const dep = row.departamento || 'Sin departamento'
      const mes = row.mes
      const partic = Number(row.participaciones || 0)
      const hrs = Number(row.horas || 0)

      if (!gerMapP[ger]) gerMapP[ger] = { total: 0, departamentos: {} }
      gerMapP[ger].total += partic
      if (!gerMapP[ger].departamentos[dep]) gerMapP[ger].departamentos[dep] = 0
      gerMapP[ger].departamentos[dep] += partic

      if (!gerMapH[ger]) gerMapH[ger] = { total: 0, departamentos: {} }
      gerMapH[ger].total += hrs
      if (!gerMapH[ger].departamentos[dep]) gerMapH[ger].departamentos[dep] = 0
      gerMapH[ger].departamentos[dep] += hrs

      if (mes) {
        if (!mesMap[mes]) mesMap[mes] = { participaciones: 0, horas: 0 }
        mesMap[mes].participaciones += partic
        mesMap[mes].horas += hrs
      }
    })

    const genMap = { FEMENINO: 0, MASCULINO: 0 }
    const { data: genData } = await supabase
      .rpc('get_genero_stats', anioFiltro ? { anio_param: anioFiltro } : { anio_param: null })

    if (genData) {
      genData.forEach(row => {
        const g = (row.genero || '').toUpperCase()
        if (g === 'FEMENINO') genMap.FEMENINO = Number(row.personas)
        else if (g === 'MASCULINO') genMap.MASCULINO = Number(row.personas)
      })
    }

    const totalGen = genMap.FEMENINO + genMap.MASCULINO
    const generos = [
      { label: 'Femenino',  valor: genMap.FEMENINO,  pct: totalGen ? Math.round(genMap.FEMENINO / totalGen * 100) : 0,  color: COLORS.morado },
      { label: 'Masculino', valor: genMap.MASCULINO, pct: totalGen ? Math.round(genMap.MASCULINO / totalGen * 100) : 0, color: COLORS.azul },
    ]

    const toArray = (map) => Object.entries(map)
      .map(([nombre, d]) => ({
        nombre: nombre.replace('Gerencia De ', '').replace('Gerencia ', ''),
        nombreCompleto: nombre,
        total: Math.round(d.total),
        departamentos: Object.entries(d.departamentos)
          .map(([dep, cnt]) => ({ nombre: dep, total: Math.round(cnt) }))
          .sort((a, b) => b.total - a.total)
      }))
      .sort((a, b) => b.total - a.total)

    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic']
    const mensual = meses.map((label, i) => ({
      label,
      participaciones: mesMap[i + 1]?.participaciones || 0,
      horas: mesMap[i + 1]?.horas || 0,
    }))

    setGraficas({ gerenciasPartic: toArray(gerMapP), gerenciasHoras: toArray(gerMapH), generos, mensual })
    setDrillPartic(null)
    setDrillHoras(null)
  }

  function GraficaBarras({ datos, colorBarra, campoValor = 'total', labelKey = 'nombre', onBarClick, sufijo = '' }) {
    if (!datos || datos.length === 0) return <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Sin datos</div>
    const maxVal = Math.max(...datos.map(d => d[campoValor]), 1)
    return (
      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        {datos.map((d, i) => (
          <div key={i} style={{ marginBottom: '10px', cursor: onBarClick ? 'pointer' : 'default' }} onClick={() => onBarClick && onBarClick(d)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: COLORS.grafito, marginBottom: '3px' }}>
              <span style={{ maxWidth: '75%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d[labelKey]}</span>
              <span style={{ fontWeight: '600', color: colorBarra }}>{d[campoValor].toLocaleString()}{sufijo}</span>
            </div>
            <div style={{ background: '#E2E8F0', borderRadius: '4px', height: '18px', overflow: 'hidden' }}>
              <div style={{
                background: colorBarra,
                height: '100%',
                width: `${(d[campoValor] / maxVal) * 100}%`,
                borderRadius: '4px',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  function PanelBarras({ titulo, datos, colorBarra, drill, setDrill, sufijo = '' }) {
    return (
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>
              {drill ? `📂 ${drill.nombre}` : titulo}
            </div>
            {drill && <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>Por departamento</div>}
          </div>
          {drill && (
            <button onClick={() => setDrill(null)}
              style={{ background: '#F1F5F9', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#64748B' }}>
              ← Volver
            </button>
          )}
        </div>
        {drill ? (
          <GraficaBarras datos={drill.departamentos} colorBarra={colorBarra} sufijo={sufijo} />
        ) : (
          <>
            <GraficaBarras datos={datos} colorBarra={colorBarra} onBarClick={d => setDrill(d)} sufijo={sufijo} />
            {datos.length > 0 && (
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '8px', textAlign: 'center' }}>
                💡 Clic en una barra para ver departamentos
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  function GraficaDonut({ datos }) {
    if (!datos || datos.length === 0) return null
    const datosConValor = datos.filter(d => d.valor > 0)
    const total = datosConValor.reduce((s, d) => s + d.valor, 0)
    if (total === 0) return <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Sin datos</div>

    let acumulado = 0
    const radio = 55, cx = 70, cy = 70
    const segmentos = datosConValor.map(d => {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <svg width="140" height="140" style={{ flexShrink: 0 }}>
          {segmentos.map((s, i) => (
            <path key={i} d={arcPath(s.inicio, s.fin)} fill={s.color} stroke="white" strokeWidth="2" />
          ))}
          <circle cx={cx} cy={cy} r="32" fill="white" />
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="bold" fill={COLORS.grafito}>{total.toLocaleString()}</text>
          <text x={cx} y={cy + 11} textAnchor="middle" fontSize="9" fill="#94A3B8">personas</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {datos.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: d.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12px', color: COLORS.grafito, fontWeight: '500' }}>{d.label}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>{d.valor.toLocaleString()} · {d.pct}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function GraficaTendencia({ datos }) {
    if (!datos || datos.every(d => d.participaciones === 0)) return (
      <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Sin datos para el período seleccionado</div>
    )
    const maxP = Math.max(...datos.map(d => d.participaciones), 1)
    const maxH = Math.max(...datos.map(d => d.horas), 1)
    const W = 520, H = 130, padL = 10, padR = 10, padT = 10, padB = 25

    const puntosP = datos.map((d, i) => ({
      x: padL + (i / (datos.length - 1)) * (W - padL - padR),
      y: padT + (1 - d.participaciones / maxP) * (H - padT - padB),
      val: d.participaciones
    }))
    const puntosH = datos.map((d, i) => ({
      x: padL + (i / (datos.length - 1)) * (W - padL - padR),
      y: padT + (1 - d.horas / maxH) * (H - padT - padB),
      val: d.horas
    }))

    const lineaP = puntosP.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const lineaH = puntosH.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
      <div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
          {datos.map((d, i) => {
            const x = padL + (i / (datos.length - 1)) * (W - padL - padR)
            return <text key={i} x={x} y={H - 5} textAnchor="middle" fontSize="10" fill="#94A3B8">{d.label}</text>
          })}
          <path d={lineaP} fill="none" stroke={COLORS.azul} strokeWidth="2.5" strokeLinejoin="round" />
          <path d={lineaH} fill="none" stroke={COLORS.morado} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="6,3" />
          {puntosP.map((p, i) => p.val > 0 && <circle key={i} cx={p.x} cy={p.y} r="4" fill="white" stroke={COLORS.azul} strokeWidth="2" />)}
          {puntosH.map((p, i) => p.val > 0 && <circle key={i} cx={p.x} cy={p.y} r="4" fill="white" stroke={COLORS.morado} strokeWidth="2" />)}
        </svg>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '24px', height: '3px', background: COLORS.azul, borderRadius: '2px' }} />
            <span style={{ fontSize: '11px', color: '#64748B' }}>Participaciones</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '24px', height: '2px', background: COLORS.morado, borderRadius: '2px' }} />
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
    'presupuesto', 'participantes', 'reportes',
    'importar-capacitaciones'
  ]

  const anios = ['todos', '2026', '2025', '2024', '2023', '2022']

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '230px', background: '#1B2560', color: 'white', padding: '20px 0', flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            <span style={{ color: COLORS.amarillo }}>Control</span>Cap
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

      <div style={{ flex: 1, background: COLORS.fondo, overflow: 'auto' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
                {[
                  { label: 'Capacitaciones',  valor: stats.capacitaciones.toLocaleString(), color: COLORS.morado,   icon: '🎓', sub: 'únicas por nombre',  dest: 'capacitaciones' },
                  { label: 'Colaboradores',    valor: stats.colaboradores.toLocaleString(),  color: COLORS.amarillo, icon: '📋', sub: 'únicos por correo',  dest: 'colaboradores' },
                  { label: 'Participaciones',  valor: stats.participantes.toLocaleString(),  color: COLORS.azul,     icon: '👥', sub: 'registros totales',  dest: 'participantes' },
                  { label: 'Horas impartidas', valor: stats.horas.toLocaleString(),          color: COLORS.morado,   icon: '⏱️', sub: 'total acumulado',    dest: 'capacitaciones' },
                  { label: 'Presupuesto (CR)', valor: '₡' + Math.round(stats.presupuesto).toLocaleString(), color: COLORS.rojo, icon: '💰', sub: 'costo ejecutado', dest: 'presupuesto' },
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: '16px', marginBottom: '16px' }}>
                <PanelBarras
                  titulo="🏢 Participaciones por Gerencia"
                  datos={graficas.gerenciasPartic}
                  colorBarra={COLORS.azul}
                  drill={drillPartic}
                  setDrill={setDrillPartic}
                />
                <PanelBarras
                  titulo="⏱️ Horas por Gerencia"
                  datos={graficas.gerenciasHoras}
                  colorBarra={COLORS.morado}
                  drill={drillHoras}
                  setDrill={setDrillHoras}
                  sufijo="h"
                />
                <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B', marginBottom: '14px' }}>👥 Distribución por Género</div>
                  <GraficaDonut datos={graficas.generos} />
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B', marginBottom: '14px' }}>📈 Tendencia Mensual — Participaciones y Horas</div>
                <GraficaTendencia datos={graficas.mensual} />
              </div>

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
          {pagina === 'participantes'           && <Participantes onCambio={cargarStats} />}
          {pagina === 'reportes'                && <Reportes />}
          {pagina === 'importar'                && <Importar onImportado={cargarStats} />}
          {pagina === 'importar-capacitaciones' && <ImportarCapacitaciones onImportado={cargarStats} />}

          {!paginasActivas.includes(pagina) && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚧</div>
              <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>Módulo en construcción</div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>Este módulo se construye en el siguiente paso</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
