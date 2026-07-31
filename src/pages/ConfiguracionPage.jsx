import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function ConfiguracionPage() {
  const navigate = useNavigate()
  const [consultorio, setConsultorio] = useState(null)
  const [publicKey, setPublicKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [mostrarSecreta, setMostrarSecreta] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const { data: sesion } = await supabase.auth.getSession()
      if (!sesion.session) {
        navigate('/login')
        return
      }
      const { data: c } = await supabase
        .from('consultorios')
        .select('*')
        .eq('auth_user_id', sesion.session.user.id)
        .single()
      setConsultorio(c)
      setPublicKey(c?.culqi_public_key || '')
      setSecretKey(c?.culqi_secret_key || '')
      setCargando(false)
    }
    cargar()
  }, [])

  function validar() {
    if (!publicKey.trim() || !secretKey.trim()) {
      return 'Completa ambas llaves antes de guardar.'
    }
    if (!publicKey.startsWith('pk_')) {
      return 'La llave pública debe empezar con "pk_test_" o "pk_live_".'
    }
    if (!secretKey.startsWith('sk_')) {
      return 'La llave secreta debe empezar con "sk_test_" o "sk_live_".'
    }
    return ''
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setGuardado(false)

    const mensajeError = validar()
    if (mensajeError) {
      setError(mensajeError)
      return
    }

    setGuardando(true)
    const { error: errorGuardado } = await supabase
      .from('consultorios')
      .update({ culqi_public_key: publicKey.trim(), culqi_secret_key: secretKey.trim() })
      .eq('id', consultorio.id)
    setGuardando(false)

    if (errorGuardado) {
      setError('No se pudo guardar. Intenta de nuevo.')
      return
    }
    setGuardado(true)
  }

  if (cargando) return <div className="p-8 font-sans text-tinta/60">Cargando…</div>

  const modo = publicKey.startsWith('pk_live_') ? 'real' : publicKey.startsWith('pk_test_') ? 'prueba' : null

  return (
    <div className="min-h-screen bg-sillar-50 font-sans">
      <div className="max-w-lg mx-auto px-6 py-8">
        <button onClick={() => navigate('/panel')} className="text-sm text-tinta/50 mb-4 hover:text-tinta/80">
          ← Volver al panel
        </button>

        <h1 className="text-xl font-display font-medium mb-1">Cuenta de cobro</h1>
        <p className="text-sm text-tinta/60 mb-6">
          Conecta tu propia cuenta de Culqi para que los pagos de tus pacientes lleguen
          directamente a tu cuenta bancaria.
        </p>

        {!consultorio?.culqi_public_key && (
          <div className="bg-tierra-400/10 border border-tierra-400/30 rounded-xl p-4 mb-5 text-sm text-tierra-600">
            Todavía no has conectado tu cuenta de cobro. Tus pacientes no podrán pagar sus citas
            hasta que completes este paso.
          </div>
        )}

        <div className="bg-white border border-sillar-200 rounded-xl p-5 mb-5 text-sm text-tinta/70 space-y-2">
          <p className="font-medium text-tinta">¿Cómo consigo mis llaves?</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Crea una cuenta en culqi.com con tu RUC o DNI</li>
            <li>Entra a tu panel de Culqi → Llaves API</li>
            <li>Copia la llave pública y la llave secreta, y pégalas aquí abajo</li>
          </ol>
        </div>

        <form onSubmit={guardar} className="bg-white border border-sillar-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="text-sm text-tinta/70 block mb-1.5">Llave pública</label>
            <input
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="pk_test_xxxxxxxxxxxxxxxx"
              className="w-full px-4 py-3 rounded-lg border border-sillar-200 font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-tinta/70 block mb-1.5">Llave secreta</label>
            <div className="relative">
              <input
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                type={mostrarSecreta ? 'text' : 'password'}
                placeholder="sk_test_xxxxxxxxxxxxxxxx"
                className="w-full px-4 py-3 rounded-lg border border-sillar-200 font-mono text-sm pr-16"
              />
              <button
                type="button"
                onClick={() => setMostrarSecreta((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tinta/50 hover:text-tinta/80"
              >
                {mostrarSecreta ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p className="text-xs text-tinta/40 mt-1.5">
              Nunca compartimos esta llave. Solo se usa desde nuestro servidor para procesar tus cobros.
            </p>
          </div>

          {modo && (
            <div
              className={`text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                modo === 'real' ? 'bg-salvia-400/15 text-salvia-800' : 'bg-tierra-400/15 text-tierra-600'
              }`}
            >
              {modo === 'real' ? '● Modo real — se cobrará dinero de verdad' : '● Modo prueba — no se cobra dinero real'}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            disabled={guardando}
            className="w-full py-3 rounded-lg bg-salvia-600 text-white font-medium disabled:opacity-50 transition-opacity"
          >
            {guardando ? 'Guardando…' : 'Guardar cuenta de cobro'}
          </button>
        </form>

        <AnimatePresence>
          {guardado && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 flex items-center gap-2 text-sm text-salvia-700 bg-salvia-400/10 border border-salvia-400/25 rounded-lg px-4 py-3"
            >
              <span>✓</span>
              <span>Cuenta de cobro guardada. Ya puedes recibir pagos en tu página de reservas.</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
