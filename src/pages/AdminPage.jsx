import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function AdminPage() {
  const navigate = useNavigate()
  const [esAdmin, setEsAdmin] = useState(null)
  const [resumen, setResumen] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const { data: sesion } = await supabase.auth.getSession()
      if (!sesion.session) {
        navigate('/login')
        return
      }

      const { data: admin } = await supabase
        .from('administradores')
        .select('id')
        .eq('auth_user_id', sesion.session.user.id)
        .maybeSingle()

      if (!admin) {
        setEsAdmin(false)
        setCargando(false)
        return
      }
      setEsAdmin(true)

      // Ingresos VALIDADOS: solo pagos con estado 'pagado', confirmados por Culqi
      const { data: pagos } = await supabase
        .from('pagos')
        .select('consultorio_id, monto, comision_monto, estado, consultorios(nombre)')
        .eq('estado', 'pagado')

      const { data: liquidaciones } = await supabase
        .from('liquidaciones')
        .select('consultorio_id, comision_monto, estado')

      const porConsultorio = {}
      for (const p of pagos || []) {
        const id = p.consultorio_id
        if (!porConsultorio[id]) {
          porConsultorio[id] = {
            id,
            nombre: p.consultorios?.nombre || 'Consultorio',
            totalGenerado: 0,
            comisionTotal: 0,
          }
        }
        porConsultorio[id].totalGenerado += p.monto
        porConsultorio[id].comisionTotal += p.comision_monto
      }
      for (const l of liquidaciones || []) {
        if (l.estado === 'pagada' && porConsultorio[l.consultorio_id]) {
          porConsultorio[l.consultorio_id].comisionTotal -= l.comision_monto
        }
      }

      setResumen(Object.values(porConsultorio))
      setCargando(false)
    }
    cargar()
  }, [])

  async function marcarLiquidado(consultorioId, montoPendiente) {
    await supabase.from('liquidaciones').insert({
      consultorio_id: consultorioId,
      periodo_inicio: new Date().toISOString().slice(0, 10),
      periodo_fin: new Date().toISOString().slice(0, 10),
      monto_generado: montoPendiente,
      comision_monto: montoPendiente,
      estado: 'pagada',
      fecha_pago: new Date().toISOString(),
    })
    setResumen((prev) =>
      prev.map((c) => (c.id === consultorioId ? { ...c, comisionTotal: 0 } : c)),
    )
  }

  if (cargando) return <div className="p-8 font-sans text-tinta/60">Cargando…</div>
  if (esAdmin === false)
    return <div className="p-8 font-sans text-tinta/60">No tienes acceso a este panel.</div>

  return (
    <div className="min-h-screen bg-sillar-50 font-sans">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-xl font-display font-medium mb-1">Panel de administrador</h1>
        <p className="text-sm text-tinta/60 mb-6">
          Ingresos validados directamente por Culqi — ningún consultorio puede alterar estos montos.
        </p>

        <div className="space-y-2">
          {resumen.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-sillar-200 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{c.nombre}</p>
                <p className="text-sm text-tinta/60">
                  Generado: S/{c.totalGenerado.toFixed(2)} · Tu comisión pendiente: S/
                  {c.comisionTotal.toFixed(2)}
                </p>
              </div>
              {c.comisionTotal > 0 ? (
                <button
                  onClick={() => marcarLiquidado(c.id, c.comisionTotal)}
                  className="text-sm bg-salvia-600 text-white px-3 py-1.5 rounded-lg hover:bg-salvia-800 transition-colors"
                >
                  Marcar como pagado
                </button>
              ) : (
                <span className="text-sm text-salvia-600">Al día</span>
              )}
            </motion.div>
          ))}
          {resumen.length === 0 && (
            <p className="text-center text-tinta/50 py-10 text-sm">
              Todavía no hay pagos validados registrados.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
