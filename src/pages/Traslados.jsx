import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const VACIO = {
  centro_gestor: '', posicion: '', importe: '', cd: 'CR', texto: ''
}

export default function Traslados() {
  const [lista, setLista] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('presupuesto')
      .select('*')
      .eq('estado', 'Traslado')
      .order('created_at', { ascending: false })
    if (data) setLista(data)
    setCargando(false)
  }

  function cambiar(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function guardar() {
    if (!form.centro_gestor || !form.posicion || !form.importe || !form.cd || !form.texto) {
      alert('Todos los campos son obligatorios'); return
    }
    setGuardando(true)
    const { error } = await supabase.from('presupuesto').insert([{
      centro_gestor: form.centro_gestor,
      posicion: form.posicion,
      importe: Number(form.importe),
      cd: form.cd,
      texto: form.texto,
      estado: 'Traslado',
      fecha: new Date().toISOString().split('T')[0]
    }])
    if (!error) {
      setExito('✅ Traslado registrado correctamente')
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

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#64748B' }}>{lista.length} traslados registrados</div>
        <button onClick={() => { setModal(true); setForm(VACIO) }}
          style={{ background: '#5B4EE8', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
          + Nuevo traslado
        </button>
      </div>

      {/* Tabla */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Cargando...</div>
        ) : lista.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>↔️</div>
            <div style={{ fontWeight: '500' }}>No hay traslados registrados aún</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Centro Gestor', 'Posición Presupuestaria', 'Importe', 'CD', 'Texto', 'Fecha'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '500' }}>{t.centro_gestor}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{t.posicion}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: '#5B4EE8' }}>
                    ₡{Number(t.importe).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: t.cd === 'CR' ? '#FEE2E2' : '#D1FAE5', color: t.cd === 'CR' ? '#991B1B' : '#065F46', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                      {t.cd}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', color: '#374151' }}>{t.texto}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748B' }}>{t.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal — solo 5 campos */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '480px', maxWidth: '95vw' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>Traslado presupuestario</div>
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
                  <input name="importe" type="number" value={form.importe} onChange={cambiar} style={inp} placeholder="0" min="0" />
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
                <input name="texto" value={form.texto} onChange={cambiar} style={inp} placeholder="Descripción del traslado" />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 18px', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', background: 'white' }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                style={{ padding: '8px 20px', background: '#5B4EE8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {guardando ? 'Guardando...' : '💾 Guardar traslado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
