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

  // Convierte cualquier valor de correo en un identificador usable
  // Si está vacío o es inválido, genera un placeholder único por nombre+capacitación
  function resolverCorreo(valor, nombreColab, nombreCap) {
    const raw = (valor || '').toString().trim().toLowerCase()
    if (raw && raw.includes('@')) return raw
    // Sin correo válido: usar placeholder basado en nombre y capacitación
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

    const buffer = await archivo.arrayBuffer()
    const wb = XLSX.read(buffer, { cellDates: false, raw: true })

    const nombreHoja = wb.SheetNames.find(n =>
      n.toLowerCase().includes('reporte') || n.toLowerCase().includes('datos')
    ) || wb.SheetNames[0]

    addLog(`📋 Hoja detectada: "${nombreHoja}"`)

    const ws = wb.Sheets[nombreHoja]
    const filas = XLSX.utils.sheet_to_json(ws, { raw: true })

    if (filas.length === 0) {
      addLog('❌ No se encontraron datos', 'error')
      setEstado('error')
      return
    }

    addLog(`✅ ${filas.length} filas encontradas`)
    setTotal(filas.length)

    // ── PASO 1: Crear capacitaciones únicas ──────────────────────
    addLog('🎓 Paso 1: Procesando capacitaciones únicas...')

    const capMap = new Map()
    for (const fila of filas) {
      const nombre = (fila['Nombre Capacitación'] || '').toString().trim()
      if (!nombre || capMap.has(nombre)) continue

      capMap.set(nombre, {
        nombre,
        categoria: limpiarCategoria(fila['Des_Temas'] || ''),
        modalidad: 'Virtual',
        estado: limpiarEstado(fila['Estado']),
        facilitador: (fila['Facilitador'] || '').toString().trim(),
        proveedor: normalizar(fila['Empresa'] || ''),
        fecha_inicio: excelFecha(fila['Fecha Inicio']),
        fecha_fin: excelFecha(fila['Fecha fin']),
        horas: Number(fila['Horas capacitación']) || 0,
        costo: Number(fila['Costo']) || 0,
      })
    }

    addLog(`📝 ${capMap.size} capacitaciones únicas identificadas`)

    const capsArray = Array.from(capMap.values())
    let capsInsertadas = 0
    const lote = 50

    for (let i = 0; i < capsArray.length; i += lote) {
      const batch = capsArray.slice(i, i + lote)
      const { error } = await supabase
        .from('capacitaciones')
        .upsert(batch, { onConflict: 'nombre', ignoreDuplicates: true })
      if (!error) capsInsertadas += batch.length
    }

    addLog(`✅ ${capsInsertadas} capacitaciones importadas`)

    // ── PASO 2: Cargar IDs de capacitaciones ─────────────────────
    addLog('🔗 Paso 2: Obteniendo IDs de capacitaciones...')
    const { data: capsDB } = await supabase
      .from('capacitaciones')
      .select('id, nombre')

    const capIdMap = new Map()
    capsDB?.forEach(c => capIdMap.set(c.nombre.trim(), c.id))
    addLog(`✅ ${capIdMap.size} capacitaciones mapeadas`)

    // ── PASO 3: Cargar colaboradores (opcional, solo para vincular) ──
    addLog('👥 Paso 3: Obteniendo colaboradores...')
    const { data: colsDB } = await supabase
      .from('colaboradores')
      .select('id, correo')

    const colIdMap = new Map()
    colsDB?.forEach(c => colIdMap.set(c.correo.toLowerCase().trim(), c.id))
    addLog(`✅ ${colIdMap.size} colaboradores en el sistema`)

    // ── PASO 4: Crear participantes ──────────────────────────────
    addLog('👤 Paso 4: Procesando participantes...')

    const participantesLote = []
    let sinCorreo = 0
    let sinColab = 0
    let sinCap = 0
    const vistos = new Set()

    for (const fila of filas) {
      const nombreCap = (fila['Nombre Capacitación'] || '').toString().trim()
      const nombreColab = (fila['Colab '] || fila['Colaborador'] || '').toString().trim()
      const correoRaw = (fila['Correo'] || '').toString().trim().toLowerCase()

      const capId = capIdMap.get(nombreCap)
      if (!capId) { sinCap++; continue }

      // Resolver correo: si está vacío o no tiene @, generar placeholder
      const correo = resolverCorreo(correoRaw, nombreColab, nombreCap)
      if (!correoRaw || !correoRaw.includes('@')) sinCorreo++

      // Buscar colaborador_id si existe, pero NO bloquear si no existe
      const colId = colIdMap.get(correoRaw) || null
      if (correoRaw && correoRaw.includes('@') && !colId) sinColab++

      // Clave de deduplicación: correo + capacitación
      const clave = `${correo}||${capId}`
      if (vistos.has(clave)) continue
      vistos.add(clave)

      participantesLote.push({
        colaborador_id: colId,          // puede ser null si ya no está en la org
        capacitacion_id: capId,
        correo: correo,                 // siempre tiene valor
      })
    }

    addLog(`📊 ${participantesLote.length} participantes únicos a importar`)
    if (sinCorreo > 0) addLog(`⚠️ ${sinCorreo} filas sin correo válido (se importan igual como participantes)`, 'warn')
    if (sinColab > 0) addLog(`⚠️ ${sinColab} participantes ya no están en la organización (se importan igual)`, 'warn')
    if (sinCap > 0) addLog(`⚠️ ${sinCap} filas con capacitación no encontrada (se omiten)`, 'warn')

    // Insertar en lotes — ahora sin restricción de colaborador_id
    let partInsertados = 0
    const lotePart = 100

    for (let i = 0; i < participantesLote.length; i += lotePart) {
      const batch = participantesLote.slice(i, i + lotePart)
      const { error } = await supabase
        .from('participantes')
        .upsert(batch, { onConflict: 'colaborador_id,capacitacion_id', ignoreDuplicates: true })
      if (!error) partInsertados += batch.length
      setProgreso(Math.round(((i + batch.length) / participantesLote.length) * 100))
    }

    setProgreso(100)
    addLog(`✅ ${partInsertados} participantes importados correctamente`)
    addLog(`🎉 ¡Importación masiva completada!`, 'success')
    setEstado('listo')
  }

  const colorLog = { info: '#374151', warn: '#D97706', error: '#DC2626', success: '#0F9B72' }

  return (
    <div style={{ maxWidth: '700px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '6px' }}>
        Importación masiva de capacitaciones
      </h2>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
        Cargá tu Excel histórico. El sistema crea las capacitaciones y asigna los participantes automáticamente usando la hoja <strong>"Reporte"</strong>.
      </p>

      <div style={{ border: '2px dashed #CBD5E1', borderRadius: '12px', padding: '32px', textAlign: 'center', background: 'white', marginBottom: '20px' }}>
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>📊</div>
        <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '6px' }}>
          Seleccioná tu Excel de capacitaciones
        </div>
        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
          Debe tener la hoja <strong>"Reporte"</strong> con los datos históricos
        </div>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={procesarArchivo}
          disabled={estado === 'procesando'}
          style={{ display: 'none' }}
          id="fileCapInput"
        />
        <label
          htmlFor="fileCapInput"
          style={{
            background: estado === 'procesando' ? '#E2E8F0' : '#5B4EE8',
            color: estado === 'procesando' ? '#94A3B8' : 'white',
            padding: '10px 24px', borderRadius: '8px',
            cursor: estado === 'procesando' ? 'not-allowed' : 'pointer',
            fontSize: '13px', fontWeight: '500'
          }}>
          {estado === 'procesando' ? '⏳ Procesando...' : 'Elegir archivo Excel'}
        </label>
      </div>

      {estado === 'procesando' && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>
            <span>Importando participantes...</span>
            <span>{progreso}%</span>
          </div>
          <div style={{ background: '#E2E8F0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#5B4EE8', height: '100%', width: `${progreso}%`, borderRadius: '4px', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div style={{ background: '#0F172A', borderRadius: '10px', padding: '16px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '300px', overflowY: 'auto' }}>
          {log.map((l, i) => (
            <div key={i} style={{ color: colorLog[l.tipo] || '#94A3B8', marginBottom: '4px' }}>
              <span style={{ color: '#475569', marginRight: '8px' }}>{l.ts}</span>
              {l.msg}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '20px', background: 'white', borderRadius: '12px', padding: '18px', border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: '#374151' }}>
          Columnas requeridas en la hoja "Reporte":
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          {[
            'Nombre Capacitación *', 'Des_Temas', 'Fecha Inicio', 'Fecha fin',
            'Horas capacitación', 'Estado', 'Empresa', 'Facilitador',
            'Correo (opcional)', 'Costo', 'Año', 'Género'
          ].map(c => (
            <div key={c} style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: c.includes('*') ? '#0F9B72' : '#CBD5E1' }}>●</span>{c}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
