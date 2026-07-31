import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { subirImagenMarca, validarImagen } from '../lib/storageMarca'

const COLORES = ['#0F6E56', '#B0651C', '#264A2C', '#3C3489', '#993C1D']

export default function AparienciaPage() {
  const navigate = useNavigate()
  const [consultorio, setConsultorio] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(null) // 'perfil' | 'portada' | 'fondo' | null
  const [error, setError] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [guardandoDescripcion, setGuardandoDescripcion] = useState(false)
  const [descripcionGuardada, setDescripcionGuardada] = useState(false)

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
      setDescripcion(c?.descripcion || '')
      setCargando(false)
    }
    cargar()
  }, [])

  async function manejarArchivo(tipo, file) {
    setError('')
    const mensajeError = validarImagen(file)
    if (mensajeError) {
      setError(mensajeError)
      return
    }
    setSubiendo(tipo)
    try {
      const url = await subirImagenMarca({ file, consultorioId: consultorio.id, tipo })
      const columna = { perfil: 'logo_url', portada: 'imagen_portada', fondo: 'imagen_fondo' }[tipo]
      setConsultorio((prev) => ({ ...prev, [columna]: url }))
    } catch {
      setError('No se pudo subir la imagen. Intenta de nuevo.')
    }
    setSubiendo(null)
  }

  async function cambiarColor(color) {
    setConsultorio((prev) => ({ ...prev, color_acento: color }))
    await supabase.from('consultorios').update({ color_acento: color }).eq('id', consultorio.id)
  }

  async function guardarDescripcion() {
    setGuardandoDescripcion(true)
    setDescripcionGuardada(false)
    const { error: errorUpdate } = await supabase
      .from('consultorios')
      .update({ descripcion })
      .eq('id', consultorio.id)
    setGuardandoDescripcion(false)
    if (!errorUpdate) setDescripcionGuardada(true)
  }

  if (cargando) return <div className="p-8 font-sans text-tinta/60">Cargando…</div>

  return (
    <div className="min-h-screen bg-sillar-50 font-sans">
      <div className="max-w-lg mx-auto px-6 py-8">
        <button onClick={() => navigate('/panel')} className="text-sm text-tinta/50 mb-4 hover:text-tinta/80">
          ← Volver al panel
        </button>

        <h1 className="text-xl font-display font-medium mb-1">Apariencia</h1>
        <p className="text-sm text-tinta/60 mb-6">
          Así se verá tu página de reservas. Los cambios se guardan al subir cada imagen.
        </p>

        {/* Vista previa en vivo */}
        <VistaPrevia consultorio={consultorio} />

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        <div className="space-y-3 mt-6">
          <ZonaSubida
            etiqueta="Foto de perfil"
            ayuda="Tu logo o una foto tuya — aparece como círculo sobre la portada"
            subiendo={subiendo === 'perfil'}
            onArchivo={(f) => manejarArchivo('perfil', f)}
          />
          <ZonaSubida
            etiqueta="Foto de portada"
            ayuda="La imagen principal en la parte superior de tu página (ideal: horizontal, buena luz)"
            subiendo={subiendo === 'portada'}
            onArchivo={(f) => manejarArchivo('portada', f)}
          />
          <ZonaSubida
            etiqueta="Imagen de fondo"
            ayuda="Textura o imagen sutil detrás de todo el contenido (opcional)"
            subiendo={subiendo === 'fondo'}
            onArchivo={(f) => manejarArchivo('fondo', f)}
          />
        </div>

        <div className="mt-6">
          <p className="text-sm text-tinta/70 mb-1">Descripción para tus pacientes</p>
          <p className="text-xs text-tinta/50 mb-2">
            Cuéntales quién eres, tu experiencia o tu enfoque — aparece en tu página de reservas.
          </p>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={400}
            rows={4}
            placeholder="Ej: Soy el Dr. Marcelo Ramos, odontólogo con 10 años de experiencia especializado en..."
            className="w-full px-3 py-2.5 rounded-lg border border-sillar-200 text-sm resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-tinta/40">{descripcion.length}/400</span>
            <button
              onClick={guardarDescripcion}
              disabled={guardandoDescripcion}
              className="text-sm bg-salvia-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {guardandoDescripcion ? 'Guardando…' : 'Guardar descripción'}
            </button>
          </div>
          <AnimatePresence>
            {descripcionGuardada && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-salvia-700 mt-1.5"
              >
                ✓ Descripción guardada
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6">
          <p className="text-sm text-tinta/70 mb-2">Color de acento</p>
          <div className="flex gap-2">
            {COLORES.map((c) => (
              <button
                key={c}
                onClick={() => cambiarColor(c)}
                style={{ backgroundColor: c }}
                className={`w-9 h-9 rounded-full transition-transform ${
                  consultorio.color_acento === c ? 'ring-2 ring-offset-2 ring-tinta/40 scale-110' : ''
                }`}
                aria-label={`Elegir color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ZonaSubida({ etiqueta, ayuda, subiendo, onArchivo }) {
  const inputRef = useRef(null)
  const [arrastrando, setArrastrando] = useState(false)

  function manejarDrop(e) {
    e.preventDefault()
    setArrastrando(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onArchivo(file)
  }

  return (
    <div>
      <p className="text-sm font-medium mb-0.5">{etiqueta}</p>
      <p className="text-xs text-tinta/50 mb-2">{ayuda}</p>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={manejarDrop}
        className={`flex items-center justify-center gap-2 text-sm border border-dashed rounded-lg py-4 cursor-pointer transition-colors ${
          arrastrando ? 'border-salvia-600 bg-salvia-400/10' : 'border-sillar-200 hover:border-salvia-600'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onArchivo(e.target.files[0])}
        />
        <span className="text-tinta/60">
          {subiendo ? 'Subiendo…' : 'Arrastra una imagen o haz clic para elegir'}
        </span>
      </div>
    </div>
  )
}

function VistaPrevia({ consultorio }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-sillar-200 bg-white">
      <div
        className="h-32 relative bg-cover bg-center"
        style={{
          backgroundColor: consultorio.color_acento,
          backgroundImage: consultorio.imagen_portada ? `url(${consultorio.imagen_portada})` : undefined,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>
      <div className="px-4 pb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={consultorio.logo_url || 'sin-foto'}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-16 h-16 rounded-full border-4 border-white -mt-8 relative bg-cover bg-center flex items-center justify-center text-white font-medium"
            style={{
              backgroundColor: consultorio.color_acento,
              backgroundImage: consultorio.logo_url ? `url(${consultorio.logo_url})` : undefined,
            }}
          >
            {!consultorio.logo_url && inicialesDe(consultorio.nombre)}
          </motion.div>
        </AnimatePresence>
        <p className="font-display font-medium mt-2">{consultorio.nombre}</p>
        <p className="text-sm text-tinta/60">{consultorio.especialidad}</p>
      </div>
    </div>
  )
}

function inicialesDe(nombre) {
  return (nombre || '')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}
