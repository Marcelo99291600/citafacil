// Función serverless de Vercel (Node.js).
// Se ejecuta en el servidor, nunca en el navegador del paciente:
// aquí SÍ podemos usar las llaves secretas (Culqi y Supabase service_role)
// sin exponerlas.

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // llave secreta, solo en el servidor
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { token, consultorioId, servicioId, nombre, telefono, fecha, hora, monto } = req.body

  try {
    // 1. Obtener la llave secreta y comisión de ESTE consultorio (cada uno tiene su propia cuenta Culqi)
    const { data: consultorio } = await supabaseAdmin
      .from('consultorios')
      .select('comision_porcentaje, culqi_secret_key')
      .eq('id', consultorioId)
      .single()

    if (!consultorio?.culqi_secret_key) {
      return res.status(400).json({ error: 'Este consultorio todavía no configuró su cuenta de cobro.' })
    }

    // 2. Cobrar con Culqi usando la llave secreta DEL CONSULTORIO — el dinero
    // va directo a su cuenta bancaria, nunca pasa por la nuestra.
    const cargoRes = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${consultorio.culqi_secret_key}`,
      },
      body: JSON.stringify({
        amount: Math.round(monto * 100),
        currency_code: 'PEN',
        email: `paciente-${telefono}@citafacil.app`,
        source_id: token,
        description: `Cita - ${fecha} ${hora}`,
      }),
    })
    const cargo = await cargoRes.json()

    if (!cargoRes.ok) {
      return res.status(400).json({ error: cargo.user_message || 'El pago no pudo procesarse' })
    }
    // La respuesta de Culqi (cargo.id, con status 200) ES la validación del pago:
    // viene directo de la pasarela, el consultorio no puede alterarla.

    const comisionMonto = +(monto * (consultorio.comision_porcentaje / 100)).toFixed(2)

    // 3. Crear (o reutilizar) el paciente
    let { data: paciente } = await supabaseAdmin
      .from('pacientes')
      .select('id')
      .eq('consultorio_id', consultorioId)
      .eq('telefono', telefono)
      .maybeSingle()

    if (!paciente) {
      const { data: nuevoPaciente } = await supabaseAdmin
        .from('pacientes')
        .insert({ consultorio_id: consultorioId, nombre, telefono })
        .select()
        .single()
      paciente = nuevoPaciente
    }

    // 4. Crear la cita ya confirmada (el pago ya se hizo)
    const { data: cita } = await supabaseAdmin
      .from('citas')
      .insert({
        consultorio_id: consultorioId,
        servicio_id: servicioId,
        paciente_id: paciente.id,
        fecha,
        hora,
        estado: 'confirmada',
        monto,
      })
      .select()
      .single()

    // 5. Registrar el pago
    await supabaseAdmin.from('pagos').insert({
      cita_id: cita.id,
      consultorio_id: consultorioId,
      monto,
      comision_monto: comisionMonto,
      culqi_charge_id: cargo.id,
      estado: 'pagado',
    })

    return res.status(200).json({ ok: true, citaId: cita.id })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Ocurrió un error al procesar la reserva.' })
  }
}
