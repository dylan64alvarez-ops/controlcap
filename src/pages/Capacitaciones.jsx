import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const CATEGORIAS = [
  'UC1 - Inducción Corporativa',
  'UC1 - Formación al Puesto',
  'UC2 - Capacitaciones Normativas',
  'UC2 - Desarrollo de Competencias',
  'UC3 - Capacitación Especializada',
  'UC3 - Transformación Empresarial',
  'UC4 - Puestos Claves',
  'UC4 - Programa de Liderazgo',
  'UC5 - Salud y Bienestar',
]

const VACIO = {
  nombre: '', categoria: '', modalidad: 'Virtual',
  estado: 'Programada', facilitador: '', proveedor: '',
  fecha_inicio: '', fecha_fin: '', horas: '', costo: ''
}

export default function Capacitaciones() {
  const [lista, setLista] = useState([])
  const [filtradas, setFiltradas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState('')

  useEffect(() => { cargar() }, [])
  useEffect(() => { filtrar() }, [busqueda, filtroEstado, filtroCategoria, lista])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('capacitaciones')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setLista(data)
    setCargando(false)
  }

  function filtrar() {
    let l = [...lista]
    if (busqueda) {
      const b = busqueda.toLowerCase()
      l = l.filter(c => c.nombre?.toLowerCase().includes(b) || c.facilitador?.toLowerCase().includes(b) || c.proveedor?.toLowerCase().includes(b))
    }
    if (filtroEstado) l = l.filter(c => c.estado === filtroEstado)
    if (filtroCategoria) l = l.filter(c => c.categoria === filtroCategoria)
    setFiltradas(l)
  }

  function cambiar(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function guardar() {
    if (!form.nombre || !form.categoria || !form.fecha_inicio || !form.fecha_fin || !form.horas) {
      alert('Completá los campos obligatorios (*)'); return
    }
    setGuardando(true)
    const { error } = await supabase.from('capacitaciones').insert([{
      ...form,
      horas: Number(form.horas),
      costo: Number(form.costo) || 0
    }])
    if (!error) {
      setExito('✅ Capacitación registrada correctamente')
      setModal(false)
      setForm(VACIO)
      cargar()
      setTimeout(() => setExito(''), 3000)
    } else {
      alert('Error: ' + error.message)
    }
    setGuardando(false)
  }

  const estadoColor = { 'Programada': '#DBEAFE', 'En curso': '#D1FAE5', 'Completada': '#EDE9FE', 'Cancelada': '#FEE2E2' }
  const estadoTexto = { 'Programada': '#1E40AF', 'En curso': '#065F46', 'Completada': '#5B21B6', 'Cancelada': '#991B1B' }
  const inp = { height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', fontSize: '13px', width: '100%', outline: 'none', background: 'white' }
  const lbl = { fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }

  return (
    <div>
      {exito && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
          {exito}
        </div>
      )}

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#64748B' }}>{filtradas.length} de {lista.length} capacitaciones</div>
        <button onClick={() => { setModal(true); setForm(VACIO) }}
          style={{ background: '#5B4EE8', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
          + Nueva capacitación
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: '200px' }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ ...inp, width: '150px' }}>
          <option value="">Todos los estados</option>
          {['Programada','En curso','Completada','Cancelada'].map(e => <option key={e}>{e}</option>)}
        </select>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ ...inp, width: '220px' }}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎓</div>
            <div style={{ fontWeight: '500', marginBottom: '6px' }}>No hay capacitaciones aún</div>
            <div style={{ fontSize: '13px' }}>Hacé clic en "+ Nueva capacitación" para registrar la primera</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Nombre','Categoría','Modalidad','Facilitador','Fecha inicio','Fecha fin','Horas','Costo','Estado'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #E2E8F0', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '500', color: '#1E293B', fontSize: '13px' }}>{c.nombre}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#5B4EE8' }}>{c.categoria}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{c.modalidad}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{c.facilitador}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{c.fecha_inicio}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{c.fecha_fin}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '500', color: '#0F9B72' }}>{c.horas}h</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>₡{Number(c.costo).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: estadoColor[c.estado] || '#F1F5F9', color: estadoTexto[c.estado] || '#64748B', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                      {c.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nueva capacitación */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '580px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>Nueva capacitación</div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Nombre de la capacitación *</label>
                <input name="nombre" value={form.nombre} onChange={cambiar} style={inp} placeholder="Ej: Código de Conducta 2025" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Categoría UC *</label>
                <select name="categoria" value={form.categoria} onChange={cambiar} style={inp}>
                  <option value="">Seleccionar...</option>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Modalidad *</label>
                <select name="modalidad" value={form.modalidad} onChange={cambiar} style={inp}>
                  {['Presencial','Virtual','Híbrida','E-learning'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Estado</label>
                <select name="estado" value={form.estado} onChange={cambiar} style={inp}>
                  {['Programada','En curso','Completada','Cancelada'].map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Facilitador</label>
                <input name="facilitador" value={form.facilitador} onChange={cambiar} style={inp} placeholder="Nombre del facilitador" />
              </div>
              <div>
                <label style={lbl}>Empresa proveedora</label>
                <input name="proveedor" value={form.proveedor} onChange={cambiar} style={inp} placeholder="Nombre del proveedor" />
              </div>
              <div>
                <label style={lbl}>Fecha de inicio *</label>
                <input name="fecha_inicio" type="date" value={form.fecha_inicio} onChange={cambiar} style={inp} />
              </div>
              <div>
                <label style={lbl}>Fecha de fin *</label>
                <input name="fecha_fin" type="date" value={form.fecha_fin} onChange={cambiar} style={inp} />
              </div>
              <div>
                <label style={lbl}>Horas *</label>
                <input name="horas" type="number" value={form.horas} onChange={cambiar} style={inp} placeholder="0" min="0" />
              </div>
              <div>
                <label style={lbl}>Costo total (₡)</label>
                <input name="costo" type="number" value={form.costo} onChange={cambiar} style={inp} placeholder="0" min="0" />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 18px', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', background: 'white' }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                style={{ padding: '8px 20px', background: '#5B4EE8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {guardando ? 'Guardando...' : '💾 Guardar capacitación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
