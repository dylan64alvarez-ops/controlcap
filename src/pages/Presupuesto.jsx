import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const ANIOS = ['2026', '2025', '2024', '2023', '2022', '2021']
const COLORS = {
  azul: '#0072DA', morado: '#8131B0', amarillo: '#FFCF00',
  rojo: '#DA2B1F', grafito: '#414042', fondo: '#F8FAFC', borde: '#E2E8F0'
}

export default function Presupuesto({ onCambio }) {
  const [datos, setDatos] = useState([])
  const [filtroAnio, setFiltroAnio] = useState('2026')
  const [filtroGerencia, setFiltroGerencia] = useState('')
  const [drillGerencia, setDrillGerencia] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [gerencias, setGerencias] = useState([])

  useEffect(() => { cargar() }, [filtroAnio])

  async function cargar() {
    setCargando(true)

    // Cargar colaboradores para lookup por correo e id
    const { data: colsData } = await supabase
      .from('colaboradores')
      .select('id, correo, gerencia, departamento')

    const colById = {}, colByCorreo = {}
    colsData?.forEach(c => {
      colById[c.id] = c
      if (c.correo) colByCorreo[c.correo.toLowerCase().trim()] = c
    })

    // Obtener IDs de capacitaciones del año
    let capIds = null
    if (filtroAnio) {
      const { data: capsAnio } = await supabase
        .from('capacitaciones')
        .select('id')
        .gte('fecha_inicio', `${filtroAnio}-01-01`)
        .lte('fecha_inicio', `${filtroAnio}-12-31`)

      if (!capsAnio || capsAnio.length === 0) {
        setDatos([])
        setGerencias([])
        setCargando(false)
        return
      }
      capIds = capsAnio.map(c => c.id)
    }

    // Obtener participantes con costo — sin JOIN a colaboradores
    let q = supabase
      .from('participantes')
      .select('costo, correo, colaborador_id')
      .gt('costo', 0)

    if (capIds) q = q.in('capacitacion_id', capIds)

    const { data: pData } = await q

    // Enriquecer con gerencia/departamento via lookup local
    const enriquecidos = (pData || []).map(p => {
      const col = colById[p.colaborador_id] ||
        colByCorreo[p.correo?.toLowerCase().trim()] ||
        null
      return {
        ...p,
        _gerencia: col?.gerencia || 'Sin gerencia',
        _departamento: col?.departamento || 'Sin departamento'
      }
    })

    setDatos(enriquecidos)

    const gersUnicas = [...new Set(enriquecidos.map(p => p._gerencia))].sort()
    setGerencias(gersUnicas)
    setCargando(false)
  }

  const datosFiltrados = filtroGerencia
    ? datos.filter(p => p._gerencia === filtroGerencia)
    : datos

  const totalEjecutado = datosFiltrados.reduce((s, p) => s + Number(p.costo || 0), 0)

  // Agrupar por gerencia
  const porGerencia = {}
  datos.forEach(p => {
    const ger = p._gerencia
    const dep = p._departamento
    if (!porGerencia[ger]) porGerencia[ger] = { total: 0, departamentos: {} }
    porGerencia[ger].total += Number(p.costo || 0)
    if (!porGerencia[ger].departamentos[dep]) porGerencia[ger].departamentos[dep] = 0
    porGerencia[ger].departamentos[dep] += Number(p.costo || 0)
  })

  const gerenciasArray = Object.entries(porGerencia)
    .map(([nombre, d]) => ({
      nombre: nombre.replace('Gerencia de ', '').replace('Gerencia ', ''),
      nombreCompleto: nombre,
      total: d.total,
      departamentos: Object.entries(d.departamentos)
        .map(([dep, total]) => ({ nombre: dep, total }))
        .sort((a, b) => b.total - a.total)
    }))
    .sort((a, b) => b.total - a.total)

  const drillArray = drillGerencia
    ? (porGerencia[drillGerencia.nombreCompleto]?.departamentos
        ? Object.entries(porGerencia[drillGerencia.nombreCompleto].departamentos)
            .map(([dep, total]) => ({ nombre: dep, total }))
            .sort((a, b) => b.total - a.total)
        : [])
    : []

  function GraficaBarras({ datos, color }) {
    if (!datos || datos.length === 0) return (
      <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Sin datos</div>
    )
    const max = Math.max(...datos.map(d => d.total), 1)
    return (
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {datos.map((d, i) => (
          <div key={i} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: COLORS.grafito, marginBottom: '3px' }}>
              <span style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</span>
              <span style={{ fontWeight: '600', color: color }}>₡{Math.round(d.total).toLocaleString()}</span>
            </div>
            <div style={{ background: '#E2E8F0', borderRadius: '4px', height: '18px', overflow: 'hidden' }}>
              <div style={{ background: color, height: '100%', width: `${(d.total / max) * 100}%`, borderRadius: '4px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const inp = { height: '36px', border: `1px solid ${COLORS.borde}`, borderRadius: '8px', padding: '0 10px', fontSize: '13px', outline: 'none', background: 'white' }

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filtroAnio} onChange={e => { setFiltroAnio(e.target.value); setFiltroGerencia(''); setDrillGerencia(null) }}
          style={{ ...inp, width: '130px' }}>
          <option value="">Todos los años</option>
          {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtroGerencia} onChange={e => { setFiltroGerencia(e.target.value); setDrillGerencia(null) }}
          style={{ ...inp, width: '300px' }}>
          <option value="">Todas las gerencias</option>
          {gerencias.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        {filtroGerencia && (
          <button onClick={() => { setFiltroGerencia(''); setDrillGerencia(null) }}
            style={{ ...inp, width: 'auto', padding: '0 14px', cursor: 'pointer', color: '#64748B' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', borderLeft: `4px solid ${COLORS.rojo}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>
            💰 Total ejecutado {filtroAnio || 'histórico'}{filtroGerencia ? ` · ${filtroGerencia.replace('Gerencia ', '')}` : ''}
          </div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: COLORS.rojo }}>
            {cargando ? '...' : `₡${Math.round(totalEjecutado).toLocaleString()}`}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
            {cargando ? '' : `${datosFiltrados.length} registros con costo`}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', borderLeft: `4px solid ${COLORS.azul}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>🏢 Gerencias con gasto</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: COLORS.azul }}>
            {cargando ? '...' : gerenciasArray.filter(g => !filtroGerencia || g.nombreCompleto === filtroGerencia).length}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>unidades organizacionales</div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', borderLeft: `4px solid ${COLORS.morado}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>📊 Costo promedio por participante</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: COLORS.morado }}>
            {cargando ? '...' : datosFiltrados.length > 0
              ? `₡${Math.round(totalEjecutado / datosFiltrados.length).toLocaleString()}`
              : '₡0'}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>promedio por participación</div>
        </div>
      </div>

      {/* Gráfica */}
      <div style={{ display: 'grid', gridTemplateColumns: drillGerencia ? '1fr 1fr' : '1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', marginBottom: '16px' }}>
            🏢 Gasto por Gerencia
          </div>
          {cargando ? (
            <div style={{ color: '#94A3B8', textAlign: 'center', padding: '20px' }}>Cargando...</div>
          ) : (
            <>
              <GraficaBarras
                datos={gerenciasArray.filter(g => !filtroGerencia || g.nombreCompleto === filtroGerencia)}
                color={COLORS.rojo}
              />
              {!filtroGerencia && gerenciasArray.length > 0 && (
                <div style={{ marginTop: '12px', borderTop: `1px solid ${COLORS.borde}`, paddingTop: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '8px' }}>Ver departamentos:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {gerenciasArray.slice(0, 8).map(g => (
                      <button key={g.nombre}
                        onClick={() => setDrillGerencia(drillGerencia?.nombre === g.nombre ? null : g)}
                        style={{
                          padding: '4px 10px', borderRadius: '20px', border: 'none',
                          cursor: 'pointer', fontSize: '11px',
                          background: drillGerencia?.nombre === g.nombre ? COLORS.morado : '#EEF0FF',
                          color: drillGerencia?.nombre === g.nombre ? 'white' : COLORS.morado,
                          fontWeight: '500'
                        }}>
                        {g.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {drillGerencia && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>📂 {drillGerencia.nombre}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Por departamento</div>
              </div>
              <button onClick={() => setDrillGerencia(null)}
                style={{ background: '#F1F5F9', border: 'none', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: '#64748B' }}>
                ✕ Cerrar
              </button>
            </div>
            <GraficaBarras datos={drillArray} color={COLORS.morado} />
          </div>
        )}
      </div>

      {/* Tabla resumen */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.borde}`, fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
          📋 Resumen por Gerencia
        </div>
        {cargando ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Cargando...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Gerencia', 'Participaciones con costo', 'Total ejecutado', '% del total'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${COLORS.borde}`, textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gerenciasArray
                .filter(g => !filtroGerencia || g.nombreCompleto === filtroGerencia)
                .map((g, i) => {
                  const totalGlobal = gerenciasArray.reduce((s, x) => s + x.total, 0)
                  const pct = totalGlobal > 0 ? ((g.total / totalGlobal) * 100).toFixed(1) : '0'
                  const count = datos.filter(p => p._gerencia === g.nombreCompleto).length
                  return (
                    <tr key={g.nombre}
                      onClick={() => setDrillGerencia(drillGerencia?.nombre === g.nombre ? null : g)}
                      style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA', cursor: 'pointer' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '500', fontSize: '13px' }}>{g.nombreCompleto}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B' }}>{count}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: COLORS.rojo }}>
                        ₡{Math.round(g.total).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ background: '#E2E8F0', borderRadius: '4px', height: '6px', width: '80px', overflow: 'hidden' }}>
                            <div style={{ background: COLORS.rojo, height: '100%', width: `${pct}%`, borderRadius: '4px' }} />
                          </div>
                          <span style={{ color: '#64748B', fontSize: '12px' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F8FAFC', borderTop: `2px solid ${COLORS.borde}` }}>
                <td style={{ padding: '12px 16px', fontWeight: '700', fontSize: '13px' }}>TOTAL</td>
                <td style={{ padding: '12px 16px', fontWeight: '600', fontSize: '13px' }}>{datosFiltrados.length}</td>
                <td style={{ padding: '12px 16px', fontWeight: '700', fontSize: '14px', color: COLORS.rojo }}>
                  ₡{Math.round(totalEjecutado).toLocaleString()}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: '600', fontSize: '13px', color: '#64748B' }}>100%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
