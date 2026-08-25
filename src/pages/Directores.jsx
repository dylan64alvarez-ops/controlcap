import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import XLSXStyle from 'xlsx-js-style'
import PptxGenJS from 'pptxgenjs'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const ANIOS = ['2026', '2025', '2024', '2023', '2022', '2021']
const COLORS = { azul: '#0072DA', morado: '#8131B0', rojo: '#DA2B1F', amarillo: '#FFCF00', grafito: '#414042' }

const XL = {
  NAVY: { rgb: '1B2560' }, PURPLE: { rgb: '8131B0' }, BLUE: { rgb: '0072DA' },
  YELLOW: { rgb: 'FFCF00' }, RED: { rgb: 'DA2B1F' }, WHITE: { rgb: 'FFFFFF' },
  LIGHT: { rgb: 'F8FAFC' }, GRAY: { rgb: '64748B' }, GREEN: { rgb: '0F9B72' },
}

function celda(valor, estilo = {}) { return { v: valor ?? '', s: estilo } }
function headerCell(valor, bgColor = XL.NAVY) {
  return celda(valor, { font: { bold: true, color: XL.WHITE, sz: 11, name: 'Arial' }, fill: { fgColor: bgColor }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { top: { style: 'thin', color: XL.WHITE }, bottom: { style: 'thin', color: XL.WHITE }, left: { style: 'thin', color: XL.WHITE }, right: { style: 'thin', color: XL.WHITE } } })
}
function dataCell(valor, opciones = {}) {
  const { bold = false, color = { rgb: '1E293B' }, bg = XL.WHITE, align = 'left', sz = 10 } = opciones
  return celda(valor, { font: { bold, color, sz, name: 'Arial' }, fill: { fgColor: bg }, alignment: { horizontal: align, vertical: 'center' }, border: { top: { style: 'hair', color: { rgb: 'E2E8F0' } }, bottom: { style: 'hair', color: { rgb: 'E2E8F0' } }, left: { style: 'hair', color: { rgb: 'E2E8F0' } }, right: { style: 'hair', color: { rgb: 'E2E8F0' } } } })
}
function titleCell(valor) { return celda(valor, { font: { bold: true, sz: 16, color: XL.NAVY, name: 'Arial' }, fill: { fgColor: XL.WHITE }, alignment: { horizontal: 'left', vertical: 'center' } }) }
function subtitleCell(valor) { return celda(valor, { font: { sz: 10, color: XL.GRAY, name: 'Arial', italic: true }, fill: { fgColor: XL.WHITE }, alignment: { horizontal: 'left', vertical: 'center' } }) }
function kpiLabelCell(valor) { return celda(valor, { font: { bold: true, sz: 9, color: XL.GRAY, name: 'Arial' }, fill: { fgColor: XL.LIGHT }, alignment: { horizontal: 'center', vertical: 'center' }, border: { bottom: { style: 'thin', color: XL.PURPLE } } }) }
function kpiValueCell(valor, color = XL.PURPLE) { return celda(valor, { font: { bold: true, sz: 18, color, name: 'Arial' }, fill: { fgColor: XL.LIGHT }, alignment: { horizontal: 'center', vertical: 'center' } }) }
function accentCell(valor, color = XL.PURPLE) { return celda(valor, { font: { bold: true, sz: 10, color, name: 'Arial' }, fill: { fgColor: XL.WHITE }, alignment: { horizontal: 'right', vertical: 'center' }, border: { top: { style: 'hair', color: { rgb: 'E2E8F0' } }, bottom: { style: 'hair', color: { rgb: 'E2E8F0' } }, left: { style: 'hair', color: { rgb: 'E2E8F0' } }, right: { style: 'hair', color: { rgb: 'E2E8F0' } } } }) }

