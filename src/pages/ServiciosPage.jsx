import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { subirImagenServicio, quitarImagenServicio, validarImagenServicio } from '../lib/storageServicio'

export default function ServiciosPage() {
  const navigate = useNavigate()
  const [consultorioId, setConsultorioId] = useState(null)
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      const { data: sesion } = await supabase.auth.getSession()
      if (!sesion.session) {
        navigate('/login')
        return
      }
      const { data: c } = await supabase
        .from('consultorios')
        .select('id')
        .eq('auth_user_id', sesion.session.user.id)
        .single()
      if (!c) {
        setCargando(false)
        return
      }
      setConsultorioId(c.id)

      const { data: s } = await supabase
        .from('servicios')
        .select('*')
        .eq('consultorio_id', c.id)
        .order('created_at')
      setServicios(s || [])
      setCargando(false)
    }
    cargar()
  }, [])

  async function agregarServicio(datos) {
    setError('')
    const { data, error: errorInsert } = await supabase
      .from('servicios')
      .insert({ consultorio_id: consultorioId, ...datos, activo: true })
      .select()
      .single()
    if (errorInsert) {
      setError('No se pudo guardar el servicio. Intenta de nuevo.')
      return false
    }
    setServicios((prev) => [...prev, data])
    setMostrarFormulario(false)
    return true
  }

  async function editarServicio(id, datos) {
    setError('')
    const { error: errorUpdate } = await supabase.from('servicios').update(datos).eq('id', id)
    if (errorUpdate) {
      setError('No se pudo guardar el cambio. Intenta de nuevo.')
      return false
    }
    setServicios((prev) => prev.map((s) => (s.id === id ? { ...s, ...datos } : s)))
    setEditandoId(null)
    return true
  }

  async function alternarActivo(servicio) {
    const nuevoValor = !servicio.activo
    setServicios((prev) => prev.map((s) => (s.id === servicio.id ? { ...s, activo: nuevoValor } : s)))
    await supabase.from('servicios').update({ activo: nuevoValor }).eq('id', servicio.id)
  }

  function actualizarImagenes(servicioId, imagenes) {
    setServicios((prev) => prev.map((s) => (s.id === servicioId ? { ...s, imagenes } : s)))
  }

  if (cargando) return <div className="p-8 font-sans text-tinta/60">Cargando…</div>

  return (
    <div className="min-h-screen bg-sillar-50 font-sans">
      <div className="max-w-lg mx-auto px-6 py-8">
        <button onClick={() => navigate('/panel')} className="text-sm text-tinta/50 mb-4 hover:text-tinta/80">
          ← Volver al panel
        </button>

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-display font-medium">Tus servicios</h1>
          {!mostrarFormulario && (
            <button
              onClick={() => setMostrarFormulario(true)}
              className="text-sm bg-salvia-600 text-white px-3 py-1.5 rounded-lg"
            >
              + Agregar
            </button>
          )}
        </div>
        <p className="text-sm text-tinta/60 mb-5">
          Los servicios desactivados no aparecen en tu página de reservas, pero se conservan por
          si los vuelves a usar.
        </p>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <AnimatePresence>
          {mostrarFormulario && (
            <FormularioServicio
              onGuardar={agregarServicio}
              onCancelar={() => setMostrarFormulario(false)}
            />
          )}
        </AnimatePresence>

        <div className="space-y-2 mt-3">
          <AnimatePresence>
            {servicios.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`bg-white border rounded-xl p-4 ${
                  s.activo ? 'border-sillar-200' : 'border-sillar-200 opacity-50'
                }`}
              >
                {editandoId === s.id ? (
                  <FormularioServicio
                    valoresIniciales={s}
                    onGuardar={(datos) => editarServicio(s.id, datos)}
                    onCancelar={() => setEditandoId(null)}
                  />
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{s.nombre}</p>
                        <p className="text-sm text-tinta/60">
                          {s.duracion_min} min · S/{Number(s.precio).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setEditandoId(s.id)}
                          className="text-sm text-tinta/50 hover:text-salvia-700"
                        >
                          Editar
                        </button>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={s.activo}
                            onChange={() => alternarActivo(s)}
                            className="w-4 h-4"
                          />
                          <span className="text-xs text-tinta/50">{s.activo ? 'Activo' : 'Inactivo'}</span>
                        </label>
                      </div>
                    </div>
                    <GaleriaServicio
                      servicio={s}
                      consultorioId={consultorioId}
                      onActualizar={(imagenes) => actualizarImagenes(s.id, imagenes)}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {servicios.length === 0 && !mostrarFormulario && (
            <p className="text-center text-tinta/50 py-10 text-sm">
              Todavía no tienes servicios. Agrega el primero.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function FormularioServicio({ valoresIniciales, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(valoresIniciales?.nombre || '')
  const [duracion, setDuracion] = useState(valoresIniciales?.duracion_min || 30)
  const [precio, setPrecio] = useState(valoresIniciales?.precio || '')
  const [guardando, setGuardando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setGuardando(true)
    await onGuardar({ nombre, duracion_min: Number(duracion), precio: Number(precio) })
    setGuardando(false)
  }

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={enviar}
      className={valoresIniciales ? 'space-y-3' : 'bg-white border border-sillar-200 rounded-xl p-4 space-y-3 mb-3'}
    >
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        required
        placeholder="Nombre del servicio"
        className="w-full px-3 py-2.5 rounded-lg border border-sillar-200 text-sm"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-tinta/50 block mb-1">Duración (min)</label>
          <input
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
            type="number"
            min={5}
            required
            className="w-full px-3 py-2.5 rounded-lg border border-sillar-200 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-tinta/50 block mb-1">Precio (S/)</label>
          <input
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            type="number"
            min={0}
            step="0.01"
            required
            className="w-full px-3 py-2.5 rounded-lg border border-sillar-200 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          disabled={guardando}
          className="flex-1 py-2.5 rounded-lg bg-salvia-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="flex-1 py-2.5 rounded-lg border border-sillar-200 text-sm"
        >
          Cancelar
        </button>
      </div>
    </motion.form>
  )
}

function GaleriaServicio({ servicio, consultorioId, onActualizar }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const imagenes = servicio.imagenes || []

  async function manejarArchivo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError('')
    const mensajeError = validarImagenServicio(file)
    if (mensajeError) {
      setError(mensajeError)
      return
    }

    setSubiendo(true)
    try {
      const nuevas = await subirImagenServicio({
        file,
        consultorioId,
        servicioId: servicio.id,
        imagenesActuales: imagenes,
      })
      onActualizar(nuevas)
    } catch (e) {
      setError(e.message || 'No se pudo subir la foto.')
    }
    setSubiendo(false)
  }

  async function quitar(url) {
    const nuevas = await quitarImagenServicio({ servicioId: servicio.id, imagenesActuales: imagenes, url })
    onActualizar(nuevas)
  }

  return (
    <div className="mt-3 pt-3 border-t border-sillar-100">
      <p className="text-xs text-tinta/50 mb-2">
        Fotos referenciales del tratamiento ({imagenes.length}/6)
      </p>
      <div className="flex gap-2 flex-wrap">
        {imagenes.map((url) => (
          <div key={url} className="relative group">
            <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-sillar-200" />
            <button
              onClick={() => quitar(url)}
              aria-label="Quitar foto"
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-tinta text-white text-xs flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        ))}
        {imagenes.length < 6 && (
          <label className="w-14 h-14 rounded-lg border border-dashed border-sillar-200 flex items-center justify-center text-tinta/40 text-xl cursor-pointer hover:border-salvia-600 hover:text-salvia-600 transition-colors">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={manejarArchivo}
              disabled={subiendo}
            />
            {subiendo ? '…' : '+'}
          </label>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  )
}
