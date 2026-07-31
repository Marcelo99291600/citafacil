import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function entrar(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contraseña incorrectos.')
      return
    }
    navigate('/panel')
  }

  return (
    <div className="min-h-screen bg-sillar-50 flex items-center justify-center px-6 font-sans">
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={entrar}
        className="bg-white border border-sillar-200 rounded-xl p-6 w-full max-w-sm"
      >
        <h1 className="text-lg font-display font-medium mb-1">CitaFácil</h1>
        <p className="text-sm text-tinta/60 mb-5">Ingresa a tu panel de consultorio</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Correo"
          className="w-full px-4 py-3 rounded-lg border border-sillar-200 mb-3"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Contraseña"
          className="w-full px-4 py-3 rounded-lg border border-sillar-200 mb-4"
        />
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button className="w-full py-3 rounded-lg bg-salvia-600 text-white font-medium">
          Ingresar
        </button>
        <p className="text-sm text-tinta/50 text-center mt-4">
          ¿Tienes un consultorio? <Link to="/registro" className="text-salvia-700 underline">Regístralo aquí</Link>
        </p>
      </motion.form>
    </div>
  )
}
