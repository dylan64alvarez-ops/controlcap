import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import XLSXStyle from 'xlsx-js-style'
import PptxGenJS from 'pptxgenjs'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const ANIOS = ['2026', '2025', '2024', '2023', '2022', '2021']
const COLORS = { azul: '#0072DA', morado: '#8131B0', rojo: '#DA2B1F', grafito: '#414042' }

// Paleta CoopeAnde para Excel
const XL = {
  NAVY:   { rgb: '1B2560' },
  PURPLE: { rgb: '8131B0' },
  BLUE:   { rgb: '0072DA' },
  YELLOW: { rgb: 'FFCF00' },
  RED:    { rgb: 'DA2B1F' },
  WHITE:  { rgb: 'FFFFFF' },
  LIGHT:  { rgb: 'F8FAFC' },
  LIGHT2: { rgb: 'EEF0FF' },
  GRAY:   { rgb: '64748B' },
  GREEN:  { rgb: '0F9B72' },
}

function celda(valor, estilo = {}) {
  return { v: valor ?? '', s: estilo }
}

function headerCell(valor, bgColor = XL.NAVY) {
  return celda(valor, {
    font: { bold: true, color: XL.WHITE, sz: 11, name: 'Arial' },
    fill: { fgColor: bgColor },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: XL.WHITE },
      bottom: { style: 'thin', color: XL.WHITE },
      left: { style: 'thin', color: XL.WHITE },
      right: { style: 'thin', color: XL.WHITE },
    }
  })
}

function dataCell(valor, opciones = {}) {
  const { bold = false, color = { rgb: '1E293B' }, bg = XL.WHITE, align = 'left', sz = 10 } = opciones
  return celda(valor, {
    font: { bold, color, sz, name: 'Arial' },
    fill: { fgColor: bg },
    alignment: { horizontal: align, vertical: 'center', wrapText: false },
    border: {
      top: { style: 'hair', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'hair', color: { rgb: 'E2E8F0' } },
      left: { style: 'hair', color: { rgb: 'E2E8F0' } },
      right: { style: 'hair', color: { rgb: 'E2E8F0' } },
    }
  })
}

function titleCell(valor) {
  return celda(valor, {
    font: { bold: true, sz: 16, color: XL.NAVY, name: 'Arial' },
    fill: { fgColor: XL.WHITE },
    alignment: { horizontal: 'left', vertical: 'center' },
  })
}

function subtitleCell(valor) {
  return celda(valor, {
    font: { sz: 10, color: XL.GRAY, name: 'Arial', italic: true },
    fill: { fgColor: XL.WHITE },
    alignment: { horizontal: 'left', vertical: 'center' },
  })
}

function kpiLabelCell(valor) {
  return celda(valor, {
    font: { bold: true, sz: 9, color: XL.GRAY, name: 'Arial' },
    fill: { fgColor: XL.LIGHT },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { bottom: { style: 'thin', color: XL.PURPLE } }
  })
}

function kpiValueCell(valor, color = XL.PURPLE) {
  return celda(valor, {
    font: { bold: true, sz: 18, color, name: 'Arial' },
    fill: { fgColor: XL.LIGHT },
    alignment: { horizontal: 'center', vertical: 'center' },
  })
}

function accentCell(valor, color = XL.PURPLE) {
  return celda(valor, {
    font: { bold: true, sz: 10, color, name: 'Arial' },
    fill: { fgColor: XL.WHITE },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {
      top: { style: 'hair', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'hair', color: { rgb: 'E2E8F0' } },
      left: { style: 'hair', color: { rgb: 'E2E8F0' } },
      right: { style: 'hair', color: { rgb: 'E2E8F0' } },
    }
  })
}

