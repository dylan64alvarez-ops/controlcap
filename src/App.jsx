import { useState } from 'react'

export default function App() {
  const [pagina, setPagina] = useState('dashboard')

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Menú lateral */}
      <div style={{ width: '220px', background: '#1B2560', color: 'white', padding: '20px 0' }}>
        
        {/* Logo */}
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            <span style={{ color: '#F59E0B' }}>Control</span>Cap
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
            Universidad Corporativa
          </div>
        </div>

        {/* Navegación */}
        <nav style={{ padding: '10px 0' }}>
          {[
            { id: 'dashboard', label: '📊 Dashboard' },
            { id: 'capacitaciones', label: '🎓 Capacitaciones' },
            { id: 'participantes', label: '👥 Participantes' },
            { id: 'presupuesto', label: '💰 Presupuesto' },
            { id: 'traslados', label: '↔️ Traslados' },
            { id: 'colaboradores', label: '📋 Colaboradores' },
            { id: 'reportes', label: '📄 Reportes' },
            { id: 'importar', label: '📥 Importar datos' },
          ].map(item => (
            <div
              key={item.id}
              onClick={() => setPagina(item.id)}
              style={{
                padding: '10px 20px',
                cursor: 'pointer',
                background: pagina === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                borderLeft: pagina === item.id ? '3px solid #F59E0B' : '3px solid transparent',
                fontSize: '13px',
              }}
            >
              {item.label}
            </div>
          ))}
        </nav>
      </div>

      {/* Contenido principal */}
      <div style={{ flex: 1, background: '#F8FAFC', overflow: 'auto' }}>
        
        {/* Header */}
        <div style={{ background: 'white', padding: '15px 30px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', textTransform: 'capitalize' }}>
            {pagina}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            CoopeAnde N.º 1 · 2025
          </div>
        </div>

        {/* Página activa */}
        <div style={{ padding: '30px' }}>
          {pagina === 'dashboard' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Capacitaciones', valor: '0', color: '#5B4EE8' },
                  { label: 'Participantes', valor: '0', color: '#0F9B72' },
                  { label: 'Horas totales', valor: '0', color: '#D97706' },
                  { label: 'Presupuesto', valor: '₡0', color: '#DC2626' },
                ].map(kpi => (
                  <div key={kpi.label} style={{ background: 'white', borderRadius: '12px', padding: '20px', borderLeft: `4px solid ${kpi.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>{kpi.label}</div>
                    <div style={{ fontSize: '28px', fontWeight: '600', color: kpi.color }}>{kpi.valor}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Cargá datos para ver</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'white', borderRadius: '12px', padding: '30px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📥</div>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>Importá tus datos para comenzar</div>
                <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>Andá a "Importar datos" en el menú y cargá tu Excel</div>
                <button
                  onClick={() => setPagina('importar')}
                  style={{ background: '#5B4EE8', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Ir a Importar datos →
                </button>
              </div>
            </div>
          )}

          {pagina !== 'dashboard' && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚧</div>
              <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px', textTransform: 'capitalize' }}>
                Módulo: {pagina}
              </div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>
                Este módulo se construye en el siguiente paso
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
