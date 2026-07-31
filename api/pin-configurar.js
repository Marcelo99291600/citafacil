import { createClient } from '@supabase/supabase-js'
import { generarSal, hashearPin, pinValido } from './_lib/pinHash.js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const { token, pin } = req.body

  if (!pinValido(pin)) {
    return res.status(400).json({ error: 'El PIN debe tener entre 4 y 6 dígitos.' })
  }
  if (!token) {
    return res.status(401).json({ error: 'Sesión inválida.' })
  }

  const { data: usuario, error: errorUsuario } = await supabaseAdmin.auth.getUser(token)
  if (errorUsuario || !usuario?.user) {
    return res.status(401).json({ error: 'Sesión inválida.' })
  }

  const { data: admin, error: errorAdmin } = await supabaseAdmin
    .from('administradores')
    .select('id')
    .eq('auth_user_id', usuario.user.id)
    .maybeSingle()

  if (errorAdmin || !admin) {
    return res.status(403).json({ error: 'No tienes permisos de administrador.' })
  }

  const sal = generarSal()
  const hash = hashearPin(pin, sal)

  const { error: errorUpdate } = await supabaseAdmin
    .from('administradores')
    .update({ pin_hash: hash, pin_salt: sal, pin_configurado: true })
    .eq('id', admin.id)

  if (errorUpdate) return res.status(500).json({ error: 'No se pudo guardar el PIN.' })

  return res.status(200).json({ ok: true })
}
