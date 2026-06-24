import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const VACIO = {
  centro_gestor: '', posicion: '', importe: '',
  cd: 'CR', texto: '', fecha: '', estado: 'Pendiente'
}

export default function Presupuesto() {
  const [lista, setLista] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState('')
  const [cargando, setCargando] = useState(true)

  const totalEjecutado = lista.filter(m => m.cd === 'CR').reduce((s, m) => s + Number(m.importe), 0)
  const totalAbonos = lista.filter(m => m.cd === 'AB').reduce((s, m) => s + Number(m.importe), 0)
  const saldo = totalAbonos - totalEjecutado

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('presupuesto')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setLista(data)
    setCargando(false)
  }

  function cambiar(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function guardar() {
    if (!form.centro_gestor || !form.posicion || !form.importe || !form.cd || !form.texto) {
      alert('Completá los campos obligatorios (*)'); return
    }
    setGuardando(true)
    const { error } = await supabase.from('presupuesto').insert([{
      ...form,
      importe: Number(form.importe)
    }])
    if (!error) {
      setExito('✅ Movimiento registrado correctamente')
      setModal(false)
      setForm(VACIO)
      cargar()
      setTimeout(() => setExito(''), 3000)
    } else {
      alert('Error: ' + error.message)
    }
    setGuardando(false)
  }

  const inp = { height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', fontSize: '13px', width: '100%', outline: 'none', background: 'white' }
  const lbl = { fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '5px' }

  return (
    <div>
      {exito && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
          {exito}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total ejecutado (CR)', valor: totalEjecutado, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Total abonos (AB)',    valor: totalAbonos,    color: '#0F9B72', bg: '#F0FDF4' },
          { label: 'Saldo neto',           valor: saldo,          color: '#5B4EE8', bg: '#EEF0FF' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: '12px', padding: '20px', border: `1px solid ${k.color}22` }}>
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>{k.label}</div>
            <div style={{ fontSize: '24px', fontWeight: '600', color: k.color }}>
              ₡{Math.abs(k.valor).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#64748B' }}>{lista.length} movimientos registrados</div>
        <button onClick={() => { setModal(true); setForm(VACIO) }}
          style={{ background: '#5B4EE8', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
          + Nuevo movimiento
        </button>
      </div>

      {/* Tabla */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Cargando...</div>
        ) : lista.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>💰</div>
            <div style={{ fontWeight: '500' }}>No hay movimientos aún</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Centro Gestor','Posición','CD','Texto','Importe','Fecha','Estado'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((m, i) => (
                <tr key={m.id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '500' }}>{m.centro_gestor}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{m.posicion}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: m.cd === 'CR' ? '#FEE2E2' : '#D1FAE5', color: m.cd === 'CR' ? '#991B1B' : '#065F46', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                      {m.cd}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', color: '#374151' }}>{m.texto}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: m.cd === 'CR' ? '#DC2626' : '#0F9B72' }}>
                    {m.cd === 'CR' ? '-' : '+'}₡{Number(m.importe).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{m.fecha}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: m.estado === 'Ejecutado' ? '#D1FAE5' : '#FEF3C7', color: m.estado === 'Ejecutado' ? '#065F46' : '#92400E', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                      {m.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '500px', maxWidth: '95vw' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>Nuevo movimiento presupuestario</div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={lbl}>Centro Gestor *</label>
                <input name="centro_gestor" value={form.centro_gestor} onChange={cambiar} style={inp} placeholder="Ej: 1001 · Tecnología" />
              </div>
              <div>
                <label style={lbl}>Posición Presupuestaria *</label>
                <input name="posicion" value={form.posicion} onChange={cambiar} style={inp} placeholder="Ej: C-450001" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={lbl}>Importe (₡) *</label>
                  <input name="importe" type="number" value={form.importe} onChange={cambiar} style={inp} placeholder="0" />
                </div>
                <div>
                  <label style={lbl}>CD *</label>
                  <select name="cd" value={form.cd} onChange={cambiar} style={inp}>
                    <option value="CR">CR · Crédito</option>
                    <option value="AB">AB · Abono</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Texto *</label>
                <input name="texto" value={form.texto} onChange={cambiar} style={inp} placeholder="Descripción del movimiento" />
              </div>
              <div>
                <label style={lbl}>Fecha</label>
                <input name="fecha" type="date" value={form.fecha} onChange={cambiar} style={inp} />
              </div>
              <div>
                <label style={lbl}>Estado</label>
                <select name="estado" value={form.estado} onChange={cambiar} style={inp}>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Ejecutado">Ejecutado</option>
                </select>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 18px', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', background: 'white' }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                style={{ padding: '8px 20px', background: '#5B4EE8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {guardando ? 'Guardando...' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
