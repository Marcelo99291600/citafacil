import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

const DIAS = [
  { valor: 1, nombre: 'Lunes' },
  { valor: 2, nombre: 'Martes' },
  { valor: 3, nombre: 'Miércoles' },
  { valor: 4, nombre: 'Jueves' },
  { valor: 5, nombre: 'Viernes' },
  { valor: 6, nombre: 'Sábado' },
  { valor: 0, nombre: 'Domingo' },
]

const HORARIO_VACIO = () => ({ activo: false, hora_inicio: '09:00', hora_fin: '18:00' })

export default function DisponibilidadPage() {
  const navigate = useNavigate()
  const [consultorioId, setConsultorioId] = useState(null)
  const [horario, setHorario] = useState(() =>
    Object.fromEntries(DIAS.map((d) => [d.valor, HORARIO_VACIO()])),
  )
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
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

      const { data: bloques } = await supabase
        .from('disponibilidad')
        .select('*')
        .eq('consultorio_id', c.id)

      if (bloques?.length) {
        setHorario((prev) => {
          const nuevo = { ...prev }
          for (const b of bloques) {
            nuevo[b.dia_semana] = {
              activo: true,
              hora_inicio: b.hora_inicio.slice(0, 5),
              hora_fin: b.hora_fin.slice(0, 5),
            }
          }
          return nuevo
        })
      }
      setCargando(false)
    }
    cargar()
  }, [])

  function actualizarDia(dia, cambios) {
    setHorario((prev) => ({ ...prev, [dia]: { ...prev[dia], ...cambios } }))
  }

  function copiarALunes() {
    setHorario((prev) => {
      const base = prev[1]
      const nuevo = {}
      for (const d of DIAS) {
        nuevo[d.valor] =
          d.valor !== 1 && prev[d.valor].activo
            ? { ...prev[d.valor], hora_inicio: base.hora_inicio, hora_fin: base.hora_fin }
            : prev[d.valor]
      }
      return nuevo
    })
  }

  async function guardar() {
    setError('')

    for (const d of DIAS) {
      const h = horario[d.valor]
      if (h.activo && h.hora_inicio >= h.hora_fin) {
        setError(`En ${d.nombre}, la hora de inicio debe ser antes que la hora de fin.`)
        return
      }
    }

    setGuardando(true)
    await supabase.from('disponibilidad').delete().eq('consultorio_id', consultorioId)

    const filas = DIAS.filter((d) => horario[d.valor].activo).map((d) => ({
      consultorio_id: consultorioId,
      dia_semana: d.valor,
      hora_inicio: horario[d.valor].hora_inicio,
      hora_fin: horario[d.valor].hora_fin,
    }))

    if (filas.length > 0) {
      const { error: errorInsert } = await supabase.from('disponibilidad').insert(filas)
      if (errorInsert) {
        setGuardando(false)
        setError('No se pudo guardar. Intenta de nuevo.')
        return
      }
    }

    setGuardando(false)
    setGuardado(true)
  }

  if (cargando) return <div className="p-8 font-sans text-tinta/60">Cargando…</div>

  return (
    <div className="min-h-screen bg-sillar-50 font-sans">
      <div className="max-w-lg mx-auto px-6 py-8">
        <button onClick={() => navigate('/panel')} className="text-sm text-tinta/50 mb-4 hover:text-tinta/80">
          ← Volver al panel
        </button>

        <h1 className="text-xl font-display font-medium mb-1">Horario de atención</h1>
        <p className="text-sm text-tinta/60 mb-6">
          Marca los días que atiendes y el rango de horas. Tus pacientes solo podrán reservar
          dentro de estos horarios.
        </p>

        <div className="space-y-2">
          {DIAS.map((d) => (
            <div
              key={d.valor}
              className={`bg-white border rounded-xl p-4 transition-colors ${
                horario[d.valor].activo ? 'border-salvia-600' : 'border-sillar-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={horario[d.valor].activo}
                    onChange={(e) => actualizarDia(d.valor, { activo: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="font-medium text-sm">{d.nombre}</span>
                </label>

                <AnimatePresence>
                  {horario[d.valor].activo && (
                    <motion.div
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="time"
                        value={horario[d.valor].hora_inicio}
                        onChange={(e) => actualizarDia(d.valor, { hora_inicio: e.target.value })}
                        className="text-sm px-2 py-1.5 rounded-lg border border-sillar-200 font-mono"
                      />
                      <span className="text-tinta/40 text-sm">–</span>
                      <input
                        type="time"
                        value={horario[d.valor].hora_fin}
                        onChange={(e) => actualizarDia(d.valor, { hora_fin: e.target.value })}
                        className="text-sm px-2 py-1.5 rounded-lg border border-sillar-200 font-mono"
                      />
                      {d.valor === 1 && (
                        <button
                          type="button"
                          onClick={copiarALunes}
                          className="text-xs text-tinta/40 hover:text-salvia-700 underline whitespace-nowrap"
                        >
                          copiar a todos
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        <button
          onClick={guardar}
          disabled={guardando}
          className="w-full mt-5 py-3 rounded-lg bg-salvia-600 text-white font-medium disabled:opacity-50 transition-opacity"
        >
          {guardando ? 'Guardando…' : 'Guardar horario'}
        </button>

        <AnimatePresence>
          {guardado && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 flex items-center gap-2 text-sm text-salvia-700 bg-salvia-400/10 border border-salvia-400/25 rounded-lg px-4 py-3"
            >
              <span>✓</span>
              <span>Horario guardado. Tus pacientes ya pueden reservar según estos días y horas.</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
