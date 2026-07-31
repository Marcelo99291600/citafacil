import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { generarSlug } from '../lib/slug'

const PASOS = ['cuenta', 'consultorio', 'servicio', 'listo']
const COLORES = ['#0F6E56', '#B0651C', '#264A2C', '#3C3489', '#993C1D']

export default function RegistroPage() {
  const navigate = useNavigate()
  const [pasoIndex, setPasoIndex] = useState(0)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userId, setUserId] = useState(null)

  const [nombre, setNombre] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTocadoManualmente, setSlugTocadoManualmente] = useState(false)
  const [slugDisponible, setSlugDisponible] = useState(null)
  const [telefono, setTelefono] = useState('')
  const [color, setColor] = useState(COLORES[0])
  const [consultorioId, setConsultorioId] = useState(null)

  const [servicioNombre, setServicioNombre] = useState('')
  const [duracion, setDuracion] = useState(30)
  const [precio, setPrecio] = useState('')

  const paso = PASOS[pasoIndex]

  // Autogenera el slug a partir del nombre, salvo que el usuario lo haya editado a mano
  useEffect(() => {
    if (!slugTocadoManualmente) setSlug(generarSlug(nombre))
  }, [nombre])

  // Revisa disponibilidad del slug con un pequeño debounce
  useEffect(() => {
    if (!slug) {
      setSlugDisponible(null)
      return
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('consultorios').select('id').eq('slug', slug).maybeSingle()
      setSlugDisponible(!data)
    }, 400)
    return () => clearTimeout(t)
  }, [slug])

  async function crearCuenta(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { data, error: errorAuth } = await supabase.auth.signUp({ email, password })
    setCargando(false)

    if (errorAuth) {
      setError(errorAuth.message.includes('already registered') ? 'Ese correo ya tiene una cuenta.' : 'No se pudo crear la cuenta.')
      return
    }
    if (!data.session) {
      setError('Revisa tu correo para confirmar tu cuenta antes de continuar.')
      return
    }
    setUserId(data.user.id)
    setPasoIndex(1)
  }

  async function crearConsultorio(e) {
    e.preventDefault()
    setError('')
    if (!slugDisponible) {
      setError('Elige una dirección web disponible para continuar.')
      return
    }
    setCargando(true)
    const { data, error: errorInsert } = await supabase
      .from('consultorios')
      .insert({
        auth_user_id: userId,
        slug,
        nombre,
        especialidad,
        telefono_whatsapp: telefono,
        color_acento: color,
      })
      .select()
      .single()
    setCargando(false)

    if (errorInsert) {
      setError('No se pudo crear el consultorio. Intenta de nuevo.')
      return
    }
    setConsultorioId(data.id)
    setPasoIndex(2)
  }

  async function crearServicio(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { error: errorInsert } = await supabase.from('servicios').insert({
      consultorio_id: consultorioId,
      nombre: servicioNombre,
      duracion_min: Number(duracion),
      precio: Number(precio),
    })
    setCargando(false)

    if (errorInsert) {
      setError('No se pudo guardar el servicio. Intenta de nuevo.')
      return
    }
    setPasoIndex(3)
  }

  return (
    <div className="min-h-screen bg-sillar-50 font-sans">
      <div className="max-w-md mx-auto px-6 py-10">
        <h1 className="text-xl font-display font-medium mb-1">Crea tu consultorio</h1>
        <p className="text-sm text-tinta/60 mb-6">
          En unos minutos tendrás tu propia página de reservas.
        </p>

        <BarraProgreso pasoIndex={pasoIndex} total={PASOS.length - 1} />

        <AnimatePresence mode="wait">
          {paso === 'cuenta' && (
            <PasoAnimado key="cuenta">
              <form onSubmit={crearCuenta} className="space-y-3">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="Correo"
                  className="w-full px-4 py-3 rounded-lg border border-sillar-200 bg-white"
                />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                  minLength={6}
                  placeholder="Contraseña (mínimo 6 caracteres)"
                  className="w-full px-4 py-3 rounded-lg border border-sillar-200 bg-white"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  disabled={cargando}
                  className="w-full py-3 rounded-lg bg-salvia-600 text-white font-medium disabled:opacity-50"
                >
                  {cargando ? 'Creando…' : 'Continuar'}
                </button>
                <p className="text-sm text-tinta/50 text-center">
                  ¿Ya tienes cuenta? <Link to="/login" className="text-salvia-700 underline">Ingresa aquí</Link>
                </p>
              </form>
            </PasoAnimado>
          )}

          {paso === 'consultorio' && (
            <PasoAnimado key="consultorio">
              <form onSubmit={crearConsultorio} className="space-y-3">
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  placeholder="Nombre del consultorio"
                  className="w-full px-4 py-3 rounded-lg border border-sillar-200 bg-white"
                />
                <input
                  value={especialidad}
                  onChange={(e) => setEspecialidad(e.target.value)}
                  required
                  placeholder="Especialidad (ej. Odontología general)"
                  className="w-full px-4 py-3 rounded-lg border border-sillar-200 bg-white"
                />
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  required
                  placeholder="WhatsApp del consultorio (ej. 987654321)"
                  className="w-full px-4 py-3 rounded-lg border border-sillar-200 bg-white"
                />

                <div>
                  <label className="text-sm text-tinta/60 block mb-1.5">Tu página de reservas</label>
                  <div className="flex items-center gap-0 rounded-lg border border-sillar-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-salvia-400">
                    <span className="pl-3 text-sm text-tinta/40 font-mono">citafacil.app/</span>
                    <input
                      value={slug}
                      onChange={(e) => {
                        setSlugTocadoManualmente(true)
                        setSlug(generarSlug(e.target.value))
                      }}
                      required
                      className="flex-1 py-3 pr-3 font-mono text-sm outline-none"
                    />
                  </div>
                  {slug && slugDisponible === true && (
                    <p className="text-xs text-salvia-700 mt-1">Disponible</p>
                  )}
                  {slug && slugDisponible === false && (
                    <p className="text-xs text-red-600 mt-1">Esa dirección ya está en uso, prueba otra</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-tinta/60 block mb-1.5">Color de tu página</label>
                  <div className="flex gap-2">
                    {COLORES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          color === c ? 'ring-2 ring-offset-2 ring-tinta/40 scale-110' : ''
                        }`}
                        aria-label={`Elegir color ${c}`}
                      />
                    ))}
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  disabled={cargando}
                  className="w-full py-3 rounded-lg bg-salvia-600 text-white font-medium disabled:opacity-50"
                >
                  {cargando ? 'Guardando…' : 'Continuar'}
                </button>
              </form>
            </PasoAnimado>
          )}

          {paso === 'servicio' && (
            <PasoAnimado key="servicio">
              <p className="text-sm text-tinta/60 mb-3">
                Agrega el primer servicio que ofreces — puedes agregar más después desde tu panel.
              </p>
              <form onSubmit={crearServicio} className="space-y-3">
                <input
                  value={servicioNombre}
                  onChange={(e) => setServicioNombre(e.target.value)}
                  required
                  placeholder="Nombre del servicio (ej. Consulta general)"
                  className="w-full px-4 py-3 rounded-lg border border-sillar-200 bg-white"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-tinta/60 block mb-1.5">Duración (min)</label>
                    <input
                      value={duracion}
                      onChange={(e) => setDuracion(e.target.value)}
                      type="number"
                      min={5}
                      required
                      className="w-full px-4 py-3 rounded-lg border border-sillar-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-tinta/60 block mb-1.5">Precio (S/)</label>
                    <input
                      value={precio}
                      onChange={(e) => setPrecio(e.target.value)}
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-sillar-200 bg-white"
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  disabled={cargando}
                  className="w-full py-3 rounded-lg bg-salvia-600 text-white font-medium disabled:opacity-50"
                >
                  {cargando ? 'Guardando…' : 'Terminar registro'}
                </button>
              </form>
            </PasoAnimado>
          )}

          {paso === 'listo' && (
            <motion.div
              key="listo"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              className="text-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
                className="w-16 h-16 rounded-full bg-salvia-400/20 flex items-center justify-center mx-auto mb-4"
              >
                <span className="text-3xl">✓</span>
              </motion.div>
              <h2 className="text-xl font-display font-medium mb-2">Tu consultorio ya existe</h2>
              <p className="text-sm text-tinta/60 mb-1">Tu página de reservas es:</p>
              <p className="font-mono text-sm mb-5">citafacil.app/{slug}</p>
              <p className="text-sm text-tierra-600 bg-tierra-400/10 border border-tierra-400/30 rounded-lg px-4 py-3 mb-5 text-left">
                Últimos pasos: conecta tu cuenta de Culqi y define tu horario de atención desde
                tu panel para que tus pacientes puedan reservar y pagar.
              </p>
              <button
                onClick={() => navigate('/panel')}
                className="w-full py-3 rounded-lg bg-salvia-600 text-white font-medium"
              >
                Ir a mi panel
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function BarraProgreso({ pasoIndex, total }) {
  return (
    <div className="h-1 bg-sillar-200 rounded-full mb-6 overflow-hidden">
      <motion.div
        className="h-full bg-salvia-600"
        animate={{ width: `${(pasoIndex / total) * 100}%` }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
    </div>
  )
}

function PasoAnimado({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
