import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function ImportarCapacitaciones() {
  const [estado, setEstado] = useState('idle')
  const [log, setLog] = useState([])
  const [progreso, setProgreso] = useState(0)
  const [total, setTotal] = useState(0)

  function addLog(msg, tipo = 'info') {
    setLog(prev => [...prev, { msg, tipo, ts: new Date().toLocaleTimeString() }])
  }

  function normalizar(texto) {
    if (!texto) return ''
    return texto.toString().trim()
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  function limpiarEstado(e) {
    if (!e) return 'Completada'
    const s = e.toString().toLowerCase().trim()
    if (s.includes('finaliz')) return 'Completada'
    if (s.includes('curso') || s.includes('progreso')) return 'En curso'
    if (s.includes('pend')) return 'Programada'
    if (s.includes('cancel')) return 'Cancelada'
    return 'Completada'
  }

  function limpiarCategoria(des) {
    if (!des) return ''
    const d = des.toString().trim()
    if (d.includes('UC1') && d.includes('Inducción')) return 'UC1 · Inducción Corporativa'
    if (d.includes('UC1') && d.includes('Formación')) return 'UC1 · Formación al Puesto'
    if (d.includes('UC2') && d.includes('Normativ')) return 'UC2 · Código de Conducta'
    if (d.includes('UC2') && d.includes('Competencia')) return 'UC2 · Competencias Digitales'
    if (d.includes('UC3') && d.includes('Transform')) return 'UC3 · Transformación Empresarial'
    if (d.includes('UC3')) return 'UC3 · Capacitación Especializada'
    if (d.includes('UC4') && d.includes('Liderazgo')) return 'UC4 · Programa de Liderazgo'
    if (d.includes('UC4')) return 'UC4 · Puestos Clave'
    if (d.includes('UC5')) return 'UC5 · Salud y Bienestar'
    return d
  }

  function excelFecha(valor) {
    if (!valor) return null
    try {
      if (valor instanceof Date) return valor.toISOString().split('T')[0]
      const str = valor.toString().trim()
      if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.slice(0, 10)
      if (str.includes('/')) {
        const p = str.split('/')
        if (p.length === 3) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`
      }
      const num = Number(str)
      if (!isNaN(num) && num > 1000) {
        const d = new Date((num - 25569) * 86400 * 1000)
        return d.toISOString().split('T')[0]
      }
    } catch { return null }
    return null
  }

  function resolverCorreo(valor, nombreColab, nombreCap) {
    const raw = (valor || '').toString().trim().toLowerCase()
    if (raw && raw.includes('@')) return raw
    const base = `sin-correo__${(nombreColab || '').toLowerCase().replace(/\s+/g, '_')}__${(nombreCap || '').toLowerCase().replace(/\s+/g, '_')}`
    return base
  }

  async function procesarArchivo(e) {
    const archivo = e.target.files[0]
    if (!archivo) return

    setEstado('procesando')
    setLog([])
    setProgreso(0)

    addLog('📂 Leyendo archivo Excel...')
