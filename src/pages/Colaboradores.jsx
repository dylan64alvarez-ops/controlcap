import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Colaboradores() {
  const [colaboradores, setColaboradores] = useState([])
  const [filtrados, setFiltrados] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [gerencia, setGerencia] = useState('')
  const [gerencias, setGerencias] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

  useEffect(() => {
    filtrar()
  }, [busqueda, gerencia, colaboradores])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('colaboradores')
      .select('*')
      .order('nombre')
    if (data) {
      setColaboradores(data)
      const gers = [...new Set(data.map(c => c.gerencia).filter(Boolean))].sort()
      setGerencias(gers)
    }
    setCargando(false)
  }

  function filtrar() {
    let lista = [...colaboradores]
    if (busqueda) {
      const b = busqueda.toLowerCase()
      lista = lista.filter(c =>
        c.nombre?.toLowerCase().includes(b) ||
        c.correo?.toLowerCase().includes(b) ||
        c.puesto?.toLowerCase().includes(b) ||
        c.cedula?.includes(b)
      )
    }
    if (gerencia) {
      lista = lista.filter(c => c.gerencia === gerencia)
    }
    setFiltrados(lista)
  }

  const tdStyle = { padding: '9px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '13px', color: '#374151' }
  const thStyle = { padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #E2E8F0', textAlign: 'left', background: '#F8FAFC' }

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#64748B' }}>
            {filtrados.length} de {colaboradores.length} colaboradores
          </div>
        </div>
        <button onClick={cargar} style={{ background: '#EEF0FF', color: '#5B4EE8', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
          🔄 Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Buscar por nombre, correo, cédula, puesto..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ flex: 1, minWidth: '260px', height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', fontSize: '13px', outline: 'none' }}
        />
        <select
          value={gerencia}
          onChange={e => setGerencia(e.target.value)}
          style={{ height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', fontSize: '13px', background: 'white', minWidth: '180px' }}
        >
          <option value="">Todas las gerencias</option>
          {gerencias.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        {(busqueda || gerencia) && (
          <button onClick={() => { setBusqueda(''); setGerencia('') }}
            style={{ height: '36px', padding: '0 14px', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Cargando colaboradores...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Correo</th>
                  <th style={thStyle}>Cédula</th>
                  <th style={thStyle}>Género</th>
                  <th style={thStyle}>Gerencia</th>
                  <th style={thStyle}>Departamento</th>
                  <th style={thStyle}>Puesto</th>
                  <th style={thStyle}>Centro Gestor</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c, i) => (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                    <td style={{ ...tdStyle, fontWeight: '500', color: '#1E293B' }}>{c.nombre}</td>
                    <td style={{ ...tdStyle, color: '#5B4EE8', fontSize: '12px' }}>{c.correo}</td>
                    <td style={tdStyle}>{c.cedula}</td>
                    <td style={tdStyle}>
                      <span style={{ background: c.genero?.toUpperCase().includes('F') ? '#FCE7F3' : '#DBEAFE', color: c.genero?.toUpperCase().includes('F') ? '#9D174D' : '#1E40AF', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                        {c.genero}
                      </span>
                    </td>
                    <td style={tdStyle}>{c.gerencia}</td>
                    <td style={tdStyle}>{c.departamento}</td>
                    <td style={{ ...tdStyle, fontSize: '12px' }}>{c.puesto}</td>
                    <td style={tdStyle}>{c.centro_gestor}</td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>
                      No se encontraron colaboradores con ese filtro
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
