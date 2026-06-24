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
  const [detalle, setDetalle] = useState('')

  function normalizar(texto) {
    if (!texto) return ''
    return texto.toString().trim()
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  // Busca el valor de una fila probando múltiples nombres de columna
  function buscar(fila, opciones) {
    for (const op of opciones) {
      const val = fila[op]
      if (val !== undefined && val !== null && val !== '') {
        return val.toString().trim()
      }
    }
    return ''
  }

  async function procesarArchivo(e) {
    const archivo = e.target.files[0]
    if (!archivo) return

    setEstado('leyendo')
    setMensaje('Leyendo archivo Excel...')
    setDetalle('')

    const buffer = await archivo.arrayBuffer()
    const wb = XLSX.read(buffer)

    // Muestra todas las hojas disponibles
    const hojas = wb.SheetNames
    setDetalle(`Hojas encontradas: ${hojas.join(', ')}`)

    // Lee la primera hoja
    const ws = wb.Sheets[wb.SheetNames[0]]
    const filas = XLSX.utils.sheet_to_json(ws)

    if (filas.length === 0) {
      setEstado('error')
      setMensaje('❌ El archivo no tiene datos o la primera hoja está vacía.')
      setDetalle(`Hojas disponibles: ${hojas.join(', ')}. Asegurate que los datos estén en la primera hoja.`)
      return
    }

    // Muestra las columnas que encontró
    const columnas = Object.keys(filas[0])
    setDetalle(`Columnas detectadas: ${columnas.join(' | ')}`)
    setMensaje(`${filas.length} filas encontradas. Importando...`)
    setEstado('importando')

    let exitosos = 0
    let errores = 0

    for (const fila of filas) {
      // Busca el correo con múltiples variantes
      const correo = buscar(fila, [
        'Correo Electrónico', 'Correo electronico', 'Correo Electronico',
        'correo electrónico', 'correo electronico',
        'Correo', 'correo', 'Email', 'email', 'EMAIL',
        'CORREO', 'CORREO ELECTRÓNICO'
      ])

      if (!correo || !correo.includes('@')) continue

      const colaborador = {
        correo: correo.toLowerCase(),
        nombre: buscar(fila, ['Nombre Completo', 'Nombre', 'nombre', 'NOMBRE', 'nombre completo']),
        cedula: buscar(fila, ['Cédula', 'Cedula', 'cedula', 'CEDULA', 'cédula']),
        genero: buscar(fila, ['Género', 'Genero', 'genero', 'GENERO', 'género', 'Sexo', 'sexo']),
        fecha_ingreso: buscar(fila, ['Fecha de Ingreso', 'Fecha Ingreso', 'fecha ingreso', 'FECHA INGRESO', 'Fecha de ingreso']) || null,
        gerencia: normalizar(buscar(fila, ['Gerencia', 'gerencia', 'GERENCIA', 'Gerencias'])),
        departamento: normalizar(buscar(fila, ['Departamento', 'departamento', 'DEPARTAMENTO', 'Depto', 'depto'])),
        area: normalizar(buscar(fila, ['Área', 'Area', 'area', 'AREA', 'área'])),
        jefatura: buscar(fila, ['Jefatura', 'jefatura', 'JEFATURA', 'Jefe', 'jefe']),
        puesto: buscar(fila, ['Puesto', 'puesto', 'PUESTO', 'Cargo', 'cargo', 'Posición', 'posicion']),
        centro_gestor: buscar(fila, ['Centro Gestor', 'centro gestor', 'CENTRO GESTOR', 'CentroGestor', 'Centro']),
        estado: 'Activo'
      }

      const { error } = await supabase
        .from('colaboradores')
        .upsert(colaborador, { onConflict: 'correo' })

      if (!error) exitosos++
      else errores++
    }

    setEstado('listo')
    setMensaje(`✅ ${exitosos} colaboradores importados correctamente.`)
    if (errores > 0) setDetalle(`⚠️ ${errores} filas con error. Total procesadas: ${filas.length}`)
    else setDetalle(`Total procesadas: ${filas.length} filas.`)
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px' }}>Importar datos</h2>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
        Cargá tu Excel de colaboradores. El sistema detecta automáticamente las columnas.
      </p>

      <div style={{ border: '2px dashed #CBD5E1', borderRadius: '12px', padding: '40px', textAlign: 'center', background: 'white', marginBottom: '16px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div>
        <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Seleccioná tu archivo Excel</div>
        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '20px' }}>.xlsx · .xls · .csv</div>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={procesarArchivo} style={{ display: 'none' }} id="fileInput" />
        <label htmlFor="fileInput" style={{ background: '#5B4EE8', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
          Elegir archivo
        </label>
      </div>

      {estado !== 'idle' && (
        <div style={{ padding: '14px 16px', borderRadius: '8px', marginBottom: '12px',
          background: estado === 'listo' ? '#F0FDF4' : estado === 'error' ? '#FEF2F2' : '#EFF6FF',
          border: `1px solid ${estado === 'listo' ? '#BBF7D0' : estado === 'error' ? '#FECACA' : '#BFDBFE'}`,
          fontSize: '13px', color: estado === 'listo' ? '#166534' : estado === 'error' ? '#991B1B' : '#1E40AF'
        }}>
          {mensaje}
        </div>
      )}

      {detalle && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '11px', color: '#64748B', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {detalle}
        </div>
      )}

      <div style={{ marginTop: '20px', background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>Columnas que debe tener tu Excel:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {['Correo Electrónico *', 'Nombre Completo *', 'Cédula', 'Género (F/M)', 'Fecha de Ingreso', 'Gerencia *', 'Departamento *', 'Área', 'Jefatura', 'Puesto', 'Centro Gestor'].map(col => (
            <div key={col} style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: col.includes('*') ? '#0F9B72' : '#CBD5E1' }}>●</span>{col}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
