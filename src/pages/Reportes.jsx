import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Reportes() {
  const [generando, setGenerando] = useState('')

  async function obtenerDatos() {
    const [cap, par, col, pre] = await Promise.all([
      supabase.from('capacitaciones').select('*'),
      supabase.from('participantes').select(`*, colaboradores(*), capacitaciones(*)`),
      supabase.from('colaboradores').select('*'),
      supabase.from('presupuesto').select('*')
    ])
    return {
      capacitaciones: cap.data || [],
      participantes: par.data || [],
      colaboradores: col.data || [],
      presupuesto: pre.data || []
    }
  }

  async function generarPDF() {
    setGenerando('pdf')
    const datos = await obtenerDatos()

    const totalHoras = datos.participantes.reduce((s, p) => s + Number(p.capacitaciones?.horas || 0), 0)
    const totalCosto = datos.presupuesto.filter(m => m.cd === 'CR').reduce((s, m) => s + Number(m.importe), 0)

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; color: #1E293B; margin: 0; padding: 40px; }
  .header { background: #1B2560; color: white; padding: 30px 40px; margin: -40px -40px 30px; }
  .logo { font-size: 28px; font-weight: bold; margin-bottom: 4px; }
  .logo span { color: #F59E0B; }
  .subtitle { font-size: 13px; opacity: 0.7; }
  .title { font-size: 22px; font-weight: bold; margin: 30px 0 6px; }
  .date { font-size: 12px; color: #64748B; margin-bottom: 30px; }
  .kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 30px; }
  .kpi { padding: 16px; border-radius: 8px; border-left: 4px solid; }
  .kpi-label { font-size: 11px; color: #64748B; margin-bottom: 6px; text-transform: uppercase; }
  .kpi-val { font-size: 26px; font-weight: bold; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 14px; font-weight: bold; color: #1B2560; border-bottom: 2px solid #1B2560; padding-bottom: 6px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #1B2560; color: white; padding: 8px 10px; text-align: left; }
  td { padding: 7px 10px; border-bottom: 1px solid #E2E8F0; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <div class="logo"><span>Control</span>Cap</div>
  <div class="subtitle">Universidad Corporativa · CoopeAnde N.º 1</div>
</div>

<div class="title">Informe Ejecutivo de Capacitación</div>
<div class="date">Generado el ${new Date().toLocaleDateString('es-CR', { year:'numeric', month:'long', day:'numeric' })}</div>

<div class="kpis">
  <div class="kpi" style="border-color:#5B4EE8;background:#EEF0FF">
    <div class="kpi-label">Capacitaciones</div>
    <div class="kpi-val" style="color:#5B4EE8">${datos.capacitaciones.length}</div>
  </div>
  <div class="kpi" style="border-color:#0F9B72;background:#F0FDF4">
    <div class="kpi-label">Participantes</div>
    <div class="kpi-val" style="color:#0F9B72">${datos.participantes.length}</div>
  </div>
  <div class="kpi" style="border-color:#D97706;background:#FFFBEB">
    <div class="kpi-label">Horas impartidas</div>
    <div class="kpi-val" style="color:#D97706">${totalHoras}</div>
  </div>
  <div class="kpi" style="border-color:#DC2626;background:#FEF2F2">
    <div class="kpi-label">Presupuesto ejecutado</div>
    <div class="kpi-val" style="color:#DC2626">₡${totalCosto.toLocaleString()}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Capacitaciones registradas</div>
  <table>
    <thead><tr><th>Nombre</th><th>Categoría</th><th>Modalidad</th><th>Estado</th><th>Horas</th><th>Costo</th></tr></thead>
    <tbody>
      ${datos.capacitaciones.map(c => `
        <tr>
          <td>${c.nombre}</td>
          <td>${c.categoria || ''}</td>
          <td>${c.modalidad || ''}</td>
          <td>${c.estado || ''}</td>
          <td>${c.horas}h</td>
          <td>₡${Number(c.costo).toLocaleString()}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>

<div class="section">
  <div class="section-title">Participantes</div>
  <table>
    <thead><tr><th>Colaborador</th><th>Correo</th><th>Gerencia</th><th>Capacitación</th><th>Horas</th></tr></thead>
    <tbody>
      ${datos.participantes.map(p => `
        <tr>
          <td>${p.colaboradores?.nombre || ''}</td>
          <td>${p.colaboradores?.correo || ''}</td>
          <td>${p.colaboradores?.gerencia || ''}</td>
          <td>${p.capacitaciones?.nombre || ''}</td>
          <td>${p.capacitaciones?.horas || 0}h</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>

<div class="section">
  <div class="section-title">Movimientos presupuestarios</div>
  <table>
    <thead><tr><th>Centro Gestor</th><th>Posición</th><th>CD</th><th>Texto</th><th>Importe</th></tr></thead>
    <tbody>
      ${datos.presupuesto.map(m => `
        <tr>
          <td>${m.centro_gestor}</td>
          <td>${m.posicion}</td>
          <td>${m.cd}</td>
          <td>${m.texto}</td>
          <td>₡${Number(m.importe).toLocaleString()}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>

<div class="footer">
  ControlCap · Universidad Corporativa · CoopeAnde N.º 1 · Uso interno exclusivo
</div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const w = window.open(url, '_blank')
    setTimeout(() => {
      w.print()
      URL.revokeObjectURL(url)
    }, 800)

    setGenerando('')
  }

  async function generarExcel() {
    setGenerando('excel')
    const datos = await obtenerDatos()
    const { default: XLSX } = await import('xlsx')

    const wb = XLSX.utils.book_new()

    // Hoja capacitaciones
    const cap = datos.capacitaciones.map(c => ({
      Nombre: c.nombre,
      Categoría: c.categoria,
      Modalidad: c.modalidad,
      Estado: c.estado,
      'Fecha Inicio': c.fecha_inicio,
      'Fecha Fin': c.fecha_fin,
      Horas: c.horas,
      Costo: c.costo,
      Facilitador: c.facilitador,
      Proveedor: c.proveedor
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cap), 'Capacitaciones')

    // Hoja participantes
    const par = datos.participantes.map(p => ({
      Colaborador: p.colaboradores?.nombre,
      Correo: p.colaboradores?.correo,
      Gerencia: p.colaboradores?.gerencia,
      Departamento: p.colaboradores?.departamento,
      Puesto: p.colaboradores?.puesto,
      Capacitación: p.capacitaciones?.nombre,
      Horas: p.capacitaciones?.horas
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(par), 'Participantes')

    // Hoja colaboradores
    const col = datos.colaboradores.map(c => ({
      Nombre: c.nombre,
      Correo: c.correo,
      Cédula: c.cedula,
      Género: c.genero,
      Gerencia: c.gerencia,
      Departamento: c.departamento,
      Puesto: c.puesto,
      'Centro Gestor': c.centro_gestor
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(col), 'Colaboradores')

    // Hoja presupuesto
    const pre = datos.presupuesto.map(m => ({
      'Centro Gestor': m.centro_gestor,
      'Posición': m.posicion,
      'CD': m.cd,
      'Texto': m.texto,
      'Importe': m.importe,
      'Fecha': m.fecha,
      'Estado': m.estado
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pre), 'Presupuesto')

    XLSX.writeFile(wb, `ControlCap_Reporte_${new Date().toISOString().slice(0,10)}.xlsx`)
    setGenerando('')
  }

  const reportes = [
    {
      id: 'pdf',
      icon: '📄',
      titulo: 'Informe ejecutivo PDF',
      descripcion: 'Reporte completo con KPIs, capacitaciones, participantes y presupuesto. Se abre para imprimir o guardar como PDF.',
      color: '#DC2626',
      bg: '#FEF2F2',
      accion: generarPDF,
      boton: 'Generar PDF'
    },
    {
      id: 'excel',
      icon: '📊',
      titulo: 'Exportar a Excel',
      descripcion: 'Descarga todas las hojas: capacitaciones, participantes, colaboradores y presupuesto en un solo archivo.',
      color: '#0F9B72',
      bg: '#F0FDF4',
      accion: generarExcel,
      boton: 'Descargar Excel'
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', color: '#64748B' }}>
          Generá reportes con todos los datos actuales del sistema en un clic
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {reportes.map(r => (
          <div key={r.id} style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: `1px solid ${r.color}22` }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>{r.icon}</div>
            <div style={{ fontSize: '17px', fontWeight: '600', color: '#1E293B', marginBottom: '8px' }}>{r.titulo}</div>
            <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px', lineHeight: '1.6' }}>{r.descripcion}</div>
            <button
              onClick={r.accion}
              disabled={generando === r.id}
              style={{
                background: generando === r.id ? '#E2E8F0' : r.color,
                color: generando === r.id ? '#94A3B8' : 'white',
                border: 'none', padding: '10px 22px', borderRadius: '8px',
                cursor: generando === r.id ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: '500'
              }}>
              {generando === r.id ? '⏳ Generando...' : r.boton}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
