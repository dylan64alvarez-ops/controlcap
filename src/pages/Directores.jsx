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
          dataCell(`${p.horas || 0}h`, { align: 'center', color: XL.GREEN, bold: true, bg }),
          accentCell(`₡${Math.round(p.costo || 0).toLocaleString()}`, XL.RED),
        ])
      })

      const ws2 = XLSXStyle.utils.aoa_to_sheet(ws2Data)
      ws2['!cols'] = [{ wch: 30 }, { wch: 28 }, { wch: 28 }, { wch: 38 }, { wch: 12 }, { wch: 8 }, { wch: 16 }]
      ws2['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:6} }, { s:{r:1,c:0}, e:{r:1,c:6} }]
      XLSXStyle.utils.book_append_sheet(wb, ws2, '👤 Participaciones')

      XLSXStyle.writeFile(wb, `ControlCap_Directores_${filtroAnio||'Todos'}_${new Date().toISOString().slice(0,10)}.xlsx`)
    } catch(e) { alert('Error: ' + e.message) }
    setGenerando('')
  }

  async function generarPPTX() {
    setGenerando('pptx')
    try {
      const pptx = new PptxGenJS()
      pptx.layout = 'LAYOUT_WIDE'
      const NAVY='1B2560', YELLOW='FFCF00', WHITE='FFFFFF', PURPLE='8131B0', BLUE='0072DA', RED='DA2B1F', LIGHT='F8FAFC', GRAY='64748B'

      const filtroDesc = directorSeleccionado
        ? `Director: ${directorSeleccionado.nombre || directorSeleccionado.correo}`
        : `Todos los Directores · ${filtroAnio || 'Todos los años'}`

      // Slide 1: Portada
      const s1 = pptx.addSlide()
      s1.background = { color: NAVY }
      s1.addShape(pptx.ShapeType.rect, { x:0, y:4.5, w:13.33, h:3.0, fill:{color:PURPLE}, line:{color:PURPLE} })
      s1.addText('Control', { x:0.6, y:0.5, w:2.5, h:0.8, fontSize:40, bold:true, color:YELLOW, fontFace:'Arial' })
      s1.addText('Cap', { x:2.6, y:0.5, w:2, h:0.8, fontSize:40, bold:true, color:WHITE, fontFace:'Arial' })
      s1.addText('Universidad Corporativa · CoopeAnde N.º 1', { x:0.6, y:1.4, w:9, h:0.4, fontSize:13, color:'AABCDE', fontFace:'Arial' })
      s1.addText('Informe de Capacitación — Directores', { x:0.6, y:2.1, w:11, h:0.9, fontSize:30, bold:true, color:WHITE, fontFace:'Arial' })
      s1.addText(filtroDesc, { x:0.6, y:3.1, w:12, h:0.5, fontSize:14, color:YELLOW, fontFace:'Arial' })
      s1.addText(new Date().toLocaleDateString('es-CR',{year:'numeric',month:'long',day:'numeric'}), { x:0.6, y:4.7, w:8, h:0.4, fontSize:13, color:WHITE, fontFace:'Arial' })
      s1.addText('Uso interno exclusivo', { x:0.6, y:5.2, w:8, h:0.35, fontSize:11, color:'AAAACC', fontFace:'Arial' })

      // Slide 2: KPIs
      const s2 = pptx.addSlide()
      s2.background = { color: LIGHT }
      s2.addText('Resumen Ejecutivo — Directores', { x:0.5, y:0.3, w:12, h:0.6, fontSize:22, bold:true, color:NAVY, fontFace:'Arial' })
      s2.addText(filtroDesc, { x:0.5, y:0.9, w:12, h:0.35, fontSize:12, color:GRAY, fontFace:'Arial' })
      const kpis = [
        { label:'Capacitaciones', val:stats.capacitaciones.toString(), color:PURPLE },
        { label:'Participaciones', val:stats.participaciones.toLocaleString(), color:BLUE },
        { label:'Horas impartidas', val:stats.horas.toLocaleString()+'h', color:'D97706' },
        { label:'Costo ejecutado', val:'₡'+Math.round(stats.costo).toLocaleString(), color:RED },
      ]
      kpis.forEach((k,i) => {
        const x = 0.4 + i * 3.15
        s2.addShape(pptx.ShapeType.rect, { x, y:1.5, w:2.9, h:1.8, fill:{color:WHITE}, line:{color:'E2E8F0',pt:1} })
        s2.addShape(pptx.ShapeType.rect, { x, y:1.5, w:0.08, h:1.8, fill:{color:k.color}, line:{color:k.color} })
        s2.addText(k.label.toUpperCase(), { x:x+0.2, y:1.65, w:2.6, h:0.3, fontSize:9, color:GRAY, fontFace:'Arial', bold:true })
        s2.addText(k.val, { x:x+0.2, y:2.05, w:2.6, h:0.8, fontSize:24, bold:true, color:k.color, fontFace:'Arial' })
      })

      // Slide 3: Tabla de participaciones por director
      const porDir = {}
      participaciones.forEach(p => {
        const k = p.correo
        if (!porDir[k]) porDir[k] = { nombre: p._dir?.nombre || p.nombre_colab || k, puesto: p._dir?.puesto || '—', partic: 0, horas: 0, costo: 0 }
        porDir[k].partic++
        porDir[k].horas += Number(p.horas || 0)
        porDir[k].costo += Number(p.costo || 0)
      })
      const dirArr = Object.values(porDir).sort((a,b) => b.partic - a.partic).slice(0, 10)

      if (dirArr.length > 0) {
        const s3 = pptx.addSlide()
        s3.background = { color: WHITE }
        s3.addText('Participaciones por Director', { x:0.5, y:0.3, w:12, h:0.55, fontSize:22, bold:true, color:NAVY, fontFace:'Arial' })
        const rows = [
          [
            { text:'Director', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10} },
            { text:'Puesto', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10} },
            { text:'Participaciones', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'center'} },
            { text:'Horas', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'center'} },
            { text:'Costo', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'right'} },
          ],
          ...dirArr.map((d,i) => [
            { text:d.nombre.length>35?d.nombre.slice(0,33)+'...':d.nombre, options:{fontSize:10,fill:i%2===0?WHITE:LIGHT,bold:true} },
            { text:d.puesto.length>28?d.puesto.slice(0,26)+'...':d.puesto, options:{fontSize:9,fill:i%2===0?WHITE:LIGHT} },
            { text:d.partic.toString(), options:{fontSize:10,align:'center',fill:i%2===0?WHITE:LIGHT} },
            { text:d.horas+'h', options:{fontSize:10,align:'center',fill:i%2===0?WHITE:LIGHT} },
            { text:'₡'+Math.round(d.costo).toLocaleString(), options:{fontSize:10,align:'right',fill:i%2===0?WHITE:LIGHT} },
          ])
        ]
        s3.addTable(rows, { x:0.5, y:1.0, w:12.3, colW:[4.0,3.5,2.0,1.3,1.5], border:{type:'solid',pt:0.5,color:'E2E8F0'} })
      }

      // Slide 4: Top Capacitaciones
      const capCount = {}
      participaciones.forEach(p => {
        if (!capCount[p.capacitacion_id]) capCount[p.capacitacion_id] = { nombre:p._cap?.nombre||'—', fecha:p._cap?.fecha_inicio||'—', partic:0, horas:0, costo:0 }
        capCount[p.capacitacion_id].partic++
        capCount[p.capacitacion_id].horas += Number(p.horas||0)
        capCount[p.capacitacion_id].costo += Number(p.costo||0)
      })
      const topCaps = Object.values(capCount).sort((a,b)=>b.partic-a.partic).slice(0,8)

      if (topCaps.length > 0) {
        const s4 = pptx.addSlide()
        s4.background = { color: LIGHT }
        s4.addText('Top Capacitaciones — Directores', { x:0.5, y:0.3, w:12, h:0.55, fontSize:22, bold:true, color:NAVY, fontFace:'Arial' })
        const rows2 = [
          [
            { text:'Capacitación', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10} },
            { text:'Fecha', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'center'} },
            { text:'Directores', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'center'} },
            { text:'Horas', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'center'} },
            { text:'Costo total', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'right'} },
          ],
          ...topCaps.map((c,i)=>[
            { text:c.nombre.length>45?c.nombre.slice(0,43)+'...':c.nombre, options:{fontSize:10,fill:i%2===0?WHITE:LIGHT} },
            { text:c.fecha||'—', options:{fontSize:9,align:'center',fill:i%2===0?WHITE:LIGHT} },
            { text:c.partic.toString(), options:{fontSize:10,align:'center',fill:i%2===0?WHITE:LIGHT} },
            { text:c.horas+'h', options:{fontSize:10,align:'center',fill:i%2===0?WHITE:LIGHT} },
            { text:'₡'+Math.round(c.costo).toLocaleString(), options:{fontSize:10,align:'right',fill:i%2===0?WHITE:LIGHT} },
          ])
        ]
        s4.addTable(rows2, { x:0.5, y:1.0, w:12.3, colW:[5.8,1.8,1.5,1.2,2.0], border:{type:'solid',pt:0.5,color:'E2E8F0'} })
      }

      // Slide 5: Cierre
      const s5 = pptx.addSlide()
      s5.background = { color: NAVY }
      s5.addShape(pptx.ShapeType.rect, { x:0, y:3.2, w:13.33, h:0.08, fill:{color:YELLOW}, line:{color:YELLOW} })
      s5.addText('Control', { x:4.2, y:0.8, w:2.4, h:0.9, fontSize:42, bold:true, color:YELLOW, fontFace:'Arial' })
      s5.addText('Cap', { x:6.2, y:0.8, w:2, h:0.9, fontSize:42, bold:true, color:WHITE, fontFace:'Arial' })
      s5.addText('Universidad Corporativa', { x:2, y:1.85, w:9.33, h:0.5, fontSize:18, color:'AABCDE', fontFace:'Arial', align:'center' })
      s5.addText('CoopeAnde N.º 1', { x:2, y:2.4, w:9.33, h:0.4, fontSize:14, color:'AABCDE', fontFace:'Arial', align:'center' })
      s5.addText('Informe generado el '+new Date().toLocaleDateString('es-CR'), { x:2, y:3.6, w:9.33, h:0.4, fontSize:12, color:WHITE, fontFace:'Arial', align:'center' })
      s5.addText('Uso interno exclusivo', { x:2, y:4.1, w:9.33, h:0.35, fontSize:11, color:'8899BB', fontFace:'Arial', align:'center' })

      await pptx.writeFile({ fileName: `ControlCap_Directores_${filtroAnio||'Todos'}_${new Date().toISOString().slice(0,10)}.pptx` })
    } catch(e) { alert('Error: ' + e.message) }
    setGenerando('')
  }

  const inp = { height:'36px', border:'1px solid #E2E8F0', borderRadius:'8px', padding:'0 10px', fontSize:'13px', outline:'none', background:'white' }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
        {[
          { id:'dashboard', label:'📊 Dashboard' },
          { id:'gestionar', label:'⚙️ Gestionar Directores' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'8px 18px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500', background: tab === t.id ? '#1B2560' : '#F1F5F9', color: tab === t.id ? 'white' : '#64748B' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div>
          {/* Filtros */}
          <div style={{ background:'white', borderRadius:'12px', padding:'16px 20px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap' }}>
            <div>
              <label style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'600', textTransform:'uppercase', display:'block', marginBottom:'4px' }}>Año</label>
              <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} style={{ ...inp, width:'120px' }}>
                <option value="">Todos los años</option>
                {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'600', textTransform:'uppercase', display:'block', marginBottom:'4px' }}>Director</label>
              <select value={directorSeleccionado?.id || ''} onChange={e => {
                const dir = directores.find(d => d.id === e.target.value)
                setDirectorSeleccionado(dir || null)
              }} style={{ ...inp, width:'280px' }}>
                <option value="">Todos los directores</option>
                {directores.map(d => <option key={d.id} value={d.id}>{d.nombre || d.correo}</option>)}
              </select>
            </div>
            {directores.length === 0 && (
              <div style={{ fontSize:'12px', color:'#DA2B1F', padding:'8px 14px', background:'#FEF2F2', borderRadius:'8px' }}>
                ⚠️ No hay directores registrados. Agregá correos en la pestaña "Gestionar Directores".
              </div>
            )}
          </div>

          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
            {[
              { label:'Capacitaciones', val:stats.capacitaciones, color:COLORS.morado, icon:'🎓' },
              { label:'Participaciones', val:stats.participaciones.toLocaleString(), color:COLORS.azul, icon:'👤' },
              { label:'Horas impartidas', val:stats.horas.toLocaleString()+'h', color:'#D97706', icon:'⏱️' },
              { label:'Costo ejecutado', val:'₡'+Math.round(stats.costo).toLocaleString(), color:COLORS.rojo, icon:'💰' },
            ].map(k => (
              <div key={k.label} style={{ background:'white', borderRadius:'12px', padding:'18px', borderLeft:`4px solid ${k.color}`, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize:'11px', color:'#64748B', marginBottom:'6px' }}>{k.icon} {k.label}</div>
                <div style={{ fontSize:'24px', fontWeight:'700', color:k.color }}>{cargando ? '...' : k.val}</div>
              </div>
            ))}
          </div>

          {/* Tabla de participaciones */}
          <div style={{ background:'white', borderRadius:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', overflow:'hidden', marginBottom:'20px' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#1E293B' }}>
                👤 Participaciones de Directores
                {directorSeleccionado && <span style={{ marginLeft:'8px', fontSize:'12px', color:'#8131B0', fontWeight:'400' }}>· {directorSeleccionado.nombre || directorSeleccionado.correo}</span>}
              </div>
              <div style={{ fontSize:'12px', color:'#64748B' }}>{participaciones.length} registros</div>
            </div>
            {cargando ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#94A3B8' }}>Cargando...</div>
            ) : participaciones.length === 0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#94A3B8' }}>
                <div style={{ fontSize:'32px', marginBottom:'10px' }}>👤</div>
                <div style={{ fontWeight:'500' }}>No hay participaciones registradas</div>
                <div style={{ fontSize:'13px', marginTop:'4px' }}>Ajustá los filtros o verificá que los directores estén registrados</div>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#F8FAFC' }}>
                      {['Director', 'Correo', 'Puesto', 'Capacitación', 'Fecha', 'Horas', 'Costo'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', fontSize:'11px', fontWeight:'600', color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid #E2E8F0', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {participaciones.map((p, i) => (
                      <tr key={p.id} style={{ background: i%2===0 ? 'white' : '#FAFAFA' }}>
                        <td style={{ padding:'10px 12px', fontWeight:'500', fontSize:'13px', whiteSpace:'nowrap' }}>{p._dir?.nombre || p.nombre_colab || '—'}</td>
                        <td style={{ padding:'10px 12px', fontSize:'12px', color:'#0072DA' }}>{p.correo?.startsWith('sin-correo') ? '—' : p.correo}</td>
                        <td style={{ padding:'10px 12px', fontSize:'12px', color:'#64748B', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p._dir?.puesto || p.puesto_colab || '—'}</td>
                        <td style={{ padding:'10px 12px', fontSize:'12px', color:'#374151', maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p._cap?.nombre || '—'}</td>
                        <td style={{ padding:'10px 12px', fontSize:'12px', color:'#64748B', whiteSpace:'nowrap' }}>{p._cap?.fecha_inicio || '—'}</td>
                        <td style={{ padding:'10px 12px', fontSize:'13px', fontWeight:'600', color:'#0F9B72' }}>{p.horas || 0}h</td>
                        <td style={{ padding:'10px 12px', fontSize:'12px', color:'#DA2B1F', fontWeight:'600' }}>₡{Math.round(p.costo||0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Botones de reporte */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px' }}>
            {[
              { id:'pdf', icon:'📄', titulo:'PDF Ejecutivo', desc:'Informe con KPIs y detalle de participaciones de directores.', color:COLORS.rojo, accion:generarPDF, boton:'Generar PDF' },
              { id:'excel', icon:'📊', titulo:'Excel Estilizado', desc:'Resumen por director y detalle de participaciones con diseño CoopeAnde.', color:'#0F9B72', accion:generarExcel, boton:'Descargar Excel' },
              { id:'pptx', icon:'📽️', titulo:'PowerPoint', desc:'Presentación ejecutiva con KPIs, tabla por director y top capacitaciones.', color:COLORS.morado, accion:generarPPTX, boton:'Descargar PPTX' },
            ].map(r => (
              <div key={r.id} style={{ background:'white', borderRadius:'16px', padding:'24px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', border:`1px solid ${r.color}22` }}>
                <div style={{ fontSize:'32px', marginBottom:'10px' }}>{r.icon}</div>
                <div style={{ fontSize:'16px', fontWeight:'600', color:'#1E293B', marginBottom:'6px' }}>{r.titulo}</div>
                <div style={{ fontSize:'12px', color:'#64748B', marginBottom:'18px', lineHeight:'1.6' }}>{r.desc}</div>
                <button onClick={r.accion} disabled={!!generando || participaciones.length === 0}
                  style={{ background:generando===r.id||participaciones.length===0?'#E2E8F0':r.color, color:generando===r.id||participaciones.length===0?'#94A3B8':'white', border:'none', padding:'9px 20px', borderRadius:'8px', cursor:generando||participaciones.length===0?'not-allowed':'pointer', fontSize:'13px', fontWeight:'500', width:'100%' }}>
                  {generando===r.id?'⏳ Generando...':r.boton}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB GESTIONAR ── */}
      {tab === 'gestionar' && (
        <div>
          {exitoDir && (
            <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:'8px', padding:'12px 16px', marginBottom:'16px', fontSize:'13px', color:'#166534' }}>
              {exitoDir}
            </div>
          )}

          {/* Agregar director */}
          <div style={{ background:'white', borderRadius:'12px', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#1E293B', marginBottom:'16px' }}>➕ Agregar Director</div>

            {/* Tabs individual / masivo */}
            <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
              <button onClick={() => setModoImport(false)}
                style={{ padding:'7px 16px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'500', background:!modoImport?'#1B2560':'#F1F5F9', color:!modoImport?'white':'#64748B' }}>
                👤 Individual
              </button>
              <button onClick={() => setModoImport(true)}
                style={{ padding:'7px 16px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'500', background:modoImport?'#1B2560':'#F1F5F9', color:modoImport?'white':'#64748B' }}>
                📋 Pegar lista de correos
              </button>
            </div>

            {!modoImport ? (
              <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end' }}>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'#64748B', display:'block', marginBottom:'4px' }}>Correo *</label>
                  <input type="text" placeholder="director@coopeande1.com" value={nuevoCorreo}
                    onChange={e => setNuevoCorreo(e.target.value)}
                    style={{ ...inp, width:'240px' }} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'#64748B', display:'block', marginBottom:'4px' }}>Nombre (opcional)</label>
                  <input type="text" placeholder="Se obtiene automáticamente" value={nuevoNombre}
                    onChange={e => setNuevoNombre(e.target.value)}
                    style={{ ...inp, width:'220px' }} />
                </div>
                <div>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'#64748B', display:'block', marginBottom:'4px' }}>Puesto (opcional)</label>
                  <input type="text" placeholder="Se obtiene automáticamente" value={nuevoPuesto}
                    onChange={e => setNuevoPuesto(e.target.value)}
                    style={{ ...inp, width:'220px' }} />
                </div>
                <button onClick={agregarDirector} disabled={guardandoDir}
                  style={{ background:guardandoDir?'#E2E8F0':'#1B2560', color:guardandoDir?'#94A3B8':'white', border:'none', padding:'0 20px', height:'36px', borderRadius:'8px', cursor:guardandoDir?'not-allowed':'pointer', fontSize:'13px', fontWeight:'500' }}>
                  {guardandoDir ? '⏳ Guardando...' : '+ Agregar'}
                </button>
              </div>
            ) : (
              <div>
                <label style={{ fontSize:'11px', fontWeight:'600', color:'#64748B', display:'block', marginBottom:'6px' }}>
                  Pegá los correos de directores (uno por línea o separados por coma)
                </label>
                <textarea value={correosTexto} onChange={e => setCorreosTexto(e.target.value)}
                  placeholder={'director1@coopeande1.com\ndirector2@coopeande1.com\ndirector3@coopeande1.com'}
                  style={{ width:'100%', height:'120px', border:'1px solid #E2E8F0', borderRadius:'8px', padding:'10px', fontSize:'13px', outline:'none', resize:'vertical', fontFamily:'monospace' }} />
                <div style={{ marginTop:'10px', display:'flex', gap:'8px' }}>
                  <button onClick={importarCorreosMasivos} disabled={guardandoDir || !correosTexto.trim()}
                    style={{ background:guardandoDir||!correosTexto.trim()?'#E2E8F0':'#1B2560', color:guardandoDir||!correosTexto.trim()?'#94A3B8':'white', border:'none', padding:'8px 20px', borderRadius:'8px', cursor:guardandoDir||!correosTexto.trim()?'not-allowed':'pointer', fontSize:'13px', fontWeight:'500' }}>
                    {guardandoDir ? '⏳ Importando...' : '📋 Importar correos'}
                  </button>
                  <button onClick={() => { setModoImport(false); setCorreosTexto('') }}
                    style={{ background:'#F1F5F9', color:'#64748B', border:'none', padding:'8px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
                    Cancelar
                  </button>
                </div>
                <div style={{ marginTop:'8px', fontSize:'11px', color:'#94A3B8' }}>
                  💡 El sistema buscará automáticamente el nombre y puesto de cada correo en la base de colaboradores.
                </div>
              </div>
            )}
          </div>

          {/* Lista de directores */}
          <div style={{ background:'white', borderRadius:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#1E293B' }}>👥 Directores registrados</div>
              <div style={{ fontSize:'12px', color:'#64748B' }}>{directores.length} directores</div>
            </div>
            {directores.length === 0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#94A3B8' }}>
                <div style={{ fontSize:'32px', marginBottom:'10px' }}>👤</div>
                <div style={{ fontWeight:'500', marginBottom:'6px' }}>No hay directores registrados</div>
                <div style={{ fontSize:'13px' }}>Agregá correos usando el formulario de arriba</div>
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#F8FAFC' }}>
                    {['Nombre', 'Correo', 'Puesto', 'Gerencia', ''].map(h => (
                      <th key={h} style={{ padding:'10px 12px', fontSize:'11px', fontWeight:'600', color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid #E2E8F0', textAlign:'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {directores.map((d, i) => (
                    <tr key={d.id} style={{ background: i%2===0 ? 'white' : '#FAFAFA' }}>
                      <td style={{ padding:'10px 12px', fontWeight:'500', fontSize:'13px' }}>{d.nombre || '—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:'12px', color:'#0072DA' }}>{d.correo}</td>
                      <td style={{ padding:'10px 12px', fontSize:'12px', color:'#64748B' }}>{d.puesto || '—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:'12px', color:'#64748B' }}>{d.gerencia || '—'}</td>
                      <td style={{ padding:'10px 12px', textAlign:'right' }}>
                        <button onClick={() => eliminarDirector(d.id)}
                          style={{ background:'#FEF2F2', color:'#DA2B1F', border:'none', padding:'4px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
