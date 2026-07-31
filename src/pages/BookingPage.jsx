import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabase } from '../lib/supabase'

const PASOS = ['servicio', 'horario', 'datos', 'pago', 'listo']

export default function BookingPage() {
  const { slug } = useParams()
  const reducirMovimiento = useReducedMotion()
  const [consultorio, setConsultorio] = useState(null)
  const [servicios, setServicios] = useState([])
  const [pasoIndex, setPasoIndex] = useState(0)
  const [servicio, setServicio] = useState(null)
  const [fecha, setFecha] = useState(proximosDias()[0])
  const [horariosDisponibles, setHorariosDisponibles] = useState([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [hora, setHora] = useState(null)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [procesandoPago, setProcesandoPago] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      const { data: c } = await supabase.from('consultorios_publicos').select('*').eq('slug', slug).single()
      setConsultorio(c)
      if (c) {
        const { data: s } = await supabase
          .from('servicios')
          .select('*')
          .eq('consultorio_id', c.id)
          .eq('activo', true)
        setServicios(s || [])
      }
    }
    cargar()
  }, [slug])

  useEffect(() => {
    if (!consultorio || !servicio || !fecha) return
    let cancelado = false
    setCargandoHorarios(true)
    supabase
      .rpc('horarios_disponibles', {
        p_consultorio_id: consultorio.id,
        p_servicio_id: servicio.id,
        p_fecha: fecha,
      })
      .then(({ data, error: errorRpc }) => {
        if (cancelado) return
        setHorariosDisponibles(errorRpc ? [] : (data || []).map((r) => r.hora.slice(0, 5)))
        setCargandoHorarios(false)
      })
    return () => {
      cancelado = true
    }
  }, [consultorio, servicio, fecha])

  const paso = PASOS[pasoIndex]

  function irA(pasoNombre) {
    setPasoIndex(PASOS.indexOf(pasoNombre))
  }

  async function confirmarYPagar() {
    setError('')
    if (!consultorio.culqi_public_key) {
      setError('Este consultorio todavía no activó los pagos en línea. Contáctalo directamente para agendar.')
      return
    }
    if (!window.Culqi) {
      setError('No se pudo cargar la pasarela de pago. Intenta de nuevo.')
      return
    }
    window.Culqi.publicKey = consultorio.culqi_public_key
    window.Culqi.settings({
      title: consultorio.nombre,
      currency: 'PEN',
      amount: Math.round(servicio.precio * 100),
    })
    window.Culqi.open()
  }

  useEffect(() => {
    window.culqi = async function () {
      if (window.Culqi.token) {
        setProcesandoPago(true)
        try {
          const res = await fetch('/api/reservar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: window.Culqi.token.id,
              consultorioId: consultorio.id,
              servicioId: servicio.id,
              nombre,
              telefono,
              fecha,
              hora,
              monto: servicio.precio,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'No se pudo procesar el pago')
          irA('listo')
        } catch (e) {
          setError(e.message)
        } finally {
          setProcesandoPago(false)
        }
      } else if (window.Culqi.error) {
        setError(window.Culqi.error.user_message || 'El pago no pudo procesarse')
      }
    }
  }, [consultorio, servicio, nombre, telefono, fecha, hora])

  if (!consultorio) {
    return (
      <div className="min-h-screen flex items-center justify-center text-tinta/60 font-sans bg-sillar-50">
        Cargando consultorio…
      </div>
    )
  }

  return (
    <div className="min-h-screen font-sans relative">
      <FondoAmbiente imagenFondo={consultorio.imagen_fondo} colorAcento={consultorio.color_acento} />

      <div className="relative max-w-md mx-auto pb-14">
        <Portada consultorio={consultorio} reducirMovimiento={reducirMovimiento} />

        <div className="bg-white rounded-2xl mt-5 relative px-5 py-6 shadow-[0_4px_24px_rgba(31,42,46,0.07)] border border-sillar-100">
          <BarraProgreso pasoIndex={pasoIndex} total={PASOS.length - 1} colorAcento={consultorio.color_acento} />

          <AnimatePresence mode="wait">
            {paso === 'servicio' && (
              <PasoAnimado key="servicio" reducirMovimiento={reducirMovimiento}>
                <h2 className="text-lg font-display font-medium mb-4">Elige un servicio</h2>
                <motion.div
                  className="grid grid-cols-1 gap-3"
                  initial="oculto"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                >
                  {servicios.map((s) => (
                    <motion.button
                      key={s.id}
                      variants={itemVariants}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setServicio(s)
                        irA('horario')
                      }}
                      className="text-left border border-sillar-200 rounded-xl p-4 bg-white hover:border-salvia-600 hover:shadow-md transition-all duration-200 flex items-center gap-3"
                    >
                      {s.imagenes?.[0] && (
                        <img
                          src={s.imagenes[0]}
                          alt=""
                          className="w-14 h-14 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{s.nombre}</p>
                        <p className="text-sm text-tinta/60 mt-1">
                          {s.duracion_min} min · S/{s.precio}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                  {servicios.length === 0 && (
                    <p className="text-sm text-tinta/50 py-6 text-center">
                      Este consultorio todavía no publicó sus servicios.
                    </p>
                  )}
                </motion.div>
              </PasoAnimado>
            )}

            {paso === 'horario' && (
              <PasoAnimado key="horario" reducirMovimiento={reducirMovimiento}>
                <BotonVolver onClick={() => irA('servicio')} />
                <h2 className="text-lg font-display font-medium mb-1">Elige un horario</h2>
                <p className="text-sm text-tinta/60 mb-4">{servicio?.nombre}</p>

                {servicio?.imagenes?.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto mb-4 -mx-1 px-1">
                    {servicio.imagenes.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="w-24 h-24 rounded-lg object-cover shrink-0 border border-sillar-200"
                      />
                    ))}
                  </div>
                )}

                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
                  {proximosDias().map((d) => (
                    <button
                      key={d}
                      onClick={() => setFecha(d)}
                      className={`shrink-0 px-3 py-2 rounded-lg text-sm font-mono transition-all ${
                        fecha === d
                          ? 'text-white shadow-sm'
                          : 'bg-white border border-sillar-200 hover:border-salvia-600'
                      }`}
                      style={fecha === d ? { backgroundColor: consultorio.color_acento } : undefined}
                    >
                      {formatoDiaCorto(d)}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 min-h-[3rem]">
                  {cargandoHorarios && (
                    <p className="col-span-3 text-sm text-tinta/50 py-4 text-center">Buscando horarios…</p>
                  )}
                  {!cargandoHorarios && horariosDisponibles.length === 0 && (
                    <p className="col-span-3 text-sm text-tinta/50 py-4 text-center">
                      No hay horarios disponibles este día. Prueba otra fecha.
                    </p>
                  )}
                  {!cargandoHorarios &&
                    horariosDisponibles.map((h) => (
                      <motion.button
                        key={h}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => {
                          setHora(h)
                          irA('datos')
                        }}
                        className="py-2.5 rounded-lg text-sm font-mono border border-sillar-200 bg-white hover:text-white transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = consultorio.color_acento)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                      >
                        {h}
                      </motion.button>
                    ))}
                </div>
              </PasoAnimado>
            )}

            {paso === 'datos' && (
              <PasoAnimado key="datos" reducirMovimiento={reducirMovimiento}>
                <BotonVolver onClick={() => irA('horario')} />
                <h2 className="text-lg font-display font-medium mb-4">Tus datos</h2>
                <div className="space-y-3">
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-4 py-3 rounded-lg border border-sillar-200 bg-white focus:outline-none focus:ring-2 transition-shadow"
                    style={{ '--tw-ring-color': consultorio.color_acento }}
                  />
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Celular (WhatsApp)"
                    className="w-full px-4 py-3 rounded-lg border border-sillar-200 bg-white focus:outline-none focus:ring-2 transition-shadow"
                    style={{ '--tw-ring-color': consultorio.color_acento }}
                  />
                </div>
                <button
                  disabled={!nombre || !telefono}
                  onClick={() => irA('pago')}
                  className="w-full mt-5 py-3 rounded-lg text-white font-medium disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: consultorio.color_acento }}
                >
                  Continuar
                </button>
              </PasoAnimado>
            )}

            {paso === 'pago' && (
              <PasoAnimado key="pago" reducirMovimiento={reducirMovimiento}>
                <BotonVolver onClick={() => irA('datos')} />
                <h2 className="text-lg font-display font-medium mb-2">Confirma y paga</h2>
                <p className="text-sm text-tinta/60 mb-4">
                  El pago confirma tu cita al instante — así el horario queda reservado solo para ti.
                </p>
                <div className="bg-sillar-50 border border-sillar-200 rounded-xl p-4 mb-5 text-sm space-y-1">
                  <Fila label="Servicio" valor={servicio?.nombre} />
                  <Fila label="Fecha" valor={formatoDiaCorto(fecha)} />
                  <Fila label="Hora" valor={hora} />
                  <div className="border-t border-sillar-200 mt-2 pt-2 flex justify-between font-medium">
                    <span>Total</span>
                    <span>S/{servicio?.precio}</span>
                  </div>
                </div>
                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                {!consultorio.culqi_public_key ? (
                  <p className="text-sm text-tierra-600 bg-tierra-400/10 border border-tierra-400/30 rounded-lg px-4 py-3">
                    Este consultorio todavía no activó los pagos en línea. Contáctalo directamente
                    para agendar tu cita.
                  </p>
                ) : (
                  <button
                    onClick={confirmarYPagar}
                    disabled={procesandoPago}
                    className="w-full py-3 rounded-lg text-white font-medium disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: consultorio.color_acento }}
                  >
                    {procesandoPago ? 'Procesando…' : `Pagar S/${servicio?.precio}`}
                  </button>
                )}
              </PasoAnimado>
            )}

            {paso === 'listo' && (
              <motion.div
                key="listo"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                className="text-center py-10"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: `${consultorio.color_acento}22` }}
                >
                  <span className="text-3xl" style={{ color: consultorio.color_acento }}>✓</span>
                </motion.div>
                <h2 className="text-xl font-display font-medium mb-2">Cita confirmada</h2>
                <p className="text-sm text-tinta/60">
                  Te esperamos el {formatoDiaCorto(fecha)} a las {hora}.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function FondoAmbiente({ imagenFondo, colorAcento }) {
  return (
    <div className="fixed inset-0 -z-10 bg-sillar-50 overflow-hidden">
      {imagenFondo ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.22]"
            style={{ backgroundImage: `url(${imagenFondo})` }}
          />
          <div className="absolute inset-0 bg-sillar-50/35" />
        </>
      ) : (
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, ${colorAcento} 0px, ${colorAcento} 1px, transparent 1px, transparent 42px), repeating-linear-gradient(90deg, ${colorAcento} 0px, ${colorAcento} 1px, transparent 1px, transparent 84px)`,
          }}
        />
      )}
    </div>
  )
}

function Portada({ consultorio, reducirMovimiento }) {
  return (
    <div>
      <div
        className="h-44 sm:h-52 bg-cover bg-center relative rounded-b-2xl overflow-hidden"
        style={{
          backgroundColor: consultorio.color_acento,
          backgroundImage: consultorio.imagen_portada ? `url(${consultorio.imagen_portada})` : undefined,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />
      </div>

      <div className="px-5">
        <motion.div
          initial={reducirMovimiento ? false : { opacity: 0, scale: 0.85, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg -mt-10 relative bg-cover bg-center flex items-center justify-center text-white font-medium text-lg"
          style={{
            backgroundColor: consultorio.color_acento,
            backgroundImage: consultorio.logo_url ? `url(${consultorio.logo_url})` : undefined,
          }}
        >
          {!consultorio.logo_url && inicialesDe(consultorio.nombre)}
        </motion.div>

        <motion.div
          initial={reducirMovimiento ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mt-3"
        >
          <p className="font-display font-medium text-tinta text-xl leading-tight">
            {consultorio.nombre}
          </p>
          <p className="text-sm text-tinta/60 leading-tight mt-0.5">{consultorio.especialidad}</p>
          {consultorio.descripcion && (
            <p className="text-sm text-tinta/70 leading-snug mt-2">{consultorio.descripcion}</p>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function BarraProgreso({ pasoIndex, total, colorAcento }) {
  return (
    <div className="h-1 bg-sillar-200 rounded-full mb-6 overflow-hidden">
      <motion.div
        className="h-full"
        style={{ backgroundColor: colorAcento }}
        animate={{ width: `${(pasoIndex / total) * 100}%` }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
    </div>
  )
}

function PasoAnimado({ children, reducirMovimiento }) {
  return (
    <motion.div
      initial={reducirMovimiento ? { opacity: 0 } : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reducirMovimiento ? { opacity: 0 } : { opacity: 0, x: -16 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

function BotonVolver({ onClick }) {
  return (
    <button onClick={onClick} className="text-sm text-tinta/50 mb-3 hover:text-tinta/80">
      ← Volver
    </button>
  )
}

function Fila({ label, valor }) {
  return (
    <div className="flex justify-between text-tinta/70">
      <span>{label}</span>
      <span className="font-medium text-tinta">{valor}</span>
    </div>
  )
}

const itemVariants = {
  oculto: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
}

function proximosDias() {
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function formatoDiaCorto(fechaISO) {
  return new Date(`${fechaISO}T00:00:00`).toLocaleDateString('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function inicialesDe(nombre) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}
