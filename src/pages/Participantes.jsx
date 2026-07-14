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
  const [proveedores, setProveedores] = useState([])
  const [capMap, setCapMap] = useState({})
  const [colByIdMap, setColByIdMap] = useState({})
  const [colByCorreoMap, setColByCorreoMap] = useState({})
  const [colByNombreMap, setColByNombreMap] = useState({})
  const [modal, setModal] = useState(false)
  const [modoMasivo, setModoMasivo] = useState(false)
  const [busquedaColab, setBusquedaColab] = useState('')
  const [correosMasivos, setCorreosMasivos] = useState('')
  const [resultados, setResultados] = useState([])
  const [resultadosMasivos, setResultadosMasivos] = useState([])
  const [capSeleccionada, setCapSeleccionada] = useState('')
  const [busquedaCap, setBusquedaCap] = useState('')
  const [capSeleccionadaNombre, setCapSeleccionadaNombre] = useState('')
  const [resultadosCap, setResultadosCap] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState('')
  const [filtroCap, setFiltroCap] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('2026')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [cargadoInicial, setCargadoInicial] = useState(false)
  const [paginaActual, setPaginaActual] = useState(0)

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setCargando(true)
    const [cRes, colRes] = await Promise.all([
      supabase.from('capacitaciones').select('id, nombre, horas, fecha_inicio, proveedor').order('nombre'),
      supabase.from('colaboradores').select('id, nombre, correo, gerencia, departamento, puesto').order('nombre')
    ])

    const caps = cRes.data || []
    const cols = colRes.data || []

    const cMap = {}
    caps.forEach(c => { cMap[c.id] = c })

    const cById = {}, cByCorreo = {}, cByNombre = {}
    cols.forEach(c => {
      cById[c.id] = c
      if (c.correo) cByCorreo[c.correo.toLowerCase().trim()] = c
      if (c.nombre) cByNombre[c.nombre.toUpperCase().trim()] = c
    })

    const provsUnicas = [...new Set(caps.map(c => c.proveedor).filter(Boolean))].sort()

    setCapacitaciones(caps)
    setColaboradores(cols)
    setProveedores(provsUnicas)
    setCapMap(cMap)
    setColByIdMap(cById)
    setColByCorreoMap(cByCorreo)
    setColByNombreMap(cByNombre)

    await buscarConFiltros(0, '2026', '', '', '', cMap, cById, cByCorreo, cByNombre, caps, true)
    setCargadoInicial(true)
    setCargando(false)
  }

  async function buscarConFiltros(pag, anio, cap, prov, busq, cMapR, cByIdR, cByCorreoR, cByNombreR, capsR, reset) {
    const cMapU = cMapR || capMap
    const cByIdU = cByIdR || colByIdMap
    const cByCorreoU = cByCorreoR || colByCorreoMap
    const cByNombreU = cByNombreR || colByNombreMap
    const capsU = capsR || capacitaciones

    const desde = pag * POR_PAGINA
    const hasta = desde + POR_PAGINA - 1

    let capIds = null
    if (anio || prov) {
      let capsFiltered = capsU
      if (anio) capsFiltered = capsFiltered.filter(c => c.fecha_inicio && new Date(c.fecha_inicio).getFullYear() === parseInt(anio))
      if (prov) capsFiltered = capsFiltered.filter(c => c.proveedor === prov)
      if (capsFiltered.length === 0 && !busq) { setParticipantes([]); setTotalCount(0); return }
      if (capsFiltered.length > 0) capIds = capsFiltered.map(c => c.id)
    }

    let correosEncontrados = null
    if (busq && busq.trim().length > 0) {
      const t = busq.toLowerCase().trim()
      const colsMatch = Object.values(cByIdU).filter(c =>
        c.nombre?.toLowerCase().includes(t) || c.correo?.toLowerCase().includes(t) ||
        c.gerencia?.toLowerCase().includes(t) || c.puesto?.toLowerCase().includes(t)
      )
      correosEncontrados = colsMatch.map(c => c.correo?.toLowerCase().trim()).filter(Boolean)

      let qNombre = supabase.from('participantes').select('correo').ilike('nombre_colab', `%${t}%`)
      if (capIds) qNombre = qNombre.in('capacitacion_id', capIds)
      const { data: pNombres } = await qNombre
      if (pNombres) correosEncontrados = [...new Set([...correosEncontrados, ...pNombres.map(p => p.correo?.toLowerCase().trim()).filter(Boolean)])]

      let qGer = supabase.from('participantes').select('correo').ilike('gerencia_colab', `%${t}%`)
      if (capIds) qGer = qGer.in('capacitacion_id', capIds)
      const { data: pGer } = await qGer
      if (pGer) correosEncontrados = [...new Set([...correosEncontrados, ...pGer.map(p => p.correo?.toLowerCase().trim()).filter(Boolean)])]

      let qCorreo = supabase.from('participantes').select('correo').ilike('correo', `%${t}%`)
      if (capIds) qCorreo = qCorreo.in('capacitacion_id', capIds)
      const { data: pCorreos } = await qCorreo
      if (pCorreos) correosEncontrados = [...new Set([...correosEncontrados, ...pCorreos.map(p => p.correo?.toLowerCase().trim()).filter(Boolean)])]

      if (correosEncontrados.length === 0) { setParticipantes([]); setTotalCount(0); return }
    }

    let q = supabase.from('participantes').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).range(desde, hasta)

    if (capIds) q = q.in('capacitacion_id', capIds)
    if (cap) q = q.eq('capacitacion_id', cap)
    if (correosEncontrados) q = q.in('correo', correosEncontrados)

    const { data, count } = await q

    const enriquecidos = (data || []).map(p => {
      const c = cMapU[p.capacitacion_id] || null
      const col = cByIdU[p.colaborador_id] ||
        (p.correo && !p.correo.startsWith('sin-correo__') ? cByCorreoU[p.correo.toLowerCase().trim()] : null) ||
        (p.nombre_colab ? cByNombreU[p.nombre_colab.toUpperCase().trim()] : null) || null
      const correoResuelto = col?.correo || (p.correo && !p.correo.startsWith('sin-correo__') ? p.correo : null) || null
      return {
        ...p, _cap: c, _col: col,
        _anio: c?.fecha_inicio ? new Date(c.fecha_inicio).getFullYear() : null,
        _nombre: col?.nombre || p.nombre_colab || '—',
        _correo: correoResuelto || '—',
        _gerencia: col?.gerencia || p.gerencia_colab || '—',
        _departamento: col?.departamento || p.departamento_colab || '—',
        _puesto: col?.puesto || p.puesto_colab || '—',
        _proveedor: c?.proveedor || '—',
      }
    })

    if (reset || pag === 0) setParticipantes(enriquecidos)
    else setParticipantes(prev => [...prev, ...enriquecidos])
    setTotalCount(count || 0)
    setPaginaActual(pag)
  }

  useEffect(() => {
    if (!cargadoInicial) return
    const timer = setTimeout(() => {
      setCargando(true)
      buscarConFiltros(0, filtroAnio, filtroCap, filtroProveedor, busqueda, null, null, null, null, null, true)
        .then(() => setCargando(false))
    }, 400)
    return () => clearTimeout(timer)
  }, [busqueda, filtroAnio, filtroCap, filtroProveedor, cargadoInicial])

  // Búsqueda de capacitación en modal
  useEffect(() => {
    if (!busquedaCap || busquedaCap.length < 2) { setResultadosCap([]); return }
    const b = busquedaCap.toLowerCase()
    setResultadosCap(
      capacitaciones.filter(c => c.nombre?.toLowerCase().includes(b)).slice(0, 8)
    )
  }, [busquedaCap, capacitaciones])

  // Búsqueda de colaborador en modal
  useEffect(() => {
    if (!busquedaColab) { setResultados([]); return }
    const b = busquedaColab.toLowerCase()
    setResultados(
      colaboradores.filter(c =>
        c.nombre?.toLowerCase().includes(b) || c.correo?.toLowerCase().includes(b)
      ).slice(0, 8)
    )
  }, [busquedaColab, colaboradores])

  // Procesar correos masivos
  useEffect(() => {
    if (!correosMasivos.trim()) { setResultadosMasivos([]); return }
    const lineas = correosMasivos.split(/[\n,;]+/).map(l => l.trim().toLowerCase()).filter(l => l.includes('@'))
    const encontrados = lineas.map(correo => {
      const col = colByCorreoMap[correo]
      return { correo, col: col || null, encontrado: !!col, nombre: col?.nombre || '—', gerencia: col?.gerencia || '—' }
    })
    setResultadosMasivos(encontrados)
  }, [correosMasivos, colByCorreoMap])

  function seleccionarCap(cap) {
    setCapSeleccionada(cap.id)
    setCapSeleccionadaNombre(cap.nombre)
    setBusquedaCap(cap.nombre)
    setResultadosCap([])
  }

  function limpiarCap() {
    setCapSeleccionada('')
    setCapSeleccionadaNombre('')
    setBusquedaCap('')
    setResultadosCap([])
  }

  function cerrarModal() {
    setModal(false)
    setBusquedaColab('')
    setCorreosMasivos('')
    setResultados([])
    setResultadosMasivos([])
    limpiarCap()
    setModoMasivo(false)
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
      genero: null, costo: 0,
      nombre_colab: colaborador.nombre,
      gerencia_colab: colaborador.gerencia || null,
      departamento_colab: colaborador.departamento || null,
      puesto_colab: colaborador.puesto || null,
    }])
    if (!error) {
      setExito(`✅ ${colaborador.nombre} agregado correctamente`)
      setBusquedaColab('')
      setResultados([])
      setCargando(true)
      await buscarConFiltros(0, filtroAnio, filtroCap, filtroProveedor, busqueda, null, null, null, null, null, true)
      setCargando(false)
      if (onCambio) onCambio()
      setTimeout(() => setExito(''), 3000)
    } else { alert('Error: ' + error.message) }
    setGuardando(false)
  }

  async function agregarMasivo() {
    if (!capSeleccionada) { alert('Seleccioná una capacitación primero'); return }
    if (resultadosMasivos.length === 0) { alert('No hay correos válidos para agregar'); return }
    const cap = capacitaciones.find(c => c.id === capSeleccionada)
    setGuardando(true)
    let insertados = 0, omitidos = 0, errores = 0
    for (const item of resultadosMasivos) {
      if (!item.encontrado) { omitidos++; continue }
      const { error } = await supabase.from('participantes').insert([{
        capacitacion_id: capSeleccionada,
        colaborador_id: item.col.id,
        correo: item.correo,
        horas: cap?.horas || 0,
        genero: null, costo: 0,
        nombre_colab: item.col.nombre,
        gerencia_colab: item.col.gerencia || null,
        departamento_colab: item.col.departamento || null,
        puesto_colab: item.col.puesto || null,
      }])
      if (!error) insertados++
      else if (error.code === '23505') omitidos++
      else errores++
    }
    setGuardando(false)
    setExito(`✅ ${insertados} participantes agregados${omitidos > 0 ? `, ${omitidos} omitidos` : ''}${errores > 0 ? `, ${errores} errores` : ''}`)
    cerrarModal()
    setCargando(true)
    await buscarConFiltros(0, filtroAnio, filtroCap, filtroProveedor, busqueda, null, null, null, null, null, true)
    setCargando(false)
    if (onCambio) onCambio()
    setTimeout(() => setExito(''), 5000)
  }

  async function cargarMas() {
    const nueva = paginaActual + 1
    setCargando(true)
    await buscarConFiltros(nueva, filtroAnio, filtroCap, filtroProveedor, busqueda, null, null, null, null, null, false)
    setCargando(false)
  }

  const capsFiltradasSelector = capacitaciones
    .filter(c => !filtroAnio || (c.fecha_inicio && new Date(c.fecha_inicio).getFullYear() === parseInt(filtroAnio)))
    .filter(c => !filtroProveedor || c.proveedor === filtroProveedor)

  const hayFiltros = filtroCap || busqueda || filtroProveedor
  const inp = { height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', fontSize: '13px', outline: 'none', background: 'white' }

  return (
    <div>
      {exito && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
          {exito}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#64748B' }}>
          {cargando ? 'Buscando...' : `${participantes.length} de ${totalCount.toLocaleString()} participantes`}
        </div>
        <button onClick={() => setModal(true)}
          style={{ background: '#8131B0', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
          + Agregar participante
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="🔍 Nombre, correo, capacitación, gerencia..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ ...inp, width: '260px' }} />
        <select value={filtroAnio} onChange={e => { setFiltroAnio(e.target.value); setFiltroCap('') }}
          style={{ ...inp, width: '120px' }}>
          <option value="">Todos los años</option>
          {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtroProveedor} onChange={e => { setFiltroProveedor(e.target.value); setFiltroCap('') }}
          style={{ ...inp, width: '200px' }}>
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtroCap} onChange={e => setFiltroCap(e.target.value)}
          style={{ ...inp, width: '260px' }}>
          <option value="">Todas las capacitaciones</option>
          {capsFiltradasSelector.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {hayFiltros && (
          <button onClick={() => { setFiltroCap(''); setBusqueda(''); setFiltroProveedor('') }}
            style={{ ...inp, width: 'auto', padding: '0 14px', cursor: 'pointer', color: '#64748B' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {cargando && participantes.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Cargando participantes...</div>
        ) : participantes.length === 0 ? (
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
                  {['Colaborador', 'Correo', 'Gerencia', 'Puesto', 'Capacitación', 'Proveedor', 'Año', 'Horas', 'Género'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #E2E8F0', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {participantes.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '500', fontSize: '13px', whiteSpace: 'nowrap' }}>{p._nombre}</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#0072DA' }}>{p._correo}</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{p._gerencia}</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p._puesto}</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#374151', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p._cap?.nombre || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p._proveedor}</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{p._anio || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: '#0F9B72' }}>{p.horas || 0}h</td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>
                      {p.genero === 'FEMENINO' ? '♀ F' : p.genero === 'MASCULINO' ? '♂ M' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {participantes.length < totalCount && (
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
          <div style={{ background: 'white', borderRadius: '16px', width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>Agregar participante</div>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>✕</button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Búsqueda de capacitación */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }}>
                  Capacitación *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Buscar capacitación por nombre..."
                    value={busquedaCap}
                    onChange={e => {
                      setBusquedaCap(e.target.value)
                      if (capSeleccionada) limpiarCap()
                    }}
                    style={{ ...inp, width: '100%', paddingRight: capSeleccionada ? '32px' : '10px', borderColor: capSeleccionada ? '#0F9B72' : '#E2E8F0' }}
                  />
                  {capSeleccionada && (
                    <button onClick={limpiarCap}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '16px' }}>✕</button>
                  )}
                  {resultadosCap.length > 0 && (
                    <div style={{ position: 'absolute', top: '40px', left: 0, right: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '220px', overflowY: 'auto' }}>
                      {resultadosCap.map((c, i) => (
                        <div key={c.id} onClick={() => seleccionarCap(c)}
                          style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', borderBottom: i < resultadosCap.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                          <div style={{ fontWeight: '500', color: '#1E293B' }}>{c.nombre}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                            {c.proveedor || '—'} · {c.horas}h · {c.fecha_inicio?.slice(0, 4) || '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {capSeleccionada && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#0F9B72', fontWeight: '500' }}>
                    ✓ Capacitación seleccionada
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setModoMasivo(false)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500', background: !modoMasivo ? '#8131B0' : '#F1F5F9', color: !modoMasivo ? 'white' : '#64748B' }}>
                  👤 Individual
                </button>
                <button onClick={() => setModoMasivo(true)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500', background: modoMasivo ? '#8131B0' : '#F1F5F9', color: modoMasivo ? 'white' : '#64748B' }}>
                  👥 Masivo (pegar correos)
                </button>
              </div>

              {/* Individual */}
              {!modoMasivo && (
                <>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }}>Buscar colaborador *</label>
                    <input type="text" placeholder="Escribí el nombre o correo..."
                      value={busquedaColab} onChange={e => setBusquedaColab(e.target.value)}
                      style={{ ...inp, width: '100%' }} />
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
                </>
              )}

              {/* Masivo */}
              {modoMasivo && (
                <>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }}>
                      Pegá los correos (uno por línea, o separados por coma o punto y coma)
                    </label>
                    <textarea
                      value={correosMasivos}
                      onChange={e => setCorreosMasivos(e.target.value)}
                      placeholder={'usuario1@coopeande1.com\nusuario2@coopeande1.com\nusuario3@coopeande1.com'}
                      style={{ width: '100%', height: '120px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'monospace' }}
                    />
                  </div>
                  {resultadosMasivos.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px', display: 'flex', gap: '12px' }}>
                        <span style={{ color: '#0F9B72', fontWeight: '600' }}>✅ {resultadosMasivos.filter(r => r.encontrado).length} encontrados</span>
                        {resultadosMasivos.filter(r => !r.encontrado).length > 0 && (
                          <span style={{ color: '#DA2B1F', fontWeight: '600' }}>⚠️ {resultadosMasivos.filter(r => !r.encontrado).length} no encontrados</span>
                        )}
                      </div>
                      <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden', maxHeight: '200px', overflowY: 'auto' }}>
                        {resultadosMasivos.map((r, i) => (
                          <div key={i} style={{ padding: '8px 12px', fontSize: '12px', background: i % 2 === 0 ? 'white' : '#FAFAFA', borderBottom: i < resultadosMasivos.length - 1 ? '1px solid #F1F5F9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: '500', color: r.encontrado ? '#1E293B' : '#94A3B8' }}>
                                {r.encontrado ? r.nombre : r.correo}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                                {r.encontrado ? `${r.correo} · ${r.gerencia}` : 'No encontrado en el sistema'}
                              </div>
                            </div>
                            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', background: r.encontrado ? '#F0FDF4' : '#FEF2F2', color: r.encontrado ? '#0F9B72' : '#DA2B1F' }}>
                              {r.encontrado ? '✓' : '✗'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button onClick={agregarMasivo} disabled={guardando || resultadosMasivos.filter(r => r.encontrado).length === 0}
                        style={{ marginTop: '12px', width: '100%', background: guardando ? '#E2E8F0' : '#8131B0', color: guardando ? '#94A3B8' : 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500' }}>
                        {guardando ? '⏳ Agregando...' : `Agregar ${resultadosMasivos.filter(r => r.encontrado).length} participantes`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={cerrarModal}
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
