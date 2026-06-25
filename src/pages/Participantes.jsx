import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Participantes({ onCambio }) {
  const [participantes, setParticipantes] = useState([])
  const [capacitaciones, setCapacitaciones] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [modal, setModal] = useState(false)
  const [busquedaColab, setBusquedaColab] = useState('')
  const [resultados, setResultados] = useState([])
  const [capSeleccionada, setCapSeleccionada] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState('')
  const [filtroCap, setFiltroCap] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)

    const [pRes, cRes, colRes] = await Promise.all([
      supabase.from('participantes').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('capacitaciones').select('id, nombre, horas, fecha_inicio').order('nombre'),
      supabase.from('colaboradores').select('id, nombre, correo, gerencia, departamento, puesto').order('nombre')
    ])

    const caps = cRes.data || []
    const cols = colRes.data || []
    const parts = pRes.data || []

    const capMap = {}
    caps.forEach(c => { capMap[c.id] = c })

    const colByIdMap = {}
    const colByCorreoMap = {}
    cols.forEach(c => {
      colByIdMap[c.id] = c
      if (c.correo) colByCorreoMap[c.correo.toLowerCase().trim()] = c
    })

    const enriquecidos = parts.map(p => {
      const cap = capMap[p.capacitacion_id] || null
      const col = colByIdMap[p.colaborador_id] || colByCorreoMap[p.correo?.toLowerCase().trim()] || null
      const anio = cap?.fecha_inicio ? new Date(cap.fecha_inicio).getFullYear() : null
      return { ...p, _cap: cap, _col: col, _anio: anio }
    })

    setParticipantes(enriquecidos)
    setCapacitaciones(caps)
    setColaboradores(cols)
    setCargando(false)
  }

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

  const filtrados = participantes.filter(p => {
    const matchCap = !filtroCap || p.capacitacion_id === filtroCap
    const matchAnio = !filtroAnio || p._anio === parseInt(filtroAnio)
    if (!busqueda) return matchCap && matchAnio
    const t = busqueda.toLowerCase()
    const nombre = (p._col?.nombre || '').toLowerCase()
    const correo = (p.correo || '').toLowerCase()
    const cap = (p._cap?.nombre || '').toLowerCase()
    const gerencia = (p._col?.gerencia || '').toLowerCase()
    return matchCap && matchAnio && (
      nombre.includes(t) ||
      correo.includes(t) ||
      cap.includes(t) ||
      gerencia.includes(t)
    )
  })

  async function agregar(colaborador) {
    if (!capSeleccionada) { alert('Seleccioná una capacitación primero'); return }
    const yaExiste = participantes.find(
      p => p.colaborador_id === colaborador.id && p.capacitacion_id === capSeleccionada
    )
    if (yaExiste) { alert('Este colaborador ya está en esa capacitación'); return }

    const cap = capacitaciones.find(c => c.id === capSeleccionada)
    setGuardando(true)
    const { error } = await supabase.from('participantes').insert([{
      capacitacion_id: capSeleccionada,
      colaborador_id: colaborador.id,
      correo: colaborador.correo.toLowerCase().trim(),
      horas: cap?.horas || 0,
      genero: null,
    }])
    if (!error) {
      setExito(`✅ ${colaborador.nombre} agregado correctamente`)
      setBusquedaColab('')
      setResultados([])
      cargar()
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

  const hayFiltros = filtroCap || filtroAnio || busqueda

  return (
    <div>
      {exito && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
          {exito}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#64748B' }}>
          {cargando ? 'Cargando...' : `${filtrados.length} participantes${hayFiltros ? ' (filtrados)' : ''}`}
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
          placeholder="🔍 Nombre, correo, capacitación o gerencia..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ ...inp, width: '280px' }}
        />
        <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}
          style={{ ...inp, width: '110px' }}>
          <option value="">Todos los años</option>
          {['2026','2025','2024','2023','2022','2021'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={filtroCap} onChange={e => setFiltroCap(e.target.value)}
          style={{ ...inp, width: '300px' }}>
          <option value="">Todas las capacitaciones</option>
          {capacitaciones
            .filter(c => !filtroAnio || (c.fecha_inicio && new Date(c.fecha_inicio).getFullYear() === parseInt(filtroAnio)))
            .map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {hayFiltros && (
          <button onClick={() => { setFiltroCap(''); setFiltroAnio(''); setBusqueda('') }}
            style={{ ...inp, width: 'auto', padding: '0 14px', cursor: 'pointer', color: '#64748B' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Cargando participantes...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>👥</div>
            <div style={{ fontWeight: '500', marginBottom: '6px' }}>No hay participantes</div>
            <div style={{ fontSize: '13px' }}>Ajustá los filtros o agregá colaboradores a una capacitación</div>
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
                {filtrados.slice(0, 200).map((p, i) => {
                  const correoMostrar = (!p.correo || p.correo.startsWith('sin-correo__')) ? '—' : p.correo
                  return (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '500', fontSize: '13px', whiteSpace: 'nowrap' }}>{p._col?.nombre || '—'}</td>
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
            {filtrados.length > 200 && (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94A3B8', borderTop: '1px solid #E2E8F0' }}>
                Mostrando 200 de {filtrados.length}. Usá los filtros para reducir resultados.
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
