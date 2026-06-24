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

  // Convierte fecha de Excel (número o string) a formato YYYY-MM-DD
  function convertirFecha(valor) {
    if (!valor) return null
    try {
      // Si es número (serial de Excel)
      if (typeof valor === 'number') {
        const fecha = XLSX.SSF.parse_date_code(valor)
        if (fecha) {
          const m = String(fecha.m).padStart(2, '0')
          const d = String(fecha.d).padStart(2, '0')
          return `${fecha.y}-${m}-${d}`
        }
      }
      // Si ya es un objeto Date
      if (valor instanceof Date) {
        return valor.toISOString().split('T')[0]
      }
      // Si es string tipo DD/MM/YYYY
      const str = valor.toString().trim()
      if (str.includes('/')) {
        const partes = str.split('/')
        if (partes.length === 3) {
          const [d, m, y] = partes
          return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
        }
      }
      // Si es string tipo YYYY-MM-DD
      if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.slice(0, 10)
      return null
    } catch {
      return null
    }
  }

  function buscar(fila, opciones) {
    for (const op of opciones) {
      if (fila[op] !== undefined && fila[op] !== null && fila[op] !== '') {
        return fila[op]
      }
    }
    const claves = Object.keys(fila)
    for (const op of opciones) {
      const opLimpio = op.toLowerCase().replace(/[\*\n\r]/g, '').replace(/\s+/g, ' ').trim()
      for (const clave of claves) {
        const claveLimpia = clave.toLowerCase().replace(/[\*\n\r]/g, '').replace(/\s+/g, ' ').trim()
        if (claveLimpia.includes(opLimpio) || opLimpio.includes(claveLimpia)) {
          if (fila[clave] !== undefined && fila[clave] !== null && fila[clave] !== '') {
            return fila[clave]
          }
        }
      }
    }
    return ''
  }

  function buscarTexto(fila, opciones) {
    const val = buscar(fila, opciones)
    return val ? val.toString().trim() : ''
  }

  async function procesarArchivo(e) {
    const archivo = e.target.files[0]
    if (!archivo) return

    setEstado('leyendo')
    setMensaje('Leyendo archivo Excel...')
    setDetalle('')

    const buffer = await archivo.arrayBuffer()
    // cellDates: false para que las fechas lleguen como números seriales
    const wb = XLSX.read(buffer, { cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const filas = XLSX.utils.sheet_to_json(ws)

    if (filas.length === 0) {
      setEstado('error')
      setMensaje('❌ No se encontraron datos.')
      return
    }

    const columnas = Object.keys(filas[0])
    setDetalle(`${filas.length} filas · Columnas: ${columnas.map(c => c.replace(/\n/g,' ')).join(' | ')}`)
    setMensaje(`${filas.length} filas encontradas. Importando...`)
    setEstado('importando')

    let exitosos = 0
    let errores = 0
    const erroresDetalle = []

    for (const fila of filas) {
      const correo = buscarTexto(fila, [
        'Correo Electrónico', 'Correo electronico', 'Correo Electrónico\n(ID ÚNICO)',
        'correo electrónico', 'Correo', 'correo', 'Email', 'email'
      ])

      if (!correo || !correo.includes('@')) continue

      const fechaRaw = buscar(fila, ['Fecha de Ingreso', 'Fecha Ingreso', 'fecha ingreso'])
      const fechaConvertida = convertirFecha(fechaRaw)

      const colaborador = {
        correo: correo.toLowerCase(),
        nombre: buscarTexto(fila, ['Nombre Completo', 'Nombre', 'nombre']),
        cedula: buscarTexto(fila, ['Cédula', 'Cedula', 'cedula']),
        genero: buscarTexto(fila, ['Género', 'Genero', 'genero', 'Sexo']),
        fecha_ingreso: fechaConvertida,
        gerencia: normalizar(buscarTexto(fila, ['Gerencia', 'gerencia'])),
        departamento: normalizar(buscarTexto(fila, ['Departamento', 'departamento', 'Depto'])),
        area: normalizar(buscarTexto(fila, ['Área', 'Area', 'area'])),
        jefatura: buscarTexto(fila, ['Jefatura', 'jefatura']),
        puesto: buscarTexto(fila, ['Puesto', 'puesto', 'Cargo']),
        centro_gestor: buscarTexto(fila, ['Centro Gestor', 'centro gestor']),
        estado: 'Activo'
      }

      const { error } = await supabase
        .from('colaboradores')
        .upsert(colaborador, { onConflict: 'correo' })

      if (!error) {
        exitosos++
      } else {
        errores++
        if (erroresDetalle.length < 3) erroresDetalle.push(error.message)
      }
    }

    setEstado('listo')
    setMensaje(`✅ ${exitosos} colaboradores importados correctamente.`)
    if (errores > 0) {
      setDetalle(`⚠️ ${errores} errores. Ejemplo: ${erroresDetalle[0]}`)
    } else {
      setDetalle(`Total: ${filas.length} filas procesadas · ${exitosos} importadas exitosamente.`)
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