export default function Directores() {
  const [tab, setTab] = useState('dashboard')
  const [directores, setDirectores] = useState([])
  const [directorSeleccionado, setDirectorSeleccionado] = useState(null)
  const [filtroAnio, setFiltroAnio] = useState('2026')
  const [stats, setStats] = useState({ capacitaciones: 0, participaciones: 0, horas: 0, costo: 0 })
  const [participaciones, setParticipaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState('')

  // Gestión de directores
  const [nuevoCorreo, setNuevoCorreo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoPuesto, setNuevoPuesto] = useState('')
  const [nuevaGerencia, setNuevaGerencia] = useState('')
  const [guardandoDir, setGuardandoDir] = useState(false)
  const [exitoDir, setExitoDir] = useState('')
  const [correosTexto, setCorreosTexto] = useState('')
  const [modoImport, setModoImport] = useState(false)

  useEffect(() => { cargarDirectores() }, [])
  useEffect(() => { if (directores.length > 0) cargarDashboard() }, [directores, filtroAnio, directorSeleccionado])

  async function cargarDirectores() {
    const { data } = await supabase.from('directores').select('*').eq('activo', true).order('nombre')
    setDirectores(data || [])
  }

  async function cargarDashboard() {
    setCargando(true)

    // Correos a filtrar
    const correosDir = directorSeleccionado
      ? [directorSeleccionado.correo]
      : directores.map(d => d.correo)

    if (correosDir.length === 0) {
      setStats({ capacitaciones: 0, participaciones: 0, horas: 0, costo: 0 })
      setParticipaciones([])
      setCargando(false)
      return
    }

    // Cargar capacitaciones del año
    let qCap = supabase.from('capacitaciones').select('*')
    if (filtroAnio) qCap = qCap.gte('fecha_inicio', `${filtroAnio}-01-01`).lte('fecha_inicio', `${filtroAnio}-12-31`)
    const { data: caps } = await qCap
    const capsLookup = caps || []
    const capIds = capsLookup.map(c => c.id)

    if (capIds.length === 0) {
      setStats({ capacitaciones: 0, participaciones: 0, horas: 0, costo: 0 })
      setParticipaciones([])
      setCargando(false)
      return
    }

    // Cargar participantes de directores
    let partsRaw = []
    for (let i = 0; i < capIds.length; i += 400) {
      const lote = capIds.slice(i, i + 400)
      let desde = 0
      while (true) {
        let q = supabase.from('participantes').select('*')
          .in('capacitacion_id', lote)
          .in('correo', correosDir)
          .range(desde, desde + 999)
        const { data: pLote } = await q
        if (!pLote || pLote.length === 0) break
        partsRaw.push(...pLote)
        if (pLote.length < 1000) break
        desde += 1000
      }
    }

    // Enriquecer
    const capMap = {}
    capsLookup.forEach(c => { capMap[c.id] = c })

    const dirMap = {}
    directores.forEach(d => { dirMap[d.correo.toLowerCase()] = d })

    const enriquecidos = partsRaw.map(p => ({
      ...p,
      _cap: capMap[p.capacitacion_id] || null,
      _dir: dirMap[p.correo?.toLowerCase()] || null,
    }))

    const totalPartic = enriquecidos.length
    const totalHoras = enriquecidos.reduce((s, p) => s + Number(p.horas || 0), 0)
    const totalCosto = enriquecidos.reduce((s, p) => s + Number(p.costo || 0), 0)
    const capsUnicas = new Set(enriquecidos.map(p => p.capacitacion_id)).size

    setStats({ capacitaciones: capsUnicas, participaciones: totalPartic, horas: totalHoras, costo: totalCosto })
    setParticipaciones(enriquecidos)
    setCargando(false)
  }

  async function agregarDirector() {
    if (!nuevoCorreo.trim() || !nuevoCorreo.includes('@')) {
      alert('Ingresá un correo válido')
      return
    }
    setGuardandoDir(true)

    // Buscar info del colaborador si existe
    const { data: colData } = await supabase
      .from('colaboradores')
      .select('nombre, puesto, gerencia')
      .eq('correo', nuevoCorreo.toLowerCase().trim())
      .maybeSingle()

    const { error } = await supabase.from('directores').upsert({
      correo: nuevoCorreo.toLowerCase().trim(),
      nombre: nuevoNombre || colData?.nombre || '',
      puesto: nuevoPuesto || colData?.puesto || '',
      gerencia: nuevaGerencia || colData?.gerencia || '',
      activo: true,
    }, { onConflict: 'correo' })

    if (!error) {
      setExitoDir('✅ Director agregado correctamente')
      setNuevoCorreo('')
      setNuevoNombre('')
      setNuevoPuesto('')
      setNuevaGerencia('')
      await cargarDirectores()
      setTimeout(() => setExitoDir(''), 3000)
    } else {
      alert('Error: ' + error.message)
    }
    setGuardandoDir(false)
  }

  async function importarCorreosMasivos() {
    const lineas = correosTexto.split(/[\n,;]+/).map(l => l.trim().toLowerCase()).filter(l => l.includes('@'))
    if (lineas.length === 0) { alert('No se encontraron correos válidos'); return }

    setGuardandoDir(true)
    let insertados = 0, errores = 0

    for (const correo of lineas) {
      // Buscar info del colaborador
      const { data: colData } = await supabase
        .from('colaboradores')
        .select('nombre, puesto, gerencia')
        .eq('correo', correo)
        .maybeSingle()

      const { error } = await supabase.from('directores').upsert({
        correo,
        nombre: colData?.nombre || '',
        puesto: colData?.puesto || '',
        gerencia: colData?.gerencia || '',
        activo: true,
      }, { onConflict: 'correo' })

      if (!error) insertados++
      else errores++
    }

    setExitoDir(`✅ ${insertados} directores importados${errores > 0 ? `, ${errores} errores` : ''}`)
    setCorreosTexto('')
    setModoImport(false)
    await cargarDirectores()
    setTimeout(() => setExitoDir(''), 4000)
    setGuardandoDir(false)
  }

  async function eliminarDirector(id) {
    if (!confirm('¿Eliminar este director de la lista?')) return
    await supabase.from('directores').update({ activo: false }).eq('id', id)
    await cargarDirectores()
    if (directorSeleccionado?.id === id) setDirectorSeleccionado(null)
  }

  async function generarPDF() {
    setGenerando('pdf')
    const correosDir = directorSeleccionado ? [directorSeleccionado.correo] : directores.map(d => d.correo)
    const filtroDesc = directorSeleccionado
      ? `Director: ${directorSeleccionado.nombre || directorSeleccionado.correo}`
      : `Todos los Directores · ${filtroAnio || 'Todos los años'}`

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #1E293B; }
  .header { background: #1B2560; color: white; padding: 32px 40px; }
  .logo { font-size: 26px; font-weight: bold; margin-bottom: 4px; }
  .logo span { color: #FFCF00; }
  .subtitle { font-size: 12px; opacity: 0.7; margin-bottom: 16px; }
  .badge { background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 20px; font-size: 12px; display: inline-block; }
  .content { padding: 32px 40px; }
  .title { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
  .date { font-size: 11px; color: #64748B; margin-bottom: 24px; }
  .kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { padding: 16px; border-radius: 8px; border-left: 4px solid; }
  .kpi-label { font-size: 10px; color: #64748B; margin-bottom: 6px; text-transform: uppercase; }
  .kpi-val { font-size: 22px; font-weight: bold; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: bold; color: #1B2560; border-bottom: 2px solid #1B2560; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #1B2560; color: white; padding: 8px 10px; text-align: left; font-size: 10px; }
  td { padding: 7px 10px; border-bottom: 1px solid #E2E8F0; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .footer { margin-top: 32px; padding: 16px 40px; border-top: 1px solid #E2E8F0; font-size: 10px; color: #94A3B8; display: flex; justify-content: space-between; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="header">
  <div class="logo"><span>Control</span>Cap</div>
  <div class="subtitle">Universidad Corporativa · CoopeAnde N.º 1 · Reporte de Directores</div>
  <div class="badge">${filtroDesc}</div>
</div>
<div class="content">
  <div class="title">Informe de Capacitación — Directores</div>
  <div class="date">Generado el ${new Date().toLocaleDateString('es-CR', { year:'numeric', month:'long', day:'numeric' })}</div>
  <div class="kpis">
    <div class="kpi" style="border-color:#8131B0;background:#F5EEFF"><div class="kpi-label">Capacitaciones</div><div class="kpi-val" style="color:#8131B0">${stats.capacitaciones}</div></div>
    <div class="kpi" style="border-color:#0072DA;background:#EFF6FF"><div class="kpi-label">Participaciones</div><div class="kpi-val" style="color:#0072DA">${stats.participaciones.toLocaleString()}</div></div>
    <div class="kpi" style="border-color:#FFCF00;background:#FFFBEB"><div class="kpi-label">Horas impartidas</div><div class="kpi-val" style="color:#D97706">${stats.horas.toLocaleString()}h</div></div>
    <div class="kpi" style="border-color:#DA2B1F;background:#FEF2F2"><div class="kpi-label">Costo ejecutado</div><div class="kpi-val" style="color:#DA2B1F">₡${Math.round(stats.costo).toLocaleString()}</div></div>
  </div>
  <div class="section">
    <div class="section-title">Detalle por Director</div>
    <table>
      <thead><tr><th>Director</th><th>Correo</th><th>Puesto</th><th>Capacitación</th><th>Fecha</th><th>Horas</th><th>Costo</th></tr></thead>
      <tbody>
        ${participaciones.map(p => `
          <tr>
            <td>${p._dir?.nombre || p.nombre_colab || '—'}</td>
            <td>${p.correo?.startsWith('sin-correo') ? '—' : p.correo}</td>
            <td>${p._dir?.puesto || p.puesto_colab || '—'}</td>
            <td>${p._cap?.nombre || '—'}</td>
            <td>${p._cap?.fecha_inicio || '—'}</td>
            <td>${p.horas || 0}h</td>
            <td>₡${Math.round(p.costo || 0).toLocaleString()}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>
<div class="footer">
  <span>ControlCap · Universidad Corporativa · CoopeAnde N.º 1</span>
  <span>Uso interno exclusivo · ${new Date().toLocaleDateString('es-CR')}</span>
</div>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const w = window.open(url, '_blank')
    setTimeout(() => { w?.print(); URL.revokeObjectURL(url) }, 800)
    setGenerando('')
  }

  async function generarExcel() {
    setGenerando('excel')
    try {
      const wb = XLSXStyle.utils.book_new()
      const filtroDesc = directorSeleccionado
        ? `Director: ${directorSeleccionado.nombre || directorSeleccionado.correo}`
        : `Todos los Directores · ${filtroAnio || 'Todos los años'}`

      // Resumen por director
      const porDirector = {}
      participaciones.forEach(p => {
        const correo = p.correo
        const dir = p._dir
        if (!porDirector[correo]) porDirector[correo] = { nombre: dir?.nombre || p.nombre_colab || correo, puesto: dir?.puesto || '—', partic: 0, horas: 0, costo: 0 }
        porDirector[correo].partic++
        porDirector[correo].horas += Number(p.horas || 0)
        porDirector[correo].costo += Number(p.costo || 0)
      })

      const ws1Data = []
      ws1Data.push([titleCell('ControlCap — Informe de Directores'), celda(''), celda(''), celda(''), celda('')])
      ws1Data.push([subtitleCell(`Universidad Corporativa · CoopeAnde N.º 1 · ${filtroDesc}`), celda(''), celda(''), celda(''), celda('')])
      ws1Data.push([subtitleCell(`Generado el ${new Date().toLocaleDateString('es-CR')}`), celda(''), celda(''), celda(''), celda('')])
      ws1Data.push(Array(5).fill(celda('')))
      ws1Data.push([kpiLabelCell('CAPACITACIONES'), kpiLabelCell('PARTICIPACIONES'), kpiLabelCell('HORAS'), kpiLabelCell('COSTO EJECUTADO'), celda('')])
      ws1Data.push([kpiValueCell(stats.capacitaciones, XL.PURPLE), kpiValueCell(stats.participaciones.toLocaleString(), XL.BLUE), kpiValueCell(`${stats.horas.toLocaleString()}h`, { rgb: 'D97706' }), kpiValueCell(`₡${Math.round(stats.costo).toLocaleString()}`, XL.RED), celda('')])
      ws1Data.push(Array(5).fill(celda('')))
      ws1Data.push([headerCell('DIRECTOR'), headerCell('PUESTO'), headerCell('PARTICIPACIONES'), headerCell('HORAS'), headerCell('COSTO (₡)')])

      Object.values(porDirector).sort((a,b) => b.partic - a.partic).forEach((d, i) => {
        const bg = i % 2 === 0 ? XL.WHITE : { rgb: 'F5EEFF' }
        ws1Data.push([
          dataCell(d.nombre, { bold: true, bg }),
          dataCell(d.puesto, { bg }),
          dataCell(d.partic.toLocaleString(), { align: 'center', bg }),
          dataCell(`${d.horas}h`, { align: 'center', bg }),
          accentCell(`₡${Math.round(d.costo).toLocaleString()}`, XL.RED),
        ])
      })

      const ws1 = XLSXStyle.utils.aoa_to_sheet(ws1Data)
      ws1['!cols'] = [{ wch: 35 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 18 }]
      ws1['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:4} }, { s:{r:1,c:0}, e:{r:1,c:4} }, { s:{r:2,c:0}, e:{r:2,c:4} }]
      XLSXStyle.utils.book_append_sheet(wb, ws1, '📊 Resumen Directores')

      // Detalle participaciones
      const ws2Data = []
      ws2Data.push([titleCell('Detalle de Participaciones — Directores'), ...Array(6).fill(celda(''))])
      ws2Data.push([subtitleCell(filtroDesc), ...Array(6).fill(celda(''))])
      ws2Data.push(Array(7).fill(celda('')))
      ws2Data.push([
        headerCell('DIRECTOR'), headerCell('CORREO'), headerCell('PUESTO'),
        headerCell('CAPACITACIÓN'), headerCell('FECHA', XL.BLUE),
        headerCell('HORAS', XL.BLUE), headerCell('COSTO (₡)', XL.RED),
      ])

      participaciones.forEach((p, i) => {
        const bg = i % 2 === 0 ? XL.WHITE : XL.LIGHT
        ws2Data.push([
          dataCell(p._dir?.nombre || p.nombre_colab || '—', { bold: true, bg }),
          dataCell(p.correo?.startsWith('sin-correo') ? '—' : p.correo, { color: XL.BLUE, bg }),
          dataCell(p._dir?.puesto || p.puesto_colab || '—', { bg }),
          dataCell(p._cap?.nombre || '—', { bg }),
          dataCell(p._cap?.fecha_inicio || '—', { align: 'center', bg }),
          dataCell(`${p.horas || 0}h`, { align:
