import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { linkRecordatorio } from '../lib/whatsapp'
import { subirAdjunto, urlFirmadaAdjunto, eliminarAdjunto, validarArchivo } from '../lib/storage'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [consultorio, setConsultorio] = useState(null)
  const [citas, setCitas] = useState([])
  const [citaSeleccionada, setCitaSeleccionada] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [tieneHorario, setTieneHorario] = useState(true)
  const [tieneServicios, setTieneServicios] = useState(true)
  const hoy = new Date().toISOString().slice(0, 10)

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

      if (c) {
        const { count } = await supabase
          .from('disponibilidad')
          .select('id', { count: 'exact', head: true })
          .eq('consultorio_id', c.id)
        setTieneHorario((count || 0) > 0)

        const { count: countServicios } = await supabase
          .from('servicios')
          .select('id', { count: 'exact', head: true })
          .eq('consultorio_id', c.id)
          .eq('activo', true)
        setTieneServicios((countServicios || 0) > 0)

        const { data: citasHoy } = await supabase
          .from('citas')
          .select('*, servicios(nombre), pacientes(nombre, telefono)')
          .eq('consultorio_id', c.id)
          .eq('fecha', hoy)
          .order('hora')
        setCitas(citasHoy || [])
      }
      setCargando(false)
    }
    cargar()
  }, [])

  async function marcarRecordado(citaId) {
    setCitas((prev) => prev.map((c) => (c.id === citaId ? { ...c, recordatorio_enviado: true } : c)))
    await supabase.from('citas').update({ recordatorio_enviado: true }).eq('id', citaId)
  }

  if (cargando) return <div className="p-8 text-tinta/60 font-sans">Cargando…</div>

  const enviados = citas.filter((c) => c.recordatorio_enviado).length

  return (
    <div className="min-h-screen bg-sillar-50 font-sans">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-display font-medium">{consultorio?.nombre}</h1>
            <p className="text-sm text-tinta/60">
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
              {citas.length} citas · {enviados} de {citas.length} recordadas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/panel/apariencia"
              className="text-sm border border-sillar-200 px-3 py-1.5 rounded-lg hover:border-salvia-600 transition-colors"
            >
              Apariencia
            </Link>
            <Link
              to="/panel/servicios"
              className="text-sm border border-sillar-200 px-3 py-1.5 rounded-lg hover:border-salvia-600 transition-colors"
            >
              Servicios
            </Link>
            <Link
              to="/panel/disponibilidad"
              className="text-sm border border-sillar-200 px-3 py-1.5 rounded-lg hover:border-salvia-600 transition-colors"
            >
              Horario
            </Link>
            <Link
              to="/panel/configuracion"
              className="text-sm border border-sillar-200 px-3 py-1.5 rounded-lg hover:border-salvia-600 transition-colors"
            >
              Cuenta de cobro
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                navigate('/login')
              }}
              className="text-sm text-tinta/40 hover:text-red-600 px-2 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>

        {!consultorio?.culqi_public_key && (
          <Link
            to="/panel/configuracion"
            className="block bg-tierra-400/10 border border-tierra-400/30 rounded-xl p-4 mb-3 text-sm text-tierra-600 hover:border-tierra-400/60 transition-colors"
          >
            Todavía no conectas tu cuenta de cobro — tus pacientes no pueden pagar sus citas.
            Conéctala ahora →
          </Link>
        )}

        {!tieneServicios && (
          <Link
            to="/panel/servicios"
            className="block bg-tierra-400/10 border border-tierra-400/30 rounded-xl p-4 mb-3 text-sm text-tierra-600 hover:border-tierra-400/60 transition-colors"
          >
            No tienes servicios activos — tu página de reservas no tiene nada que ofrecer.
            Agrega uno ahora →
          </Link>
        )}

        {!tieneHorario && (
          <Link
            to="/panel/disponibilidad"
            className="block bg-tierra-400/10 border border-tierra-400/30 rounded-xl p-4 mb-5 text-sm text-tierra-600 hover:border-tierra-400/60 transition-colors"
          >
            Todavía no defines tu horario de atención — tu página de reservas no mostrará
            horarios disponibles. Configúralo ahora →
          </Link>
        )}

        <div className="space-y-2">
          <AnimatePresence>
            {citas.map((cita, i) => (
              <motion.div
                key={cita.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 bg-white border border-sillar-200 rounded-xl p-4"
              >
                <span className="font-mono text-sm text-tinta/60 w-14">{cita.hora?.slice(0, 5)}</span>
                <div className="flex-1">
                  <p className="font-medium">{cita.pacientes?.nombre}</p>
                  <p className="text-sm text-tinta/60">{cita.servicios?.nombre}</p>
                </div>
                <button
                  onClick={() => setCitaSeleccionada(cita)}
                  className="text-tinta/40 hover:text-tinta/70 px-2"
                  aria-label="Ver notas y adjuntos"
                >
                  📄
                </button>
                {cita.recordatorio_enviado ? (
                  <span className="text-sm text-salvia-600 px-3 py-1.5">✓ Recordado</span>
                ) : (
                  <a
                    href={linkRecordatorio({
                      telefonoPaciente: cita.pacientes?.telefono,
                      nombrePaciente: cita.pacientes?.nombre,
                      nombreConsultorio: consultorio?.nombre,
                      fecha: cita.fecha,
                      hora: cita.hora?.slice(0, 5),
                    })}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => marcarRecordado(cita.id)}
                    className="text-sm bg-salvia-600 text-white px-3 py-1.5 rounded-lg hover:bg-salvia-800 transition-colors"
                  >
                    Enviar
                  </a>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {citas.length === 0 && (
            <p className="text-center text-tinta/50 py-10 text-sm">No tienes citas agendadas para hoy.</p>
          )}
        </div>

        <AnimatePresence>
          {citaSeleccionada && (
            <PanelNotas
              cita={citaSeleccionada}
              consultorioId={consultorio.id}
              onCerrar={() => setCitaSeleccionada(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function PanelNotas({ cita, consultorioId, onCerrar }) {
  const [notas, setNotas] = useState([])
  const [nuevaNota, setNuevaNota] = useState('')
  const [adjuntos, setAdjuntos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState('')

  useEffect(() => {
    async function cargar() {
      const { data: notasData } = await supabase
        .from('notas')
        .select('*')
        .eq('paciente_id', cita.paciente_id)
        .order('created_at', { ascending: false })
      setNotas(notasData || [])

      const { data: adjuntosData } = await supabase
        .from('adjuntos')
        .select('*')
        .eq('paciente_id', cita.paciente_id)
        .order('created_at', { ascending: false })
      setAdjuntos(adjuntosData || [])
    }
    cargar()
  }, [cita])

  async function guardarNota() {
    if (!nuevaNota.trim()) return
    const { data } = await supabase
      .from('notas')
      .insert({ cita_id: cita.id, paciente_id: cita.paciente_id, texto: nuevaNota })
      .select()
      .single()
    setNotas((prev) => [data, ...prev])
    setNuevaNota('')
  }

  async function manejarSeleccionArchivo(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo después
    if (!file) return

    setErrorArchivo('')
    const mensajeError = validarArchivo(file)
    if (mensajeError) {
      setErrorArchivo(mensajeError)
      return
    }

    setSubiendo(true)
    try {
      const nuevo = await subirAdjunto({ file, consultorioId, pacienteId: cita.paciente_id })
      setAdjuntos((prev) => [nuevo, ...prev])
    } catch {
      setErrorArchivo('No se pudo subir el archivo. Intenta de nuevo.')
    }
    setSubiendo(false)
  }

  async function verAdjunto(ruta) {
    try {
      const url = await urlFirmadaAdjunto(ruta)
      window.open(url, '_blank', 'noreferrer')
    } catch {
      setErrorArchivo('No se pudo abrir el archivo.')
    }
  }

  async function borrarAdjunto(adjunto) {
    await eliminarAdjunto({ id: adjunto.id, ruta: adjunto.url })
    setAdjuntos((prev) => prev.filter((a) => a.id !== adjunto.id))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-tinta/30 flex items-center justify-center p-4 z-10"
      onClick={onCerrar}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        className="bg-white rounded-xl p-5 max-w-sm w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-medium mb-3">{cita.pacientes?.nombre}</p>

        <div className="space-y-2 mb-4">
          <textarea
            value={nuevaNota}
            onChange={(e) => setNuevaNota(e.target.value)}
            placeholder="Nota rápida de esta consulta…"
            className="w-full px-3 py-2 rounded-lg border border-sillar-200 text-sm resize-none"
            rows={2}
          />
          <button onClick={guardarNota} className="text-sm bg-salvia-600 text-white px-3 py-1.5 rounded-lg">
            Guardar nota
          </button>
        </div>
        <div className="space-y-2 max-h-32 overflow-y-auto mb-5">
          {notas.map((n) => (
            <div key={n.id} className="text-sm border border-sillar-200 rounded-lg p-2 text-tinta/70">
              {n.texto}
            </div>
          ))}
        </div>

        <div className="border-t border-sillar-200 pt-4">
          <p className="text-sm font-medium mb-2">Archivos adjuntos</p>
          <label className="flex items-center justify-center gap-2 text-sm border border-dashed border-sillar-200 rounded-lg py-3 cursor-pointer hover:border-salvia-600 transition-colors">
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={manejarSeleccionArchivo}
              className="hidden"
              disabled={subiendo}
            />
            <span className="text-tinta/60">{subiendo ? 'Subiendo…' : 'Subir receta, resultado o foto'}</span>
          </label>
          {errorArchivo && <p className="text-xs text-red-600 mt-1.5">{errorArchivo}</p>}

          <div className="space-y-1.5 mt-3">
            {adjuntos.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between text-sm border border-sillar-200 rounded-lg px-3 py-2"
              >
                <button
                  onClick={() => verAdjunto(a.url)}
                  className="text-left text-salvia-700 hover:underline truncate flex-1"
                >
                  {a.nombre_archivo}
                </button>
                <button
                  onClick={() => borrarAdjunto(a)}
                  aria-label="Eliminar archivo"
                  className="text-tinta/30 hover:text-red-600 pl-2"
                >
                  ✕
                </button>
              </div>
            ))}
            {adjuntos.length === 0 && (
              <p className="text-xs text-tinta/40 text-center py-1">Sin archivos todavía</p>
            )}
          </div>
        </div>

        <button onClick={onCerrar} className="text-sm text-tinta/50 mt-4">
          Cerrar
        </button>
      </motion.div>
    </motion.div>
  )
}
