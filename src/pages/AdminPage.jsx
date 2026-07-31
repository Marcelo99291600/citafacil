import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

const CLAVE_SESION = 'citafacil_admin_pin_ok'

export default function AdminPage() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState('cargando') // cargando | sin-acceso | configurar-pin | pedir-pin | concedido
  const [token, setToken] = useState(null)
  const [resumen, setResumen] = useState([])
  const [expandidoId, setExpandidoId] = useState(null)

  useEffect(() => {
    async function verificarAcceso() {
      const { data: sesion } = await supabase.auth.getSession()
      if (!sesion.session) {
        navigate('/login')
        return
      }
      setToken(sesion.session.access_token)

      const { data: admin } = await supabase
        .from('administradores')
        .select('pin_configurado')
        .eq('auth_user_id', sesion.session.user.id)
        .maybeSingle()

      if (!admin) {
        setEstado('sin-acceso')
        return
      }

      if (!admin.pin_configurado) {
        setEstado('configurar-pin')
        return
      }

      if (sessionStorage.getItem(CLAVE_SESION) === '1') {
        setEstado('concedido')
      } else {
        setEstado('pedir-pin')
      }
    }
    verificarAcceso()
  }, [])

  useEffect(() => {
    if (estado !== 'concedido') return
    async function cargarDatos() {
      const { data: pagos } = await supabase
        .from('pagos')
        .select(
          'id, monto, comision_monto, estado, created_at, consultorio_id, consultorios(nombre), citas(fecha, hora, servicios(nombre))',
        )
        .eq('estado', 'pagado')
        .order('created_at', { ascending: false })

      const { data: liquidaciones } = await supabase
        .from('liquidaciones')
        .select('*')
        .order('created_at', { ascending: false })

      const porConsultorio = {}
      for (const p of pagos || []) {
        const id = p.consultorio_id
        if (!porConsultorio[id]) {
          porConsultorio[id] = {
            id,
            nombre: p.consultorios?.nombre || 'Consultorio',
            totalGenerado: 0,
            comisionTotal: 0,
            transacciones: [],
            liquidaciones: [],
          }
        }
        porConsultorio[id].totalGenerado += p.monto
        porConsultorio[id].comisionTotal += p.comision_monto
        porConsultorio[id].transacciones.push(p)
      }
      for (const l of liquidaciones || []) {
        if (!porConsultorio[l.consultorio_id]) continue
        porConsultorio[l.consultorio_id].liquidaciones.push(l)
        if (l.estado === 'pagada') {
          porConsultorio[l.consultorio_id].comisionTotal -= l.comision_monto
        }
      }
      setResumen(Object.values(porConsultorio))
    }
    cargarDatos()
  }, [estado])

  async function marcarLiquidado(consultorioId, montoPendiente) {
    const { data } = await supabase
      .from('liquidaciones')
      .insert({
        consultorio_id: consultorioId,
        periodo_inicio: new Date().toISOString().slice(0, 10),
        periodo_fin: new Date().toISOString().slice(0, 10),
        monto_generado: montoPendiente,
        comision_monto: montoPendiente,
        estado: 'pagada',
        fecha_pago: new Date().toISOString(),
      })
      .select()
      .single()

    setResumen((prev) =>
      prev.map((c) =>
        c.id === consultorioId
          ? { ...c, comisionTotal: 0, liquidaciones: [data, ...c.liquidaciones] }
          : c,
      ),
    )
  }

  async function cerrarSesion() {
    sessionStorage.removeItem(CLAVE_SESION)
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (estado === 'cargando') return <div className="p-8 font-sans text-tinta/60">Cargando…</div>
  if (estado === 'sin-acceso')
    return <div className="p-8 font-sans text-tinta/60">No tienes acceso a este panel.</div>

  if (estado === 'configurar-pin') {
    return (
      <PantallaPin
        titulo="Configura tu PIN de acceso"
        ayuda="Este PIN se te pedirá cada vez que entres al panel de administrador desde un navegador nuevo. Solo tú lo conoces — ni siquiera queda guardado en texto plano."
        pideConfirmacion
        endpoint="/api/pin-configurar"
        token={token}
        onExito={() => {
          sessionStorage.setItem(CLAVE_SESION, '1')
          setEstado('concedido')
        }}
      />
    )
  }

  if (estado === 'pedir-pin') {
    return (
      <PantallaPin
        titulo="Ingresa tu PIN"
        ayuda="Por seguridad, pedimos tu PIN al abrir el panel de administrador en un nuevo navegador o sesión."
        endpoint="/api/pin-verificar"
        token={token}
        onExito={() => {
          sessionStorage.setItem(CLAVE_SESION, '1')
          setEstado('concedido')
        }}
        onSalir={cerrarSesion}
      />
    )
  }

  return (
    <div className="min-h-screen bg-sillar-50 font-sans">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-display font-medium">Panel de administrador</h1>
          <button onClick={cerrarSesion} className="text-sm text-tinta/40 hover:text-red-600 transition-colors">
            Salir
          </button>
        </div>
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
              className="bg-white border border-sillar-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandidoId(expandidoId === c.id ? null : c.id)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div>
                  <p className="font-medium">{c.nombre}</p>
                  <p className="text-sm text-tinta/60">
                    Generado: S/{c.totalGenerado.toFixed(2)} · {c.transacciones.length}{' '}
                    {c.transacciones.length === 1 ? 'transacción' : 'transacciones'} · Tu comisión
                    pendiente:{' '}
                    <span className={c.comisionTotal > 0 ? 'text-tierra-600 font-medium' : 'text-salvia-700'}>
                      S/{c.comisionTotal.toFixed(2)}
                    </span>
                  </p>
                </div>
                <span className="text-tinta/40 text-sm shrink-0 ml-3">
                  {expandidoId === c.id ? 'Ocultar ▲' : 'Ver detalle ▼'}
                </span>
              </button>

              <AnimatePresence>
                {expandidoId === c.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-sillar-200 px-4 py-3">
                      {c.comisionTotal > 0 && (
                        <button
                          onClick={() => marcarLiquidado(c.id, c.comisionTotal)}
                          className="text-sm bg-salvia-600 text-white px-3 py-1.5 rounded-lg mb-4"
                        >
                          Marcar S/{c.comisionTotal.toFixed(2)} como pagado
                        </button>
                      )}

                      <p className="text-xs font-medium text-tinta/50 uppercase tracking-wide mb-2">
                        Transacciones
                      </p>
                      <div className="space-y-1.5 mb-4">
                        {c.transacciones.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between text-sm border-b border-sillar-100 pb-1.5"
                          >
                            <div>
                              <p>{t.citas?.servicios?.nombre || 'Servicio'}</p>
                              <p className="text-xs text-tinta/50 font-mono">
                                {t.citas?.fecha} {t.citas?.hora?.slice(0, 5)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono">S/{Number(t.monto).toFixed(2)}</p>
                              <p className="text-xs text-tinta/50 font-mono">
                                comisión S/{Number(t.comision_monto).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs font-medium text-tinta/50 uppercase tracking-wide mb-2">
                        Historial de liquidaciones
                      </p>
                      {c.liquidaciones.length === 0 ? (
                        <p className="text-xs text-tinta/40">Todavía no registras pagos de comisión.</p>
                      ) : (
                        <div className="space-y-1">
                          {c.liquidaciones.map((l) => (
                            <div key={l.id} className="flex justify-between text-sm text-tinta/60">
                              <span>{new Date(l.fecha_pago).toLocaleDateString('es-PE')}</span>
                              <span className="font-mono">S/{Number(l.comision_monto).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

function PantallaPin({ titulo, ayuda, endpoint, token, onExito, pideConfirmacion, onSalir }) {
  const [pin, setPin] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function enviar(e) {
    e.preventDefault()
    setError('')

    if (!/^\d{4,6}$/.test(pin)) {
      setError('El PIN debe tener entre 4 y 6 dígitos.')
      return
    }
    if (pideConfirmacion && pin !== confirmacion) {
      setError('Los PIN no coinciden.')
      return
    }

    setEnviando(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo verificar el PIN.')
      onExito()
    } catch (e) {
      setError(e.message)
    }
    setEnviando(false)
  }

  return (
    <div className="min-h-screen bg-sillar-50 flex items-center justify-center px-6 font-sans">
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={enviar}
        className="bg-white border border-sillar-200 rounded-xl p-6 w-full max-w-sm"
      >
        <h1 className="text-lg font-display font-medium mb-1">{titulo}</h1>
        <p className="text-sm text-tinta/60 mb-5">{ayuda}</p>

        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          type="password"
          inputMode="numeric"
          placeholder="PIN (4 a 6 dígitos)"
          autoFocus
          className="w-full px-4 py-3 rounded-lg border border-sillar-200 mb-3 font-mono tracking-widest text-center"
        />
        {pideConfirmacion && (
          <input
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value.replace(/\D/g, '').slice(0, 6))}
            type="password"
            inputMode="numeric"
            placeholder="Confirma tu PIN"
            className="w-full px-4 py-3 rounded-lg border border-sillar-200 mb-3 font-mono tracking-widest text-center"
          />
        )}
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          disabled={enviando}
          className="w-full py-3 rounded-lg bg-salvia-600 text-white font-medium disabled:opacity-50"
        >
          {enviando ? 'Verificando…' : pideConfirmacion ? 'Guardar PIN' : 'Ingresar'}
        </button>
        {onSalir && (
          <button type="button" onClick={onSalir} className="w-full text-sm text-tinta/40 mt-3">
            Salir de esta cuenta
          </button>
        )}
      </motion.form>
    </div>
  )
}
