// Genera un link wa.me con el mensaje ya redactado.
// La secretaria/doctor solo abre el link y presiona "Enviar" en su propio WhatsApp.

export function linkRecordatorio({ telefonoPaciente, nombrePaciente, nombreConsultorio, fecha, hora }) {
  const telefonoLimpio = telefonoPaciente.replace(/\D/g, '')
  const numero = telefonoLimpio.startsWith('51') ? telefonoLimpio : `51${telefonoLimpio}`

  const fechaLegible = new Date(`${fecha}T00:00:00`).toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const mensaje =
    `Hola ${nombrePaciente}, te recordamos tu cita el ${fechaLegible} a las ${hora} ` +
    `con ${nombreConsultorio}. Por favor confirma tu asistencia. ¡Te esperamos!`

  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}
