import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const ANIOS = ['2026', '2025', '2024', '2023', '2022', '2021']
const COLORS = { azul: '#0072DA', morado: '#8131B0', rojo: '#DA2B1F', grafito: '#414042' }

export default function Reportes() {
  const [generando, setGenerando] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('2026')
  const [filtroGerencia, setFiltroGerencia] = useState('')
  const [filtroDep, setFiltroDep] = useState('')
  const [filtroCap, setFiltroCap] = useState('')
  const [gerencias, setGerencias] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [capacitaciones, setCapacitaciones] = useState([])
  const [preview, setPreview] = useState(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)

  useEffect(() => { cargarCatalogos() }, [])
  useEffect(() => { cargarPreview() }, [filtroAnio, filtroGerencia, filtroDep, filtroCap])

  async function cargarCatalogos() {
    const [colRes, capRes] = await Promise.all([
      supabase.from('colaboradores').select('gerencia, departamento').order('gerencia'),
      supabase.from('capacitaciones').select('id, nombre, fecha_inicio').order('nombre')
    ])
    const gersUnicas = [...new Set((colRes.data || []).map(c => c.gerencia).filter(Boolean))].sort()
    setGerencias(gersUnicas)
    setCapacitaciones(capRes.data || [])
  }

  useEffect(() => {
    if (!filtroGerencia) { setDepartamentos([]); setFiltroDep(''); return }
    const cargarDeps = async () => {
      const { data } = await supabase
        .from('colaboradores')
        .select('departamento')
        .eq('gerencia', filtroGerencia)
      const deps = [...new Set((data || []).map(c => c.departamento).filter(Boolean))].sort()
      setDepartamentos(deps)
      setFiltroDep('')
    }
    cargarDeps()
  }, [filtroGerencia])

  async function obtenerDatosFiltrados() {
    let qCap = supabase.from('capacitaciones').select('*')
    if (filtroAnio) {
      qCap = qCap.gte('fecha_inicio', `${filtroAnio}-01-01`).lte('fecha_inicio', `${filtroAnio}-12-31`)
    }
    if (filtroCap) qCap = qCap.eq('id', filtroCap)
    const { data: caps } = await qCap

    const capIds = (caps || []).map(c => c.id)
    if (capIds.length === 0) return { caps: [], parts: [], cols: [] }

    const { data: cols } = await supabase.from('colaboradores').select('*')
    const colById = {}, colByCorreo = {}
    ;(cols || []).forEach(c => {
      colById[c.id] = c
      if (c.correo) colByCorreo[c.correo.toLowerCase().trim()] = c
    })

    const { data: partsRaw } = await supabase
      .from('participantes')
      .select('*')
      .in('capacitacion_id', capIds)

    let parts = (partsRaw || []).map(p => {
      const cap = caps.find(c => c.id === p.capacitacion_id)
      const col = colById[p.colaborador_id] || colByCorreo[p.correo?.toLowerCase().trim()] || null
      return { ...p, _cap: cap, _col: col }
    })

    if (filtroGerencia) parts = parts.filter(p => p._col?.gerencia === filtroGerencia)
    if (filtroDep) parts = parts.filter(p => p._col?.departamento === filtroDep)

    return { caps, parts, cols: cols || [] }
  }

  async function cargarPreview() {
    setCargandoPreview(true)
    const { caps, parts } = await obtenerDatosFiltrados()
    const totalPartic = parts.length
    const totalHoras = parts.reduce((s, p) => s + Number(p.horas || 0), 0)
    const totalCosto = parts.reduce((s, p) => s + Number(p.costo || 0), 0)
    const capsUnicas = new Set(parts.map(p => p.capacitacion_id)).size
    const porGerencia = {}
    parts.forEach(p => {
      const g = p._col?.gerencia || 'Sin gerencia'
      if (!porGerencia[g]) porGerencia[g] = { partic: 0, horas: 0, costo: 0 }
      porGerencia[g].partic++
      porGerencia[g].horas += Number(p.horas || 0)
      porGerencia[g].costo += Number(p.costo || 0)
    })
    setPreview({ totalPartic, totalHoras, totalCosto, capsUnicas, porGerencia, caps, parts })
    setCargandoPreview(false)
  }

  async function generarPDF() {
    setGenerando('pdf')
    const { caps, parts } = await obtenerDatosFiltrados()
    const totalPartic = parts.length
    const totalHoras = parts.reduce((s, p) => s + Number(p.horas || 0), 0)
    const totalCosto = parts.reduce((s, p) => s + Number(p.costo || 0), 0)
    const capsUnicas = new Set(parts.map(p => p.capacitacion_id)).size
    const porGerencia = {}
    parts.forEach(p => {
      const g = p._col?.gerencia || 'Sin gerencia'
      if (!porGerencia[g]) porGerencia[g] = { partic: 0, horas: 0, costo: 0 }
      porGerencia[g].partic++
      porGerencia[g].horas += Number(p.horas || 0)
      porGerencia[g].costo += Number(p.costo || 0)
    })
    const filtroDesc = [
      filtroAnio ? `Año ${filtroAnio}` : 'Todos los años',
      filtroGerencia || '', filtroDep || '',
      filtroCap ? caps.find(c => c.id === filtroCap)?.nombre || '' : ''
    ].filter(Boolean).join(' · ')

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #1E293B; padding: 0; }
  .header { background: #1B2560; color: white; padding: 32px 40px; }
  .logo { font-size: 26px; font-weight: bold; margin-bottom: 4px; }
  .logo span { color: #FFCF00; }
  .subtitle { font-size: 12px; opacity: 0.7; margin-bottom: 16px; }
  .filtro-badge { background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 20px; font-size: 12px; display: inline-block; }
  .content { padding: 32px 40px; }
  .report-title { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
  .report-date { font-size: 11px; color: #64748B; margin-bottom: 24px; }
  .kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { padding: 16px; border-radius: 8px; border-left: 4px solid; }
  .kpi-label { font-size: 10px; color: #64748B; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi-val { font-size: 24px; font-weight: bold; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: bold; color: #1B2560; border-bottom: 2px solid #1B2560; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #1B2560; color: white; padding: 8px 10px; text-align: left; font-size: 10px; letter-spacing: 0.5px; }
  td { padding: 7px 10px; border-bottom: 1px solid #E2E8F0; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .footer { margin-top: 32px; padding: 16px 40px; border-top: 1px solid #E2E8F0; font-size: 10px; color: #94A3B8; display: flex; justify-content: space-between; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo"><span>Control</span>Cap</div>
  <div class="subtitle">Universidad Corporativa · CoopeAnde N.º 1</div>
  <div class="filtro-badge">${filtroDesc}</div>
</div>
<div class="content">
  <div class="report-title">Informe de Capacitación</div>
  <div class="report-date">Generado el ${new Date().toLocaleDateString('es-CR', { year:'numeric', month:'long', day:'numeric' })}</div>
  <div class="kpis">
    <div class="kpi" style="border-color:#8131B0;background:#F5EEFF">
      <div class="kpi-label">Capacitaciones</div>
      <div class="kpi-val" style="color:#8131B0">${capsUnicas}</div>
    </div>
    <div class="kpi" style="border-color:#0072DA;background:#EFF6FF">
      <div class="kpi-label">Participaciones</div>
      <div class="kpi-val" style="color:#0072DA">${totalPartic.toLocaleString()}</div>
    </div>
    <div class="kpi" style="border-color:#FFCF00;background:#FFFBEB">
      <div class="kpi-label">Horas impartidas</div>
      <div class="kpi-val" style="color:#D97706">${totalHoras.toLocaleString()}h</div>
    </div>
    <div class="kpi" style="border-color:#DA2B1F;background:#FEF2F2">
      <div class="kpi-label">Costo ejecutado</div>
      <div class="kpi-val" style="color:#DA2B1F">₡${Math.round(totalCosto).toLocaleString()}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Resumen por Gerencia</div>
    <table>
      <thead><tr><th>Gerencia</th><th>Participaciones</th><th>Horas</th><th>Costo ejecutado</th></tr></thead>
      <tbody>
        ${Object.entries(porGerencia).sort((a,b) => b[1].partic - a[1].partic).map(([g, d]) => `
          <tr><td>${g}</td><td>${d.partic}</td><td>${d.horas.toLocaleString()}h</td><td>₡${Math.round(d.costo).toLocaleString()}</td></tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  <div class="section">
    <div class="section-title">Capacitaciones</div>
    <table>
      <thead><tr><th>Nombre</th><th>Categoría</th><th>Facilitador</th><th>Horas</th><th>Participantes</th><th>Costo total</th></tr></thead>
      <tbody>
        ${[...new Map(parts.map(p => [p.capacitacion_id, p._cap])).values()].filter(Boolean).map(c => {
          const ps = parts.filter(p => p.capacitacion_id === c.id)
          const ct = ps.reduce((s, p) => s + Number(p.costo || 0), 0)
          return `<tr><td>${c.nombre}</td><td>${c.categoria||'—'}</td><td>${c.facilitador||'—'}</td><td>${c.horas}h</td><td>${ps.length}</td><td>₡${Math.round(ct).toLocaleString()}</td></tr>`
        }).join('')}
      </tbody>
    </table>
  </div>
  <div class="section">
    <div class="section-title">Detalle de Participantes</div>
    <table>
      <thead><tr><th>Colaborador</th><th>Correo</th><th>Gerencia</th><th>Departamento</th><th>Puesto</th><th>Capacitación</th><th>Horas</th><th>Costo</th></tr></thead>
      <tbody>
        ${parts.map(p => `
          <tr>
            <td>${p._col?.nombre||'—'}</td>
            <td>${(!p.correo||p.correo.startsWith('sin-correo')) ? '—' : p.correo}</td>
            <td>${p._col?.gerencia||'—'}</td>
            <td>${p._col?.departamento||'—'}</td>
            <td>${p._col?.puesto||'—'}</td>
            <td>${p._cap?.nombre||'—'}</td>
            <td>${p.horas||0}h</td>
            <td>₡${Math.round(p.costo||0).toLocaleString()}</td>
          </tr>
        `).join('')}
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
      const { caps, parts, cols } = await obtenerDatosFiltrados()
      const wb = XLSX.utils.book_new()

      const porGerencia = {}
      parts.forEach(p => {
        const g = p._col?.gerencia || 'Sin gerencia'
        if (!porGerencia[g]) porGerencia[g] = { partic: 0, horas: 0, costo: 0 }
        porGerencia[g].partic++
        porGerencia[g].horas += Number(p.horas || 0)
        porGerencia[g].costo += Number(p.costo || 0)
      })
      const resumen = Object.entries(porGerencia).map(([g, d]) => ({
        Gerencia: g,
        Participaciones: d.partic,
        'Horas totales': d.horas,
        'Costo ejecutado (₡)': Math.round(d.costo)
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen.length ? resumen : [{}]), 'Resumen por Gerencia')

      const partsSheet = parts.map(p => ({
        Colaborador: p._col?.nombre || '—',
        Correo: (!p.correo || p.correo.startsWith('sin-correo')) ? '—' : p.correo,
        Cédula: p._col?.cedula || '—',
        Género: p.genero || '—',
        Gerencia: p._col?.gerencia || '—',
        Departamento: p._col?.departamento || '—',
        Puesto: p._col?.puesto || '—',
        Capacitación: p._cap?.nombre || '—',
        Categoría: p._cap?.categoria || '—',
        Facilitador: p._cap?.facilitador || '—',
        'Fecha inicio': p._cap?.fecha_inicio || '—',
        Horas: p.horas || 0,
        'Costo (₡)': Math.round(p.costo || 0),
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partsSheet.length ? partsSheet : [{}]), 'Participantes')

      const capsUnicas = [...new Map(parts.map(p => [p.capacitacion_id, p._cap])).values()].filter(Boolean)
      const capsSheet = capsUnicas.map(c => ({
        Nombre: c.nombre,
        Categoría: c.categoria || '—',
        Modalidad: c.modalidad || '—',
        Estado: c.estado || '—',
        Facilitador: c.facilitador || '—',
        Proveedor: c.proveedor || '—',
        'Fecha inicio': c.fecha_inicio || '—',
        'Fecha fin': c.fecha_fin || '—',
        Horas: c.horas || 0,
        Participantes: parts.filter(p => p.capacitacion_id === c.id).length,
        'Costo total (₡)': Math.round(parts.filter(p => p.capacitacion_id === c.id).reduce((s, p) => s + Number(p.costo || 0), 0))
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(capsSheet.length ? capsSheet : [{}]), 'Capacitaciones')

      const colsSheet = cols.map(c => ({
        Nombre: c.nombre,
        Correo: c.correo,
        Cédula: c.cedula,
        Género: c.genero,
        'Fecha ingreso': c.fecha_ingreso,
        Gerencia: c.gerencia,
        Departamento: c.departamento,
        Área: c.area,
        Puesto: c.puesto,
        'Centro Gestor': c.centro_gestor,
        Estado: c.estado,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(colsSheet.length ? colsSheet : [{}]), 'Colaboradores')

      const filtroFile = [filtroAnio, filtroGerencia, filtroDep].filter(Boolean).join('_') || 'General'
      XLSX.writeFile(wb, `ControlCap_${filtroFile}_${new Date().toISOString().slice(0,10)}.xlsx`)
    } catch(e) {
      alert('Error generando Excel: ' + e.message)
    }
    setGenerando('')
  }

  async function generarPPTX() {
    setGenerando('pptx')
    try {
      const PptxGenJS = (await import('pptxgenjs')).default

      const { caps, parts } = await obtenerDatosFiltrados()
      const totalPartic = parts.length
      const totalHoras = parts.reduce((s, p) => s + Number(p.horas || 0), 0)
      const totalCosto = parts.reduce((s, p) => s + Number(p.costo || 0), 0)
      const capsUnicas = new Set(parts.map(p => p.capacitacion_id)).size

      const porGerencia = {}
      parts.forEach(p => {
        const g = p._col?.gerencia || 'Sin gerencia'
        if (!porGerencia[g]) porGerencia[g] = { partic: 0, horas: 0, costo: 0 }
        porGerencia[g].partic++
        porGerencia[g].horas += Number(p.horas || 0)
        porGerencia[g].costo += Number(p.costo || 0)
      })
      const gerArr = Object.entries(porGerencia).sort((a,b) => b[1].partic - a[1].partic).slice(0, 8)

      const pptx = new PptxGenJS()
      pptx.layout = 'LAYOUT_WIDE'

      const NAVY = '1B2560'
      const YELLOW = 'FFCF00'
      const WHITE = 'FFFFFF'
      const PURPLE = '8131B0'
      const BLUE = '0072DA'
      const RED = 'DA2B1F'
      const LIGHT = 'F8FAFC'
      const GRAY = '64748B'

      const filtroDesc = [
        filtroAnio ? `Año ${filtroAnio}` : 'Todos los años',
        filtroGerencia || '', filtroDep || ''
      ].filter(Boolean).join(' · ')

      // ── SLIDE 1: Portada ──────────────────────────────────────
      const s1 = pptx.addSlide()
      s1.background = { color: NAVY }
      s1.addShape(pptx.ShapeType.rect, { x: 0, y: 4.5, w: 13.33, h: 3.0, fill: { color: PURPLE }, line: { color: PURPLE } })
      s1.addText('Control', { x: 0.6, y: 0.5, w: 2.5, h: 0.8, fontSize: 40, bold: true, color: YELLOW, fontFace: 'Arial' })
      s1.addText('Cap', { x: 2.6, y: 0.5, w: 2, h: 0.8, fontSize: 40, bold: true, color: WHITE, fontFace: 'Arial' })
      s1.addText('Universidad Corporativa · CoopeAnde N.º 1', { x: 0.6, y: 1.4, w: 9, h: 0.4, fontSize: 13, color: 'AABCDE', fontFace: 'Arial' })
      s1.addText('Informe de Capacitación', { x: 0.6, y: 2.1, w: 11, h: 0.9, fontSize: 34, bold: true, color: WHITE, fontFace: 'Arial' })
      s1.addText(filtroDesc, { x: 0.6, y: 3.1, w: 10, h: 0.5, fontSize: 16, color: YELLOW, fontFace: 'Arial' })
      s1.addText(new Date().toLocaleDateString('es-CR', { year:'numeric', month:'long', day:'numeric' }), { x: 0.6, y: 4.7, w: 8, h: 0.4, fontSize: 13, color: WHITE, fontFace: 'Arial' })
      s1.addText('Uso interno exclusivo', { x: 0.6, y: 5.2, w: 8, h: 0.35, fontSize: 11, color: 'AAAACC', fontFace: 'Arial' })

      // ── SLIDE 2: KPIs ─────────────────────────────────────────
      const s2 = pptx.addSlide()
      s2.background = { color: LIGHT }
      s2.addText('Resumen Ejecutivo', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 24, bold: true, color: NAVY, fontFace: 'Arial' })
      s2.addText(filtroDesc, { x: 0.5, y: 0.9, w: 12, h: 0.35, fontSize: 12, color: GRAY, fontFace: 'Arial' })

      const kpis = [
        { label: 'Capacitaciones', val: capsUnicas.toString(), color: PURPLE },
        { label: 'Participaciones', val: totalPartic.toLocaleString(), color: BLUE },
        { label: 'Horas impartidas', val: totalHoras.toLocaleString() + 'h', color: 'D97706' },
        { label: 'Costo ejecutado', val: '₡' + Math.round(totalCosto).toLocaleString(), color: RED },
      ]
      kpis.forEach((k, i) => {
        const x = 0.4 + i * 3.15
        s2.addShape(pptx.ShapeType.rect, { x, y: 1.5, w: 2.9, h: 1.8, fill: { color: WHITE }, line: { color: 'E2E8F0', pt: 1 } })
        s2.addShape(pptx.ShapeType.rect, { x, y: 1.5, w: 0.08, h: 1.8, fill: { color: k.color }, line: { color: k.color } })
        s2.addText(k.label.toUpperCase(), { x: x + 0.2, y: 1.65, w: 2.6, h: 0.3, fontSize: 9, color: GRAY, fontFace: 'Arial', bold: true })
        s2.addText(k.val, { x: x + 0.2, y: 2.05, w: 2.6, h: 0.8, fontSize: 24, bold: true, color: k.color, fontFace: 'Arial' })
      })

      // ── SLIDE 3: Participaciones por Gerencia ─────────────────
      const s3 = pptx.addSlide()
      s3.background = { color: WHITE }
      s3.addText('Participaciones por Gerencia', { x: 0.5, y: 0.3, w: 12, h: 0.55, fontSize: 22, bold: true, color: NAVY, fontFace: 'Arial' })
      const maxPartic = Math.max(...gerArr.map(([,d]) => d.partic), 1)
      gerArr.forEach(([g, d], i) => {
        const y = 1.1 + i * 0.72
        const barW = (d.partic / maxPartic) * 7.5
        const label = g.replace('Gerencia de ', '').replace('Gerencia ', '').replace('Gerencia De ', '')
        s3.addText(label.length > 28 ? label.slice(0,26)+'...' : label, { x: 0.4, y, w: 3.8, h: 0.45, fontSize: 11, color: NAVY, fontFace: 'Arial', valign: 'middle' })
        s3.addShape(pptx.ShapeType.rect, { x: 4.3, y: y + 0.05, w: 8.0, h: 0.35, fill: { color: 'E2E8F0' }, line: { color: 'E2E8F0' } })
        s3.addShape(pptx.ShapeType.rect, { x: 4.3, y: y + 0.05, w: Math.max(barW, 0.1), h: 0.35, fill: { color: BLUE }, line: { color: BLUE } })
        s3.addText(d.partic.toString(), { x: 12.4, y, w: 0.8, h: 0.45, fontSize: 11, bold: true, color: BLUE, fontFace: 'Arial', align: 'right' })
      })

      // ── SLIDE 4: Costo por Gerencia ───────────────────────────
      const s4 = pptx.addSlide()
      s4.background = { color: WHITE }
      s4.addText('Costo Ejecutado por Gerencia', { x: 0.5, y: 0.3, w: 12, h: 0.55, fontSize: 22, bold: true, color: NAVY, fontFace: 'Arial' })
      const gerCosto = Object.entries(porGerencia).sort((a,b) => b[1].costo - a[1].costo).slice(0, 8)
      const maxCosto = Math.max(...gerCosto.map(([,d]) => d.costo), 1)
      gerCosto.forEach(([g, d], i) => {
        const y = 1.1 + i * 0.72
        const barW = (d.costo / maxCosto) * 7.5
        const label = g.replace('Gerencia de ', '').replace('Gerencia ', '').replace('Gerencia De ', '')
        s4.addText(label.length > 28 ? label.slice(0,26)+'...' : label, { x: 0.4, y, w: 3.8, h: 0.45, fontSize: 11, color: NAVY, fontFace: 'Arial', valign: 'middle' })
        s4.addShape(pptx.ShapeType.rect, { x: 4.3, y: y + 0.05, w: 8.0, h: 0.35, fill: { color: 'E2E8F0' }, line: { color: 'E2E8F0' } })
        s4.addShape(pptx.ShapeType.rect, { x: 4.3, y: y + 0.05, w: Math.max(barW, 0.1), h: 0.35, fill: { color: RED }, line: { color: RED } })
        s4.addText('₡' + Math.round(d.costo).toLocaleString(), { x: 11.8, y, w: 1.4, h: 0.45, fontSize: 10, bold: true, color: RED, fontFace: 'Arial', align: 'right' })
      })

      // ── SLIDE 5: Top Capacitaciones ───────────────────────────
      const s5 = pptx.addSlide()
      s5.background = { color: LIGHT }
      s5.addText('Top Capacitaciones', { x: 0.5, y: 0.3, w: 12, h: 0.55, fontSize: 22, bold: true, color: NAVY, fontFace: 'Arial' })
      const capCount = {}
      parts.forEach(p => {
        const id = p.capacitacion_id
        if (!capCount[id]) capCount[id] = { nombre: p._cap?.nombre || '—', partic: 0, horas: 0, costo: 0 }
        capCount[id].partic++
        capCount[id].horas += Number(p.horas || 0)
        capCount[id].costo += Number(p.costo || 0)
      })
      const topCaps = Object.values(capCount).sort((a,b) => b.partic - a.partic).slice(0, 8)
      const rows = [
        [
          { text: 'Capacitación', options: { bold: true, color: WHITE, fill: NAVY, fontSize: 10 } },
          { text: 'Participantes', options: { bold: true, color: WHITE, fill: NAVY, fontSize: 10, align: 'center' } },
          { text: 'Horas', options: { bold: true, color: WHITE, fill: NAVY, fontSize: 10, align: 'center' } },
          { text: 'Costo total', options: { bold: true, color: WHITE, fill: NAVY, fontSize: 10, align: 'right' } },
        ],
        ...topCaps.map((c, i) => [
          { text: c.nombre.length > 55 ? c.nombre.slice(0,53)+'...' : c.nombre, options: { fontSize: 10, fill: i%2===0 ? WHITE : LIGHT } },
          { text: c.partic.toString(), options: { fontSize: 10, align: 'center', fill: i%2===0 ? WHITE : LIGHT } },
          { text: c.horas + 'h', options: { fontSize: 10, align: 'center', fill: i%2===0 ? WHITE : LIGHT } },
          { text: '₡' + Math.round(c.costo).toLocaleString(), options: { fontSize: 10, align: 'right', fill: i%2===0 ? WHITE : LIGHT } },
        ])
      ]
      s5.addTable(rows, { x: 0.5, y: 1.0, w: 12.3, colW: [7.5, 1.5, 1.2, 2.1], border: { type: 'solid', pt: 0.5, color: 'E2E8F0' } })

      // ── SLIDE 6: Cierre ───────────────────────────────────────
      const s6 = pptx.addSlide()
      s6.background = { color: NAVY }
      s6.addShape(pptx.ShapeType.rect, { x: 0, y: 3.2, w: 13.33, h: 0.08, fill: { color: YELLOW }, line: { color: YELLOW } })
      s6.addText('Control', { x: 4.2, y: 0.8, w: 2.4, h: 0.9, fontSize: 42, bold: true, color: YELLOW, fontFace: 'Arial' })
      s6.addText('Cap', { x: 6.2, y: 0.8, w: 2, h: 0.9, fontSize: 42, bold: true, color: WHITE, fontFace: 'Arial' })
      s6.addText('Universidad Corporativa', { x: 2, y: 1.85, w: 9.33, h: 0.5, fontSize: 18, color: 'AABCDE', fontFace: 'Arial', align: 'center' })
      s6.addText('CoopeAnde N.º 1', { x: 2, y: 2.4, w: 9.33, h: 0.4, fontSize: 14, color: 'AABCDE', fontFace: 'Arial', align: 'center' })
      s6.addText('Informe generado el ' + new Date().toLocaleDateString('es-CR'), { x: 2, y: 3.6, w: 9.33, h: 0.4, fontSize: 12, color: WHITE, fontFace: 'Arial', align: 'center' })
      s6.addText('Uso interno exclusivo', { x: 2, y: 4.1, w: 9.33, h: 0.35, fontSize: 11, color: '8899BB', fontFace: 'Arial', align: 'center' })

      const filtroFile = [filtroAnio, filtroGerencia, filtroDep].filter(Boolean).join('_') || 'General'
      await pptx.writeFile({ fileName: `ControlCap_${filtroFile}_${new Date().toISOString().slice(0,10)}.pptx` })
    } catch(e) {
      alert('Error generando PowerPoint: ' + e.message)
    }
    setGenerando('')
  }

  const inp = { height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', fontSize: '13px', outline: 'none', background: 'white' }
  const capsDelAnio = capacitaciones.filter(c => !filtroAnio || (c.fecha_inicio && c.fecha_inicio.startsWith(filtroAnio)))

  return (
    <div>
      {/* Filtros */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B', marginBottom: '14px' }}>🔍 Filtros del reporte</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filtroAnio} onChange={e => { setFiltroAnio(e.target.value); setFiltroCap('') }}
            style={{ ...inp, width: '130px' }}>
            <option value="">Todos los años</option>
            {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroGerencia} onChange={e => setFiltroGerencia(e.target.value)}
            style={{ ...inp, width: '260px' }}>
            <option value="">Todas las gerencias</option>
            {gerencias.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {filtroGerencia && departamentos.length > 0 && (
            <select value={filtroDep} onChange={e => setFiltroDep(e.target.value)}
              style={{ ...inp, width: '220px' }}>
              <option value="">Todos los departamentos</option>
              {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <select value={filtroCap} onChange={e => setFiltroCap(e.target.value)}
            style={{ ...inp, width: '280px' }}>
            <option value="">Todas las capacitaciones</option>
            {capsDelAnio.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {(filtroAnio || filtroGerencia || filtroDep || filtroCap) && (
            <button onClick={() => { setFiltroAnio('2026'); setFiltroGerencia(''); setFiltroDep(''); setFiltroCap('') }}
              style={{ ...inp, width: 'auto', padding: '0 14px', cursor: 'pointer', color: '#64748B' }}>
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Preview KPIs */}
      {preview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Capacitaciones', val: preview.capsUnicas, color: COLORS.morado },
            { label: 'Participaciones', val: preview.totalPartic.toLocaleString(), color: COLORS.azul },
            { label: 'Horas', val: preview.totalHoras.toLocaleString() + 'h', color: '#D97706' },
            { label: 'Costo ejecutado', val: '₡' + Math.round(preview.totalCosto).toLocaleString(), color: COLORS.rojo },
          ].map(k => (
            <div key={k.label} style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', borderLeft: `4px solid ${k.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{k.label}</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: k.color }}>{cargandoPreview ? '...' : k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Botones de reporte */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          {
            id: 'pdf', icon: '📄', titulo: 'PDF Ejecutivo',
            desc: 'Informe completo con KPIs, resumen por gerencia, lista de capacitaciones y detalle de participantes.',
            color: COLORS.rojo, accion: generarPDF, boton: 'Generar PDF'
          },
          {
            id: 'excel', icon: '📊', titulo: 'Excel Detallado',
            desc: '4 hojas: Resumen por gerencia, Participantes, Capacitaciones y Colaboradores.',
            color: '#0F9B72', accion: generarExcel, boton: 'Descargar Excel'
          },
          {
            id: 'pptx', icon: '📽️', titulo: 'PowerPoint Ejecutivo',
            desc: 'Presentación con portada, KPIs, gráficas por gerencia, costo ejecutado y top capacitaciones.',
            color: COLORS.morado, accion: generarPPTX, boton: 'Descargar PPTX'
          },
        ].map(r => (
          <div key={r.id} style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: `1px solid ${r.color}22` }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>{r.icon}</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', marginBottom: '6px' }}>{r.titulo}</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '18px', lineHeight: '1.6' }}>{r.desc}</div>
            <button onClick={r.accion} disabled={!!generando}
              style={{
                background: generando === r.id ? '#E2E8F0' : r.color,
                color: generando === r.id ? '#94A3B8' : 'white',
                border: 'none', padding: '9px 20px', borderRadius: '8px',
                cursor: generando ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: '500', width: '100%'
              }}>
              {generando === r.id ? '⏳ Generando...' : r.boton}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