export default function Reportes() {
  const [generando, setGenerando] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('2026')
  const [filtroGerencia, setFiltroGerencia] = useState('')
  const [filtroDep, setFiltroDep] = useState('')
  const [filtroCap, setFiltroCap] = useState('')
  const [filtroColab, setFiltroColab] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [busquedaColab, setBusquedaColab] = useState('')
  const [resultadosColab, setResultadosColab] = useState([])
  const [colabSeleccionado, setColabSeleccionado] = useState(null)
  const [gerencias, setGerencias] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [capacitaciones, setCapacitaciones] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [preview, setPreview] = useState(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)

  useEffect(() => { cargarCatalogos() }, [])
  useEffect(() => { cargarPreview() }, [filtroAnio, filtroGerencia, filtroDep, filtroCap, filtroColab, filtroProveedor])

  async function cargarCatalogos() {
    const [colRes, capRes] = await Promise.all([
      supabase.from('colaboradores').select('id, nombre, correo, gerencia, departamento, puesto').order('nombre'),
      supabase.from('capacitaciones').select('id, nombre, fecha_inicio, proveedor').order('nombre')
    ])
    const cols = colRes.data || []
    const caps = capRes.data || []
    setGerencias([...new Set(cols.map(c => c.gerencia).filter(Boolean))].sort())
    setCapacitaciones(caps)
    setProveedores([...new Set(caps.map(c => c.proveedor).filter(Boolean))].sort())
    setColaboradores(cols)
  }

  useEffect(() => {
    if (!filtroGerencia) { setDepartamentos([]); setFiltroDep(''); return }
    supabase.from('colaboradores').select('departamento').eq('gerencia', filtroGerencia).then(({ data }) => {
      setDepartamentos([...new Set((data || []).map(c => c.departamento).filter(Boolean))].sort())
      setFiltroDep('')
    })
  }, [filtroGerencia])

  useEffect(() => {
    if (!busquedaColab || busquedaColab.length < 2) { setResultadosColab([]); return }
    const b = busquedaColab.toLowerCase()
    setResultadosColab(colaboradores.filter(c => c.nombre?.toLowerCase().includes(b) || c.correo?.toLowerCase().includes(b)).slice(0, 8))
  }, [busquedaColab, colaboradores])

  function seleccionarColab(col) { setColabSeleccionado(col); setFiltroColab(col.correo); setBusquedaColab(col.nombre); setResultadosColab([]) }
  function limpiarColab() { setColabSeleccionado(null); setFiltroColab(''); setBusquedaColab(''); setResultadosColab([]) }

  async function obtenerDatosFiltrados() {
    const hayFiltrosCap = filtroAnio || filtroProveedor || filtroCap
    const { data: todasLasCaps } = await supabase.from('capacitaciones').select('*')
    const capsLookup = todasLasCaps || []

    let capsParaFiltro = capsLookup
    if (filtroAnio) capsParaFiltro = capsParaFiltro.filter(c => c.fecha_inicio?.startsWith(filtroAnio))
    if (filtroProveedor) capsParaFiltro = capsParaFiltro.filter(c => c.proveedor === filtroProveedor)
    if (filtroCap) capsParaFiltro = capsParaFiltro.filter(c => c.id === filtroCap)

    const capIds = capsParaFiltro.map(c => c.id)
    if (hayFiltrosCap && capIds.length === 0) return { caps: capsParaFiltro, parts: [], cols: [] }

    const { data: cols } = await supabase.from('colaboradores').select('*')
    const colById = {}, colByCorreo = {}, colByNombre = {}
    ;(cols || []).forEach(c => {
      colById[c.id] = c
      if (c.correo) colByCorreo[c.correo.toLowerCase().trim()] = c
      if (c.nombre) colByNombre[c.nombre.toUpperCase().trim()] = c
    })

    let partsRaw = []
    if (hayFiltrosCap && capIds.length > 0) {
      for (let i = 0; i < capIds.length; i += 400) {
        let qLote = supabase.from('participantes').select('*').in('capacitacion_id', capIds.slice(i, i + 400))
        if (filtroColab) qLote = qLote.eq('correo', filtroColab)
        const { data: pLote } = await qLote
        if (pLote) partsRaw.push(...pLote)
      }
    } else {
      let desde = 0
      while (true) {
        let qPage = supabase.from('participantes').select('*').range(desde, desde + 999)
        if (filtroColab) qPage = qPage.eq('correo', filtroColab)
        const { data: pagina } = await qPage
        if (!pagina || pagina.length === 0) break
        partsRaw.push(...pagina)
        if (pagina.length < 1000) break
        desde += 1000
      }
    }

    let parts = partsRaw.map(p => {
      const cap = capsLookup.find(c => c.id === p.capacitacion_id)
      const col = colById[p.colaborador_id] || colByCorreo[p.correo?.toLowerCase().trim()] || colByNombre[p.nombre_colab?.toUpperCase().trim()] || null
      const correoResuelto = col?.correo || (p.correo && !p.correo.startsWith('sin-correo__') ? p.correo : null) || null
      return { ...p, _cap: cap, _col: col, _nombre: col?.nombre || p.nombre_colab || '—', _correo: correoResuelto || '—', _gerencia: col?.gerencia || p.gerencia_colab || '—', _departamento: col?.departamento || p.departamento_colab || '—', _puesto: col?.puesto || p.puesto_colab || '—' }
    })

    if (filtroGerencia) parts = parts.filter(p => p._gerencia === filtroGerencia)
    if (filtroDep) parts = parts.filter(p => p._departamento === filtroDep)
    return { caps: capsParaFiltro, parts, cols: cols || [] }
  }

  async function cargarPreview() {
    setCargandoPreview(true)
    const { parts } = await obtenerDatosFiltrados()
    const totalPartic = parts.length
    const totalHoras = parts.reduce((s, p) => s + Number(p.horas || 0), 0)
    const totalCosto = parts.reduce((s, p) => s + Number(p.costo || 0), 0)
    const capsUnicas = new Set(parts.map(p => p.capacitacion_id)).size
    const porGerencia = {}
    parts.forEach(p => {
      const g = p._gerencia || 'Sin gerencia'
      if (!porGerencia[g]) porGerencia[g] = { partic: 0, horas: 0, costo: 0 }
      porGerencia[g].partic++
      porGerencia[g].horas += Number(p.horas || 0)
      porGerencia[g].costo += Number(p.costo || 0)
    })
    setPreview({ totalPartic, totalHoras, totalCosto, capsUnicas, porGerencia })
    setCargandoPreview(false)
  }

  function getFiltroDesc(caps) {
    return [
      filtroAnio ? `Año ${filtroAnio}` : 'Todos los años',
      filtroGerencia || '', filtroDep || '',
      filtroProveedor ? `Proveedor: ${filtroProveedor}` : '',
      colabSeleccionado ? `Colaborador: ${colabSeleccionado.nombre}` : '',
      filtroCap ? caps?.find(c => c.id === filtroCap)?.nombre || '' : ''
    ].filter(Boolean).join(' · ')
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
      const g = p._gerencia || 'Sin gerencia'
      if (!porGerencia[g]) porGerencia[g] = { partic: 0, horas: 0, costo: 0 }
      porGerencia[g].partic++
      porGerencia[g].horas += Number(p.horas || 0)
      porGerencia[g].costo += Number(p.costo || 0)
    })
    const filtroDesc = getFiltroDesc(caps)
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #1E293B; }
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
  <div class="subtitle">Universidad Corporativa · CoopeAnde N.º 1</div>
  <div class="filtro-badge">${filtroDesc}</div>
</div>
<div class="content">
  <div class="report-title">Informe de Capacitación</div>
  <div class="report-date">Generado el ${new Date().toLocaleDateString('es-CR', { year:'numeric', month:'long', day:'numeric' })}</div>
  <div class="kpis">
    <div class="kpi" style="border-color:#8131B0;background:#F5EEFF"><div class="kpi-label">Capacitaciones</div><div class="kpi-val" style="color:#8131B0">${capsUnicas}</div></div>
    <div class="kpi" style="border-color:#0072DA;background:#EFF6FF"><div class="kpi-label">Participaciones</div><div class="kpi-val" style="color:#0072DA">${totalPartic.toLocaleString()}</div></div>
    <div class="kpi" style="border-color:#FFCF00;background:#FFFBEB"><div class="kpi-label">Horas impartidas</div><div class="kpi-val" style="color:#D97706">${totalHoras.toLocaleString()}h</div></div>
    <div class="kpi" style="border-color:#DA2B1F;background:#FEF2F2"><div class="kpi-label">Costo ejecutado</div><div class="kpi-val" style="color:#DA2B1F">₡${Math.round(totalCosto).toLocaleString()}</div></div>
  </div>
  ${colabSeleccionado ? `
  <div class="section"><div class="section-title">Perfil del Colaborador</div>
  <table><tbody>
    <tr><td><strong>Nombre</strong></td><td>${colabSeleccionado.nombre}</td><td><strong>Correo</strong></td><td>${colabSeleccionado.correo}</td></tr>
    <tr><td><strong>Gerencia</strong></td><td>${colabSeleccionado.gerencia||'—'}</td><td><strong>Puesto</strong></td><td>${colabSeleccionado.puesto||'—'}</td></tr>
  </tbody></table></div>` : `
  <div class="section"><div class="section-title">Resumen por Gerencia</div>
  <table><thead><tr><th>Gerencia</th><th>Participaciones</th><th>Horas</th><th>Costo ejecutado</th></tr></thead>
  <tbody>${Object.entries(porGerencia).sort((a,b)=>b[1].partic-a[1].partic).map(([g,d])=>`<tr><td>${g}</td><td>${d.partic}</td><td>${d.horas.toLocaleString()}h</td><td>₡${Math.round(d.costo).toLocaleString()}</td></tr>`).join('')}</tbody>
  </table></div>`}
  <div class="section"><div class="section-title">Capacitaciones</div>
  <table><thead><tr><th>Nombre</th><th>Proveedor</th><th>Facilitador</th><th>Horas</th><th>Participantes</th><th>Costo total</th></tr></thead>
  <tbody>${[...new Map(parts.map(p=>[p.capacitacion_id,p._cap])).values()].filter(Boolean).map(c=>{
    const ps=parts.filter(p=>p.capacitacion_id===c.id); const ct=ps.reduce((s,p)=>s+Number(p.costo||0),0)
    return `<tr><td>${c.nombre}</td><td>${c.proveedor||'—'}</td><td>${c.facilitador||'—'}</td><td>${c.horas}h</td><td>${ps.length}</td><td>₡${Math.round(ct).toLocaleString()}</td></tr>`
  }).join('')}</tbody></table></div>
  <div class="section"><div class="section-title">Detalle de Participantes</div>
  <table><thead><tr><th>Colaborador</th><th>Correo</th><th>Gerencia</th><th>Puesto</th><th>Capacitación</th><th>Horas</th><th>Costo</th></tr></thead>
  <tbody>${parts.map(p=>`<tr><td>${p._nombre}</td><td>${p._correo}</td><td>${p._gerencia}</td><td>${p._puesto}</td><td>${p._cap?.nombre||'—'}</td><td>${p.horas||0}h</td><td>₡${Math.round(p.costo||0).toLocaleString()}</td></tr>`).join('')}</tbody>
  </table></div>
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
      const { caps, parts } = await obtenerDatosFiltrados()
      const wb = XLSXStyle.utils.book_new()
      const filtroDesc = getFiltroDesc(caps)
      const fecha = new Date().toLocaleDateString('es-CR')

      const totalPartic = parts.length
      const totalHoras = parts.reduce((s, p) => s + Number(p.horas || 0), 0)
      const totalCosto = parts.reduce((s, p) => s + Number(p.costo || 0), 0)
      const capsUnicas = new Set(parts.map(p => p.capacitacion_id)).size

      // ── HOJA 1: RESUMEN ───────────────────────────────────────
      const porGerencia = {}
      parts.forEach(p => {
        const g = p._gerencia || 'Sin gerencia'
        if (!porGerencia[g]) porGerencia[g] = { partic: 0, horas: 0, costo: 0 }
        porGerencia[g].partic++
        porGerencia[g].horas += Number(p.horas || 0)
        porGerencia[g].costo += Number(p.costo || 0)
      })

      const ws1Data = []

      // Título
      ws1Data.push([titleCell('ControlCap — Informe de Capacitación'), celda(''), celda(''), celda('')])
      ws1Data.push([subtitleCell(`Universidad Corporativa · CoopeAnde N.º 1 · ${filtroDesc}`), celda(''), celda(''), celda('')])
      ws1Data.push([subtitleCell(`Generado el ${fecha}`), celda(''), celda(''), celda('')])
      ws1Data.push([celda(''), celda(''), celda(''), celda('')])

      // KPIs
      ws1Data.push([
        kpiLabelCell('CAPACITACIONES'),
        kpiLabelCell('PARTICIPACIONES'),
        kpiLabelCell('HORAS IMPARTIDAS'),
        kpiLabelCell('COSTO EJECUTADO'),
      ])
      ws1Data.push([
        kpiValueCell(capsUnicas, XL.PURPLE),
        kpiValueCell(totalPartic.toLocaleString(), XL.BLUE),
        kpiValueCell(`${totalHoras.toLocaleString()}h`, { rgb: 'D97706' }),
        kpiValueCell(`₡${Math.round(totalCosto).toLocaleString()}`, XL.RED),
      ])
      ws1Data.push([celda(''), celda(''), celda(''), celda('')])

      // Header tabla gerencia
      ws1Data.push([
        headerCell('GERENCIA'),
        headerCell('PARTICIPACIONES'),
        headerCell('HORAS TOTALES'),
        headerCell('COSTO EJECUTADO (₡)'),
      ])

      // Datos gerencia
      const gerArr = Object.entries(porGerencia).sort((a, b) => b[1].partic - a[1].partic)
      gerArr.forEach(([g, d], i) => {
        const bg = i % 2 === 0 ? XL.WHITE : { rgb: 'F5EEFF' }
        ws1Data.push([
          dataCell(g, { bold: true, bg }),
          dataCell(d.partic.toLocaleString(), { align: 'center', bg }),
          dataCell(`${d.horas.toLocaleString()}h`, { align: 'center', bg }),
          accentCell(`₡${Math.round(d.costo).toLocaleString()}`, XL.RED),
        ])
      })

      // Fila total
      ws1Data.push([
        dataCell('TOTAL', { bold: true, color: XL.WHITE, bg: XL.NAVY }),
        dataCell(totalPartic.toLocaleString(), { bold: true, color: XL.WHITE, bg: XL.NAVY, align: 'center' }),
        dataCell(`${totalHoras.toLocaleString()}h`, { bold: true, color: XL.WHITE, bg: XL.NAVY, align: 'center' }),
        dataCell(`₡${Math.round(totalCosto).toLocaleString()}`, { bold: true, color: XL.YELLOW, bg: XL.NAVY, align: 'right' }),
      ])

      const ws1 = XLSXStyle.utils.aoa_to_sheet(ws1Data)
      ws1['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 18 }, { wch: 22 }]
      ws1['!rows'] = [{ hpt: 28 }, { hpt: 16 }, { hpt: 14 }, { hpt: 10 }, { hpt: 22 }, { hpt: 36 }]
      ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
      ]
      XLSXStyle.utils.book_append_sheet(wb, ws1, '📊 Resumen')

      // ── HOJA 2: PARTICIPANTES ─────────────────────────────────
      const ws2Data = []
      ws2Data.push([titleCell('Detalle de Participantes'), ...Array(11).fill(celda(''))])
      ws2Data.push([subtitleCell(filtroDesc), ...Array(11).fill(celda(''))])
      ws2Data.push(Array(12).fill(celda('')))
      ws2Data.push([
        headerCell('COLABORADOR'),
        headerCell('CORREO'),
        headerCell('GÉNERO'),
        headerCell('GERENCIA'),
        headerCell('DEPARTAMENTO'),
        headerCell('PUESTO'),
        headerCell('CAPACITACIÓN'),
        headerCell('PROVEEDOR', XL.PURPLE),
        headerCell('CATEGORÍA', XL.PURPLE),
        headerCell('FACILITADOR', XL.PURPLE),
        headerCell('HORAS', XL.BLUE),
        headerCell('COSTO (₡)', XL.RED),
      ])

      parts.forEach((p, i) => {
        const bg = i % 2 === 0 ? XL.WHITE : XL.LIGHT
        ws2Data.push([
          dataCell(p._nombre, { bold: true, bg }),
          dataCell(p._correo, { color: XL.BLUE, bg }),
          dataCell(p.genero === 'FEMENINO' ? 'F' : p.genero === 'MASCULINO' ? 'M' : '—', { align: 'center', bg }),
          dataCell(p._gerencia, { bg }),
          dataCell(p._departamento, { bg }),
          dataCell(p._puesto, { bg }),
          dataCell(p._cap?.nombre || '—', { bg }),
          dataCell(p._cap?.proveedor || '—', { bg }),
          dataCell(p._cap?.categoria || '—', { bg }),
          dataCell(p._cap?.facilitador || '—', { bg }),
          dataCell(`${p.horas || 0}h`, { align: 'center', color: XL.GREEN, bold: true, bg }),
          accentCell(`₡${Math.round(p.costo || 0).toLocaleString()}`, XL.RED),
        ])
      })

      const ws2 = XLSXStyle.utils.aoa_to_sheet(ws2Data)
      ws2['!cols'] = [{ wch: 30 }, { wch: 28 }, { wch: 8 }, { wch: 25 }, { wch: 22 }, { wch: 25 }, { wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 8 }, { wch: 16 }]
      ws2['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
      ]
      XLSXStyle.utils.book_append_sheet(wb, ws2, '👥 Participantes')

      // ── HOJA 3: CAPACITACIONES ────────────────────────────────
      const capsUnicasArr = [...new Map(parts.map(p => [p.capacitacion_id, p._cap])).values()].filter(Boolean)
      const ws3Data = []
      ws3Data.push([titleCell('Capacitaciones'), ...Array(9).fill(celda(''))])
      ws3Data.push([subtitleCell(filtroDesc), ...Array(9).fill(celda(''))])
      ws3Data.push(Array(10).fill(celda('')))
      ws3Data.push([
        headerCell('NOMBRE'),
        headerCell('PROVEEDOR', XL.PURPLE),
        headerCell('CATEGORÍA', XL.PURPLE),
        headerCell('MODALIDAD'),
        headerCell('ESTADO'),
        headerCell('FACILITADOR'),
        headerCell('FECHA INICIO'),
        headerCell('HORAS', XL.BLUE),
        headerCell('PARTICIPANTES', XL.BLUE),
        headerCell('COSTO TOTAL (₡)', XL.RED),
      ])

      capsUnicasArr.forEach((c, i) => {
        const bg = i % 2 === 0 ? XL.WHITE : XL.LIGHT
        const ps = parts.filter(p => p.capacitacion_id === c.id)
        const ct = ps.reduce((s, p) => s + Number(p.costo || 0), 0)
        ws3Data.push([
          dataCell(c.nombre, { bold: true, bg }),
          dataCell(c.proveedor || '—', { bg }),
          dataCell(c.categoria || '—', { color: XL.PURPLE, bg }),
          dataCell(c.modalidad || '—', { bg }),
          dataCell(c.estado || '—', { bg }),
          dataCell(c.facilitador || '—', { bg }),
          dataCell(c.fecha_inicio || '—', { align: 'center', bg }),
          dataCell(`${c.horas || 0}h`, { align: 'center', color: XL.BLUE, bold: true, bg }),
          dataCell(ps.length.toString(), { align: 'center', color: XL.BLUE, bold: true, bg }),
          accentCell(`₡${Math.round(ct).toLocaleString()}`, XL.RED),
        ])
      })

      const ws3 = XLSXStyle.utils.aoa_to_sheet(ws3Data)
      ws3['!cols'] = [{ wch: 40 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 18 }]
      ws3['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      ]
      XLSXStyle.utils.book_append_sheet(wb, ws3, '🎓 Capacitaciones')

      const filtroFile = [filtroAnio || 'Todos', filtroGerencia ? filtroGerencia.slice(0, 10) : '', filtroProveedor ? filtroProveedor.slice(0, 10) : '', colabSeleccionado ? colabSeleccionado.nombre.split(' ').slice(0, 2).join('_') : ''].filter(Boolean).join('_')
      XLSXStyle.writeFile(wb, `ControlCap_${filtroFile}_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e) {
      alert('Error generando Excel: ' + e.message)
    }
    setGenerando('')
  }

  async function generarPPTX() {
    setGenerando('pptx')
    try {
      const { caps, parts } = await obtenerDatosFiltrados()
      const totalPartic = parts.length
      const totalHoras = parts.reduce((s, p) => s + Number(p.horas || 0), 0)
      const totalCosto = parts.reduce((s, p) => s + Number(p.costo || 0), 0)
      const capsUnicas = new Set(parts.map(p => p.capacitacion_id)).size
      const porGerencia = {}
      parts.forEach(p => {
        const g = p._gerencia || 'Sin gerencia'
        if (!porGerencia[g]) porGerencia[g] = { partic: 0, horas: 0, costo: 0 }
        porGerencia[g].partic++
        porGerencia[g].horas += Number(p.horas || 0)
        porGerencia[g].costo += Number(p.costo || 0)
      })
      const gerArr = Object.entries(porGerencia).sort((a, b) => b[1].partic - a[1].partic).slice(0, 8)
      const pptx = new PptxGenJS()
      pptx.layout = 'LAYOUT_WIDE'
      const NAVY='1B2560', YELLOW='FFCF00', WHITE='FFFFFF', PURPLE='8131B0', BLUE='0072DA', RED='DA2B1F', LIGHT='F8FAFC', GRAY='64748B'
      const filtroDesc = getFiltroDesc(caps)

      const s1 = pptx.addSlide()
      s1.background = { color: NAVY }
      s1.addShape(pptx.ShapeType.rect, { x:0, y:4.5, w:13.33, h:3.0, fill:{color:PURPLE}, line:{color:PURPLE} })
      s1.addText('Control', { x:0.6, y:0.5, w:2.5, h:0.8, fontSize:40, bold:true, color:YELLOW, fontFace:'Arial' })
      s1.addText('Cap', { x:2.6, y:0.5, w:2, h:0.8, fontSize:40, bold:true, color:WHITE, fontFace:'Arial' })
      s1.addText('Universidad Corporativa · CoopeAnde N.º 1', { x:0.6, y:1.4, w:9, h:0.4, fontSize:13, color:'AABCDE', fontFace:'Arial' })
      s1.addText('Informe de Capacitación', { x:0.6, y:2.1, w:11, h:0.9, fontSize:34, bold:true, color:WHITE, fontFace:'Arial' })
      s1.addText(filtroDesc.length>80?filtroDesc.slice(0,78)+'...':filtroDesc, { x:0.6, y:3.1, w:12, h:0.5, fontSize:14, color:YELLOW, fontFace:'Arial' })
      s1.addText(new Date().toLocaleDateString('es-CR',{year:'numeric',month:'long',day:'numeric'}), { x:0.6, y:4.7, w:8, h:0.4, fontSize:13, color:WHITE, fontFace:'Arial' })
      s1.addText('Uso interno exclusivo', { x:0.6, y:5.2, w:8, h:0.35, fontSize:11, color:'AAAACC', fontFace:'Arial' })

      const s2 = pptx.addSlide()
      s2.background = { color: LIGHT }
      s2.addText('Resumen Ejecutivo', { x:0.5, y:0.3, w:12, h:0.6, fontSize:24, bold:true, color:NAVY, fontFace:'Arial' })
      s2.addText(filtroDesc.length>80?filtroDesc.slice(0,78)+'...':filtroDesc, { x:0.5, y:0.9, w:12, h:0.35, fontSize:12, color:GRAY, fontFace:'Arial' })
      const kpis = [
        { label:'Capacitaciones', val:capsUnicas.toString(), color:PURPLE },
        { label:'Participaciones', val:totalPartic.toLocaleString(), color:BLUE },
        { label:'Horas impartidas', val:totalHoras.toLocaleString()+'h', color:'D97706' },
        { label:'Costo ejecutado', val:'₡'+Math.round(totalCosto).toLocaleString(), color:RED },
      ]
      kpis.forEach((k,i) => {
        const x = 0.4 + i * 3.15
        s2.addShape(pptx.ShapeType.rect, { x, y:1.5, w:2.9, h:1.8, fill:{color:WHITE}, line:{color:'E2E8F0',pt:1} })
        s2.addShape(pptx.ShapeType.rect, { x, y:1.5, w:0.08, h:1.8, fill:{color:k.color}, line:{color:k.color} })
        s2.addText(k.label.toUpperCase(), { x:x+0.2, y:1.65, w:2.6, h:0.3, fontSize:9, color:GRAY, fontFace:'Arial', bold:true })
        s2.addText(k.val, { x:x+0.2, y:2.05, w:2.6, h:0.8, fontSize:24, bold:true, color:k.color, fontFace:'Arial' })
      })

      if (!filtroColab && gerArr.length > 0) {
        const s3 = pptx.addSlide()
        s3.background = { color: WHITE }
        s3.addText('Participaciones por Gerencia', { x:0.5, y:0.3, w:12, h:0.55, fontSize:22, bold:true, color:NAVY, fontFace:'Arial' })
        const maxP = Math.max(...gerArr.map(([,d])=>d.partic),1)
        gerArr.forEach(([g,d],i) => {
          const y = 1.1 + i * 0.72
          const label = g.replace('Gerencia de ','').replace('Gerencia ','').replace('Gerencia De ','')
          s3.addText(label.length>28?label.slice(0,26)+'...':label, { x:0.4, y, w:3.8, h:0.45, fontSize:11, color:NAVY, fontFace:'Arial', valign:'middle' })
          s3.addShape(pptx.ShapeType.rect, { x:4.3, y:y+0.05, w:8.0, h:0.35, fill:{color:'E2E8F0'}, line:{color:'E2E8F0'} })
          s3.addShape(pptx.ShapeType.rect, { x:4.3, y:y+0.05, w:Math.max((d.partic/maxP)*7.5,0.1), h:0.35, fill:{color:BLUE}, line:{color:BLUE} })
          s3.addText(d.partic.toString(), { x:12.4, y, w:0.8, h:0.45, fontSize:11, bold:true, color:BLUE, fontFace:'Arial', align:'right' })
        })
      }

      if (colabSeleccionado) {
        const s4 = pptx.addSlide()
        s4.background = { color: LIGHT }
        s4.addText('Perfil del Colaborador', { x:0.5, y:0.3, w:12, h:0.55, fontSize:22, bold:true, color:NAVY, fontFace:'Arial' })
        s4.addShape(pptx.ShapeType.rect, { x:0.5, y:1.0, w:12.3, h:1.5, fill:{color:WHITE}, line:{color:'E2E8F0',pt:1} })
        s4.addText(colabSeleccionado.nombre, { x:0.7, y:1.1, w:8, h:0.5, fontSize:18, bold:true, color:NAVY, fontFace:'Arial' })
        s4.addText(colabSeleccionado.gerencia||'—', { x:0.7, y:1.65, w:5, h:0.35, fontSize:13, color:GRAY, fontFace:'Arial' })
        s4.addText(colabSeleccionado.puesto||'—', { x:5.5, y:1.65, w:5, h:0.35, fontSize:13, color:GRAY, fontFace:'Arial' })
        const capCount = {}
        parts.forEach(p => {
          if (!capCount[p.capacitacion_id]) capCount[p.capacitacion_id] = { nombre:p._cap?.nombre||'—', horas:0, costo:0 }
          capCount[p.capacitacion_id].horas += Number(p.horas||0)
          capCount[p.capacitacion_id].costo += Number(p.costo||0)
        })
        const capsList = Object.values(capCount).slice(0,10)
        if (capsList.length > 0) {
          const rows = [
            [{ text:'Capacitación', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10} },{ text:'Horas', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'center'} },{ text:'Costo', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'right'} }],
            ...capsList.map((c,i)=>[
              { text:c.nombre.length>60?c.nombre.slice(0,58)+'...':c.nombre, options:{fontSize:10,fill:i%2===0?WHITE:LIGHT} },
              { text:c.horas+'h', options:{fontSize:10,align:'center',fill:i%2===0?WHITE:LIGHT} },
              { text:'₡'+Math.round(c.costo).toLocaleString(), options:{fontSize:10,align:'right',fill:i%2===0?WHITE:LIGHT} },
            ])
          ]
          s4.addTable(rows, { x:0.5, y:2.7, w:12.3, colW:[9.5,1.3,1.5], border:{type:'solid',pt:0.5,color:'E2E8F0'} })
        }
      }

      const s5 = pptx.addSlide()
      s5.background = { color: LIGHT }
      s5.addText('Top Capacitaciones', { x:0.5, y:0.3, w:12, h:0.55, fontSize:22, bold:true, color:NAVY, fontFace:'Arial' })
      const capCount2 = {}
      parts.forEach(p => {
        if (!capCount2[p.capacitacion_id]) capCount2[p.capacitacion_id] = { nombre:p._cap?.nombre||'—', proveedor:p._cap?.proveedor||'—', partic:0, horas:0, costo:0 }
        capCount2[p.capacitacion_id].partic++
        capCount2[p.capacitacion_id].horas += Number(p.horas||0)
        capCount2[p.capacitacion_id].costo += Number(p.costo||0)
      })
      const topCaps = Object.values(capCount2).sort((a,b)=>b.partic-a.partic).slice(0,8)
      if (topCaps.length > 0) {
        const rows2 = [
          [
            { text:'Capacitación', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10} },
            { text:'Proveedor', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10} },
            { text:'Part.', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'center'} },
            { text:'Horas', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'center'} },
            { text:'Costo total', options:{bold:true,color:WHITE,fill:NAVY,fontSize:10,align:'right'} },
          ],
          ...topCaps.map((c,i)=>[
            { text:c.nombre.length>45?c.nombre.slice(0,43)+'...':c.nombre, options:{fontSize:10,fill:i%2===0?WHITE:LIGHT} },
            { text:c.proveedor.length>20?c.proveedor.slice(0,18)+'...':c.proveedor, options:{fontSize:9,fill:i%2===0?WHITE:LIGHT} },
            { text:c.partic.toString(), options:{fontSize:10,align:'center',fill:i%2===0?WHITE:LIGHT} },
            { text:c.horas+'h', options:{fontSize:10,align:'center',fill:i%2===0?WHITE:LIGHT} },
            { text:'₡'+Math.round(c.costo).toLocaleString(), options:{fontSize:10,align:'right',fill:i%2===0?WHITE:LIGHT} },
          ])
        ]
        s5.addTable(rows2, { x:0.5, y:1.0, w:12.3, colW:[5.8,2.5,1.0,1.0,2.0], border:{type:'solid',pt:0.5,color:'E2E8F0'} })
      }

      const s6 = pptx.addSlide()
      s6.background = { color: NAVY }
      s6.addShape(pptx.ShapeType.rect, { x:0, y:3.2, w:13.33, h:0.08, fill:{color:YELLOW}, line:{color:YELLOW} })
      s6.addText('Control', { x:4.2, y:0.8, w:2.4, h:0.9, fontSize:42, bold:true, color:YELLOW, fontFace:'Arial' })
      s6.addText('Cap', { x:6.2, y:0.8, w:2, h:0.9, fontSize:42, bold:true, color:WHITE, fontFace:'Arial' })
      s6.addText('Universidad Corporativa', { x:2, y:1.85, w:9.33, h:0.5, fontSize:18, color:'AABCDE', fontFace:'Arial', align:'center' })
      s6.addText('CoopeAnde N.º 1', { x:2, y:2.4, w:9.33, h:0.4, fontSize:14, color:'AABCDE', fontFace:'Arial', align:'center' })
      s6.addText('Informe generado el '+new Date().toLocaleDateString('es-CR'), { x:2, y:3.6, w:9.33, h:0.4, fontSize:12, color:WHITE, fontFace:'Arial', align:'center' })
      s6.addText('Uso interno exclusivo', { x:2, y:4.1, w:9.33, h:0.35, fontSize:11, color:'8899BB', fontFace:'Arial', align:'center' })

      const filtroFile = [filtroAnio||'Todos', filtroGerencia?filtroGerencia.slice(0,10):'', filtroProveedor?filtroProveedor.slice(0,10):'', colabSeleccionado?colabSeleccionado.nombre.split(' ').slice(0,2).join('_'):''].filter(Boolean).join('_')
      await pptx.writeFile({ fileName: `ControlCap_${filtroFile}_${new Date().toISOString().slice(0,10)}.pptx` })
    } catch(e) { alert('Error generando PowerPoint: ' + e.message) }
    setGenerando('')
  }

  const inp = { height:'36px', border:'1px solid #E2E8F0', borderRadius:'8px', padding:'0 10px', fontSize:'13px', outline:'none', background:'white' }
  const capsDelAnio = capacitaciones.filter(c => !filtroAnio || (c.fecha_inicio && c.fecha_inicio.startsWith(filtroAnio)))
  const capsDelProvAnio = filtroProveedor ? capsDelAnio.filter(c => c.proveedor === filtroProveedor) : capsDelAnio

  return (
    <div>
      <div style={{ background:'white', borderRadius:'12px', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize:'13px', fontWeight:'600', color:'#1E293B', marginBottom:'14px' }}>🔍 Filtros del reporte</div>
        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-start' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            <label style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'600', textTransform:'uppercase' }}>Año</label>
            <select value={filtroAnio} onChange={e => { setFiltroAnio(e.target.value); setFiltroCap('') }} style={{ ...inp, width:'120px' }}>
              <option value="">Todos los años</option>
              {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            <label style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'600', textTransform:'uppercase' }}>Gerencia</label>
            <select value={filtroGerencia} onChange={e => setFiltroGerencia(e.target.value)} style={{ ...inp, width:'220px' }}>
              <option value="">Todas</option>
              {gerencias.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          {filtroGerencia && departamentos.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <label style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'600', textTransform:'uppercase' }}>Departamento</label>
              <select value={filtroDep} onChange={e => setFiltroDep(e.target.value)} style={{ ...inp, width:'200px' }}>
                <option value="">Todos</option>
                {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            <label style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'600', textTransform:'uppercase' }}>Proveedor</label>
            <select value={filtroProveedor} onChange={e => { setFiltroProveedor(e.target.value); setFiltroCap('') }} style={{ ...inp, width:'220px' }}>
              <option value="">Todos</option>
              {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            <label style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'600', textTransform:'uppercase' }}>Capacitación</label>
            <select value={filtroCap} onChange={e => setFiltroCap(e.target.value)} style={{ ...inp, width:'250px' }}>
              <option value="">Todas</option>
              {capsDelProvAnio.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', position:'relative' }}>
            <label style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'600', textTransform:'uppercase' }}>Colaborador</label>
            <div style={{ position:'relative' }}>
              <input type="text" placeholder="Buscar colaborador..." value={busquedaColab}
                onChange={e => { setBusquedaColab(e.target.value); if (colabSeleccionado) limpiarColab() }}
                style={{ ...inp, width:'220px', paddingRight:colabSeleccionado?'28px':'10px' }} />
              {colabSeleccionado && (
                <button onClick={limpiarColab} style={{ position:'absolute', right:'8px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:'14px' }}>✕</button>
              )}
              {resultadosColab.length > 0 && (
                <div style={{ position:'absolute', top:'40px', left:0, width:'280px', background:'white', border:'1px solid #E2E8F0', borderRadius:'8px', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', zIndex:50, maxHeight:'200px', overflowY:'auto' }}>
                  {resultadosColab.map((c,i) => (
                    <div key={c.id} onClick={() => seleccionarColab(c)}
                      style={{ padding:'8px 12px', cursor:'pointer', fontSize:'12px', borderBottom:i<resultadosColab.length-1?'1px solid #F1F5F9':'none' }}
                      onMouseEnter={e => e.currentTarget.style.background='#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background='white'}>
                      <div style={{ fontWeight:'500', color:'#1E293B' }}>{c.nombre}</div>
                      <div style={{ color:'#94A3B8', fontSize:'11px' }}>{c.correo} · {c.gerencia}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {(filtroAnio || filtroGerencia || filtroDep || filtroCap || filtroColab || filtroProveedor) && (
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <label style={{ fontSize:'10px', color:'transparent' }}>-</label>
              <button onClick={() => { setFiltroAnio('2026'); setFiltroGerencia(''); setFiltroDep(''); setFiltroCap(''); setFiltroProveedor(''); limpiarColab() }}
                style={{ ...inp, width:'auto', padding:'0 14px', cursor:'pointer', color:'#64748B' }}>
                ✕ Limpiar todo
              </button>
            </div>
          )}
        </div>
      </div>

      {preview && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
          {[
            { label:'Capacitaciones', val:preview.capsUnicas, color:COLORS.morado },
            { label:'Participaciones', val:preview.totalPartic.toLocaleString(), color:COLORS.azul },
            { label:'Horas', val:preview.totalHoras.toLocaleString()+'h', color:'#D97706' },
            { label:'Costo ejecutado', val:'₡'+Math.round(preview.totalCosto).toLocaleString(), color:COLORS.rojo },
          ].map(k => (
            <div key={k.label} style={{ background:'white', borderRadius:'10px', padding:'14px 16px', borderLeft:`4px solid ${k.color}`, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:'10px', color:'#64748B', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}>{k.label}</div>
              <div style={{ fontSize:'20px', fontWeight:'700', color:k.color }}>{cargandoPreview ? '...' : k.val}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'16px' }}>
        {[
          { id:'pdf', icon:'📄', titulo:'PDF Ejecutivo', desc:'Informe completo con KPIs, resumen por gerencia, capacitaciones y detalle de participantes.', color:COLORS.rojo, accion:generarPDF, boton:'Generar PDF' },
          { id:'excel', icon:'📊', titulo:'Excel Estilizado', desc:'3 hojas con diseño CoopeAnde: Resumen con KPIs, Participantes y Capacitaciones con colores y estilos.', color:'#0F9B72', accion:generarExcel, boton:'Descargar Excel' },
          { id:'pptx', icon:'📽️', titulo:'PowerPoint Ejecutivo', desc:'Presentación con portada, KPIs, gráficas por gerencia, costo ejecutado y top capacitaciones.', color:COLORS.morado, accion:generarPPTX, boton:'Descargar PPTX' },
        ].map(r => (
          <div key={r.id} style={{ background:'white', borderRadius:'16px', padding:'24px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', border:`1px solid ${r.color}22` }}>
            <div style={{ fontSize:'32px', marginBottom:'10px' }}>{r.icon}</div>
            <div style={{ fontSize:'16px', fontWeight:'600', color:'#1E293B', marginBottom:'6px' }}>{r.titulo}</div>
            <div style={{ fontSize:'12px', color:'#64748B', marginBottom:'18px', lineHeight:'1.6' }}>{r.desc}</div>
            <button onClick={r.accion} disabled={!!generando}
              style={{ background:generando===r.id?'#E2E8F0':r.color, color:generando===r.id?'#94A3B8':'white', border:'none', padding:'9px 20px', borderRadius:'8px', cursor:generando?'not-allowed':'pointer', fontSize:'13px', fontWeight:'500', width:'100%' }}>
              {generando===r.id?'⏳ Generando...':r.boton}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
