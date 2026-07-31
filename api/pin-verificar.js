import { createClient } from '@supabase/supabase-js'
import { hashearPin, pinValido, compararHashes } from './_lib/pinHash.js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const { token, pin } = req.body

  if (!pinValido(pin)) {
    return res.status(400).json({ error: 'PIN inválido.' })
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
    .select('pin_hash, pin_salt, pin_configurado')
    .eq('auth_user_id', usuario.user.id)
    .maybeSingle()

  if (errorAdmin || !admin || !admin.pin_configurado) {
    return res.status(403).json({ error: 'No tienes un PIN configurado.' })
  }

  const hashIntentado = hashearPin(pin, admin.pin_salt)
  const esCorrecto = compararHashes(hashIntentado, admin.pin_hash)

  if (!esCorrecto) {
    return res.status(401).json({ error: 'PIN incorrecto.' })
  }

  return res.status(200).json({ ok: true })
}
