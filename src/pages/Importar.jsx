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

  // Convierte serial de Excel a YYYY-MM-DD
  function excelFechaAString(valor) {
    if (!valor) return null
    try {
      // Si ya es string con formato fecha
      const str = valor.toString().trim()
      if (str.includes('/')) {
        const p = str.split('/')
        if (p.length === 3) {
          const [d, m, y] = p
          return `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
        }
      }
      if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.slice(0, 10)

      // Si es número serial de Excel (ej: 45894)
      const num = Number(str)
      if (!isNaN(num) && num > 1000) {
        // Excel cuenta desde 1/1/1900, con bug del año bisiesto 1900
        const fecha = new Date((num - 25569) * 86400 * 1000)
        const y = fecha.getUTCFullYear()
        const m = String(fecha.getUTCMonth() + 1).padStart(2, '0')
        const d = String(fecha.getUTCDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
      return null
    } catch {
      return null
    }
  }

  function buscarValor(fila, opciones) {
    // Búsqueda exacta primero
    for (const op of opciones) {
      if (fila[op] !== undefined && fila[op] !== null && fila[op] !== '') {
        return fila[op]
      }
    }
    // Búsqueda flexible ignorando asteriscos, saltos de línea y espacios
    const claves = Object.keys(fila)
    for (const op of opciones) {
      const opL = op.toLowerCase().replace(/[\*\n\r\(\)]/g, '').replace(/\s+/g, ' ').trim()
      for (const clave of claves) {
        const claveL = clave.toLowerCase().replace(/[\*\n\r\(\)]/g, '').replace(/\s+/g, ' ').trim()
        if (claveL.includes(opL) || opL.includes(claveL)) {
          if (fila[clave] !== undefined && fila[clave] !== null && fila[clave] !== '') {
            return fila[clave]
          }
        }
      }
    }
    return ''
  }

  function buscarTexto(fila, opciones) {
    const v = buscarValor(fila, opciones)
    return v ? v.toString().trim() : ''
  }

  async function procesarArchivo(e) {
    const archivo = e.target.files[0]
    if (!archivo) return

    setEstado('leyendo')
    setMensaje('Leyendo archivo...')
    setDetalle('')

    const buffer = await archivo.arrayBuffer()
    const wb = XLSX.read(buffer, { cellDates: false, cellNF: false, cellText: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const filas = XLSX.utils.sheet_to_json(ws, { raw: true })

    if (filas.length === 0) {
      setEstado('error')
      setMensaje('❌ No se encontraron datos en la primera hoja.')
      return
    }

    setMensaje(`${filas.length} filas encontradas. Importando...`)
    setEstado('importando')

    let exitosos = 0
    let errores = 0
    const errMsgs = []

    for (const fila of filas) {
      const correo = buscarTexto(fila, [
        'Correo Electrónico', 'Correo electronico',
        'correo electrónico', 'Correo', 'correo', 'Email', 'email'
      ])
      if (!correo || !correo.includes('@')) continue

      const fechaRaw = buscarValor(fila, ['Fecha de Ingreso', 'Fecha Ingreso', 'fecha ingreso'])
      const fechaFinal = excelFechaAString(fechaRaw)

      const colaborador = {
        correo: correo.toLowerCase(),
        nombre: buscarTexto(fila, ['Nombre Completo', 'Nombre', 'nombre']),
        cedula: buscarTexto(fila, ['Cédula', 'Cedula', 'cedula']),
        genero: buscarTexto(fila, ['Género', 'Genero', 'genero', 'Sexo']),
        fecha_ingreso: fechaFinal,
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
        if (errMsgs.length < 2) errMsgs.push(error.message)
      }
    }

    setEstado(errores === 0 ? 'listo' : exitosos > 0 ? 'listo' : 'error')
    setMensaje(`✅ ${exitosos} colaboradores importados correctamente.`)
    if (errores > 0) {
      setDetalle(`⚠️ ${errores} errores. Ejemplo: ${errMsgs[0]}`)
    } else {
      setDetalle(`${filas.length} filas procesadas · ${exitosos} importadas.`)
    }
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px' }}>
        Importar datos
      </h2>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
        Cargá tu Excel de colaboradores. El sistema detecta automáticamente las columnas.
      </p>

      <div style={{ border: '2px dashed #CBD5E1', borderRadius: '12px', padding: '40px', textAlign: 'center', background: 'white', marginBottom: '16px' }}>
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
          style={{ background: '#5B4EE8', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
        >
          Elegir archivo
        </label>
      </div>

      {estado !== 'idle' && (
        <div style={{
          padding: '14px 16px', borderRadius: '8px', marginBottom: '12px',
          background: estado === 'listo' ? '#F0FDF4' : estado === 'error' ? '#FEF2F2' : '#EFF6FF',
          border: `1px solid ${estado === 'listo' ? '#BBF7D0' : estado === 'error' ? '#FECACA' : '#BFDBFE'}`,
          fontSize: '13px',
          color: estado === 'listo' ? '#166534' : estado === 'error' ? '#991B1B' : '#1E40AF'
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
