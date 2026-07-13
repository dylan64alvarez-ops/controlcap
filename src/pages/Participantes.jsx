import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const ANIOS = ['2026', '2025', '2024', '2023', '2022', '2021']
const POR_PAGINA = 200

export default function Participantes({ onCambio }) {
  const [participantes, setParticipantes] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [capacitaciones, setCapacitaciones] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [capMap, setCapMap] = useState({})
  const [colByIdMap, setColByIdMap] = useState({})
  const [colByCorreoMap, setColByCorreoMap] = useState({})
  const [modal, setModal] = useState(false)
  const [busquedaColab, setBusquedaColab] = useState('')
  const [resultados, setResultados] = useState([])
  const [capSeleccionada, setCapSeleccionada] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState('')
  const [filtroCap, setFiltroCap] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('2026')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [cargadoInicial, setCargadoInicial] = useState(false)
  const [paginaActual, setPaginaActual] = useState(0)

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setCargando(true)
    const [cRes, colRes] = await Promise.all([
      supabase.from('capacitaciones').select('id, nombre, horas, fecha_inicio').order('nombre'),
      supabase.from('colaboradores').select('id, nombre, correo, gerencia, departamento, puesto').order('nombre')
    ])

    const caps = cRes.data || []
    const cols = colRes.data || []

    const cMap = {}
    caps.forEach(c => { cMap[c.id] = c })

    const cById = {}, cByCorreo = {}
    cols.forEach(c => {
      cById[c.id] = c
      if (c.correo) cByCorreo[c.correo.toLowerCase().trim()] = c
    })

    setCapacitaciones(caps)
    setColaboradores(cols)
    setCapMap(cMap)
    setColByIdMap(cById)
    setColByCorreoMap(cByCorreo)

    await cargarParticipantes(0, '2026', cMap, cById, cByCorreo, caps)
    setCargadoInicial(true)
    setCargando(false)
  }

  async function cargarParticipantes(pag, anio, cMapRef, cByIdRef, cByCorreoRef, capsRef) {
    const anioActual = anio === undefined ? filtroAnio : anio
    const capsDisp = capsRef || capacitaciones
    const cMapDisp = cMapRef || capMap
    const cByIdDisp = cByIdRef || colByIdMap
    const cByCorreoDisp = cByCorreoRef || colByCorreoMap

    const desde = pag * POR_PAGINA
    const hasta = desde + POR_PAGINA - 1

    let capIds = null
    if (anioActual) {
      const capsAnio = capsDisp.filter(c => {
        if (!c.fecha_inicio) return false
        return new Date(c.fecha_inicio).getFullYear() === parseInt(anioActual)
      })
      if (capsAnio.length === 0) {
        if (pag === 0) { setParticipantes([]); setTotalCount(0) }
        return
      }
      capIds = capsAnio.map(c => c.id)
    }

    let q = supabase
      .from('participantes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(desde, hasta)

    if (capIds) q = q.in('capacitacion_id', capIds)
    if (filtroCap) q = q.eq('capacitacion_id', filtroCap)

    const { data, count } = await q

    const enriquecidos = (data || []).map(p => {
      const cap = cMapDisp[p.capacitacion_id] || null
      const col = cByIdDisp[p.colaborador_id] || cByCorreoDisp[p.correo?.toLowerCase().trim()] || null
      const anioP = cap?.fecha_inicio ? new Date(cap.fecha_inicio).getFullYear() : null
      return { ...p, _cap: cap, _col: col, _anio: anioP }
    })

    if (pag === 0) {
      setParticipantes(enriquecidos)
    } else {
      setParticipantes(prev => [...prev, ...enriquecidos])
    }
    setTotalCount(count || 0)
  }

  useEffect(() => {
    if (!cargadoInicial) return
    setCargando(true)
    setPaginaActual(0)
    cargarParticipantes(0, filtroAnio, null, null, null, null).then(() => setCargando(false))
  }, [filtroAnio, filtroCap])

  // Filtro client-side por búsqueda
  const filtrados = participantes.filter(p => {
    if (!busqueda) return true
    const t = busqueda.toLowerCase()
    const nombre = (p._col?.nombre || p.nombre_colab || '').toLowerCase()
    const correo = (p.correo || '').toLowerCase()
    const cap = (p._cap?.nombre || '').toLowerCase()
    const gerencia = (p._col?.gerencia || '').toLowerCase()
    const puesto = (p._col?.puesto || '').toLowerCase()
    return nombre.includes(t) || correo.includes(t) || cap.includes(t) || gerencia.includes(t) || puesto.includes(t)
  })

  useEffect(() => {
    if (!busquedaColab) { setResultados([]); return }
    const b = busquedaColab.toLowerCase()
    setResultados(
      colaboradores.filter(c =>
        c.nombre?.toLowerCase().includes(b) ||
        c.correo?.toLowerCase().includes(b)
      ).slice(0, 8)
    )
  }, [busquedaColab, colaboradores])

  async function cargarMas() {
    const nuevaPagina = paginaActual + 1
    setPaginaActual(nuevaPagina)
    setCargando(true)
    await cargarParticipantes(nuevaPagina, filtroAnio, null, null, null, null)
    setCargando(false)
  }

  async function agregar(colaborador) {
    if (!capSeleccionada) { alert('Seleccioná una capacitación primero'); return }
    const cap = capacitaciones.find(c => c.id === capSeleccionada)
    setGuardando(true)
    const { error } = await supabase.from('participantes').insert([{
      capacitacion_id: capSeleccionada,
      colaborador_id: colaborador.id,
      correo: colaborador.correo.toLowerCase().trim(),
      horas: cap?.horas || 0,
      genero: null,
      costo: 0,
      nombre_colab: colaborador.nombre,
    }])
    if (!error) {
      setExito(`✅ ${colaborador.nombre} agregado correctamente`)
      setBusquedaColab('')
      setResultados([])
      setCargando(true)
      await cargarParticipantes(0, filtroAnio, null, null, null, null)
      setCargando(false)
      if (onCambio) onCambio()
      setTimeout(() => setExito(''), 3000)
    } else {
      alert('Error: ' + error.message)
    }
    setGuardando(false)
  }

  const inp = {
    height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px',
    padding: '0 10px', fontSize: '13px', outline: 'none', background: 'white'
  }

  return (
    <div>
      {exito && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
          {exito}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#64748B' }}>
          {cargando
            ? 'Cargando...'
            : `${filtrados.length} de ${totalCount.toLocaleString()} participantes`}
        </div>
        <button onClick={() => setModal(true)}
          style={{ background: '#8131B0', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
          + Agregar participante
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Nombre, correo, capacitación, gerencia o puesto..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ ...inp, width: '300px' }}
        />
        <select value={filtroAnio} onChange={e => { setFiltroAnio(e.target.value); setFiltroCap('') }}
          style={{ ...inp, width: '120px' }}>
          <option value="">Todos los años</option>
          {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtroCap} onChange={e => setFiltroCap(e.target.value)}
          style={{ ...inp, width: '300px' }}>
          <option value="">Todas las capacitaciones</option>
          {capacitaciones
            .filter(c => !filtroAnio || (c.fecha_inicio && new Date(c.fecha_inicio).getFullYear() === parseInt(filtroAnio)))
            .map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {(filtroCap || busqueda) && (
          <button onClick={() => { setFiltroCap(''); setBusqueda('') }}
            style={{ ...inp, width: 'auto', padding: '0 14px', cursor: 'pointer', color: '#64748B' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {cargando && participantes.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Cargando participantes...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>👥</div>
            <div style={{ fontWeight: '500', marginBottom: '6px' }}>No hay participantes</div>
            <div style={{ fontSize: '13px' }}>Ajustá los filtros para ver resultados</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Colaborador', 'Correo', 'Gerencia', 'Puesto', 'Capacitación', 'Año', 'Horas', 'Género'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #E2E8F0', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p, i) => {
                  const correoMostrar = (!p.correo || p.correo.startsWith('sin-correo__')) ? '—' : p.correo
                  const nombreMostrar = p._col?.nombre || p.nombre_colab || '—'
                  return (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '500', fontSize: '13px', whiteSpace: 'nowrap' }}>{nombreMostrar}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#0072DA' }}>{correoMostrar}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{p._col?.gerencia || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p._col?.puesto || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#374151', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p._cap?.nombre || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{p._anio || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: '#0F9B72' }}>{p.horas || 0}h</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>
                        {p.genero === 'FEMENINO' ? '♀ F' : p.genero === 'MASCULINO' ? '♂ M' : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {participantes.length < totalCount && !busqueda && (
              <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid #E2E8F0' }}>
                <button onClick={cargarMas} disabled={cargando}
                  style={{ background: '#8131B0', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '8px', cursor: cargando ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                  {cargando ? 'Cargando...' : `Cargar más (${totalCount - participantes.length} restantes)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '520px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>Agregar participante</div>
              <button onClick={() => { setModal(false); setBusquedaColab(''); setResultados([]) }}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }}>Capacitación *</label>
                <select value={capSeleccionada} onChange={e => setCapSeleccionada(e.target.value)} style={{ ...inp, width: '100%' }}>
                  <option value="">Seleccionar capacitación...</option>
                  {capacitaciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }}>Buscar colaborador *</label>
                <input
                  type="text"
                  placeholder="Escribí el nombre o correo..."
                  value={busquedaColab}
                  onChange={e => setBusquedaColab(e.target.value)}
                  style={{ ...inp, width: '100%' }}
                />
              </div>
              {resultados.length > 0 && (
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  {resultados.map((c, i) => (
                    <div key={c.id} onClick={() => agregar(c)}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', background: i % 2 === 0 ? 'white' : '#F8FAFC', borderBottom: i < resultados.length - 1 ? '1px solid #F1F5F9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '500', color: '#1E293B' }}>{c.nombre}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>{c.correo} · {c.gerencia}</div>
                      </div>
                      <span style={{ background: '#EEF0FF', color: '#8131B0', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                        {guardando ? '...' : '+ Agregar'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {busquedaColab && resultados.length === 0 && (
                <div style={{ fontSize: '13px', color: '#94A3B8', textAlign: 'center', padding: '10px' }}>No se encontraron colaboradores</div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { setModal(false); setBusquedaColab(''); setResultados([]) }}
                style={{ padding: '8px 18px', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', background: 'white' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
