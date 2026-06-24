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

  // Busca valor probando múltiples nombres, incluyendo variantes con saltos de línea y asteriscos
  function buscar(fila, opciones) {
    // Primero busca exacto
    for (const op of opciones) {
      if (fila[op] !== undefined && fila[op] !== null && fila[op] !== '') {
        return fila[op].toString().trim()
      }
    }
    // Si no encuentra, busca en las claves del objeto ignorando saltos de línea, asteriscos y espacios extra
    const claves = Object.keys(fila)
    for (const op of opciones) {
      const opLimpio = op.toLowerCase().replace(/[\*\n\r]/g, '').replace(/\s+/g, ' ').trim()
      for (const clave of claves) {
        const claveLimpia = clave.toLowerCase().replace(/[\*\n\r]/g, '').replace(/\s+/g, ' ').trim()
        if (claveLimpia.includes(opLimpio) || opLimpio.includes(claveLimpia)) {
          if (fila[clave] !== undefined && fila[clave] !== null && fila[clave] !== '') {
            return fila[clave].toString().trim()
          }
        }
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
    const hojas = wb.SheetNames

    // Lee la primera hoja con header:1 para obtener las claves reales
    const ws = wb.Sheets[wb.SheetNames[0]]
    const filas = XLSX.utils.sheet_to_json(ws)

    if (filas.length === 0) {
      setEstado('error')
      setMensaje('❌ No se encontraron datos.')
      setDetalle(`Hojas: ${hojas.join(', ')}. Verificá que los datos estén debajo del encabezado.`)
      return
    }

    const columnas = Object.keys(filas[0])
    setDetalle(`Columnas detectadas: ${columnas.map(c => c.replace(/\n/g, ' ')).join(' | ')}`)
    setMensaje(`${filas.length} filas encontradas. Importando...`)
    setEstado('importando')

    let exitosos = 0
    let errores = 0
    const erroresDetalle = []

    for (const fila of filas) {
      const correo = buscar(fila, [
        'Correo Electrónico', 'Correo electronico', 'Correo Electrónico\n(ID ÚNICO)',
        'correo electrónico', 'Correo', 'correo', 'Email', 'email', 'ID ÚNICO'
      ])

      if (!correo || !correo.includes('@')) continue

      const colaborador = {
        correo: correo.toLowerCase(),
        nombre: buscar(fila, ['Nombre Completo', 'Nombre', 'nombre']),
        cedula: buscar(fila, ['Cédula', 'Cedula', 'cedula']),
        genero: buscar(fila, ['Género', 'Genero', 'genero', 'Sexo']),
        fecha_ingreso: buscar(fila, ['Fecha de Ingreso', 'Fecha Ingreso', 'fecha ingreso']) || null,
        gerencia: normalizar(buscar(fila, ['Gerencia', 'gerencia', 'GERENCIA'])),
        departamento: normalizar(buscar(fila, ['Departamento', 'departamento', 'Depto'])),
        area: normalizar(buscar(fila, ['Área', 'Area', 'area'])),
        jefatura: buscar(fila, ['Jefatura', 'jefatura']),
        puesto: buscar(fila, ['Puesto', 'puesto', 'Cargo', 'cargo']),
        centro_gestor: buscar(fila, ['Centro Gestor', 'centro gestor', 'CentroGestor']),
        estado: 'Activo'
      }

      const { error } = await supabase
        .from('colaboradores')
        .upsert(colaborador, { onConflict: 'correo' })

      if (!error) {
        exitosos++
      } else {
        errores++
        erroresDetalle.push(error.message)
      }
    }

    setEstado('listo')
    setMensaje(`✅ ${exitosos} colaboradores importados correctamente.`)
    if (errores > 0) {
      setDetalle(`⚠️ ${errores} errores. Primero: ${erroresDetalle[0]}`)
    } else {
      setDetalle(`Total procesadas: ${filas.length} filas · ${exitosos} importadas.`)
    }
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
    </div>
  )
}
