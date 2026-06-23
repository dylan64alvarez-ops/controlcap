import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Importar() {
  const [estado, setEstado] = useState('idle')
  const [mensaje, setMensaje] = useState('')
  const [conteo, setConteo] = useState(0)

  function normalizar(texto) {
    if (!texto) return ''
    return texto.toString().trim()
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  async function procesarArchivo(e) {
    const archivo = e.target.files[0]
    if (!archivo) return

    setEstado('leyendo')
    setMensaje('Leyendo archivo Excel...')

    const buffer = await archivo.arrayBuffer()
    const wb = XLSX.read(buffer)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const filas = XLSX.utils.sheet_to_json(ws)

    setMensaje(`${filas.length} filas encontradas. Importando...`)
    setEstado('importando')

    let exitosos = 0
    for (const fila of filas) {
      const correo = fila['Correo Electrónico'] || fila['Correo'] || fila['correo'] || ''
      if (!correo) continue

      const colaborador = {
        correo: correo.toString().trim().toLowerCase(),
        nombre: fila['Nombre Completo'] || fila['Nombre'] || '',
        cedula: fila['Cédula'] || fila['Cedula'] || '',
        genero: fila['Género'] || fila['Genero'] || '',
        fecha_ingreso: fila['Fecha de Ingreso'] || fila['Fecha Ingreso'] || null,
        gerencia: normalizar(fila['Gerencia'] || ''),
        departamento: normalizar(fila['Departamento'] || ''),
        area: normalizar(fila['Área'] || fila['Area'] || ''),
        jefatura: fila['Jefatura'] || '',
        puesto: fila['Puesto'] || '',
        centro_gestor: fila['Centro Gestor'] || '',
        estado: 'Activo'
      }

      const { error } = await supabase
        .from('colaboradores')
        .upsert(colaborador, { onConflict: 'correo' })

      if (!error) exitosos++
    }

    setConteo(exitosos)
    setEstado('listo')
    setMensaje(`✅ ${exitosos} colaboradores importados correctamente.`)
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px' }}>
        Importar datos
      </h2>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
        Cargá tu Excel de colaboradores. El sistema detecta automáticamente las columnas.
      </p>

      {/* Zona de carga */}
      <div style={{
        border: '2px dashed #CBD5E1',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        background: 'white',
        marginBottom: '16px'
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div>
        <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>
          Seleccioná tu archivo Excel
        </div>
        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '20px' }}>
          .xlsx · .xls · .csv
        </div>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={procesarArchivo}
          style={{ display: 'none' }}
          id="fileInput"
        />
        <label
          htmlFor="fileInput"
          style={{
            background: '#5B4EE8',
            color: 'white',
            padding: '10px 24px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          Elegir archivo
        </label>
      </div>

      {/* Estado */}
      {estado !== 'idle' && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          background: estado === 'listo' ? '#F0FDF4' : '#EFF6FF',
          border: `1px solid ${estado === 'listo' ? '#BBF7D0' : '#BFDBFE'}`,
          fontSize: '13px',
          color: estado === 'listo' ? '#166534' : '#1E40AF'
        }}>
          {estado !== 'listo' && (
            <span style={{ marginRight: '8px' }}>⏳</span>
          )}
          {mensaje}
        </div>
      )}

      {/* Columnas esperadas */}
      <div style={{ marginTop: '24px', background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '12px', color: '#374151' }}>
          Columnas que debe tener tu Excel:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {[
            'Correo Electrónico *',
            'Nombre Completo *',
            'Cédula',
            'Género',
            'Fecha de Ingreso',
            'Gerencia *',
            'Departamento *',
            'Área',
            'Jefatura',
            'Puesto',
            'Centro Gestor',
          ].map(col => (
            <div key={col} style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: col.includes('*') ? '#0F9B72' : '#CBD5E1' }}>●</span>
              {col}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px' }}>
          * Campos obligatorios
        </div>
      </div>
    </div>
  )
}
