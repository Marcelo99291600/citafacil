import { supabase } from './supabase'

const BUCKET = 'adjuntos'
const TAMANO_MAXIMO_MB = 10
const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export function validarArchivo(file) {
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return 'Solo se aceptan PDF o imágenes (JPG, PNG, WEBP).'
  }
  if (file.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
    return `El archivo no debe superar ${TAMANO_MAXIMO_MB}MB.`
  }
  return null
}

export async function subirAdjunto({ file, consultorioId, pacienteId }) {
  const nombreLimpio = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const ruta = `${consultorioId}/${pacienteId}/${Date.now()}-${nombreLimpio}`

  const { error: errorSubida } = await supabase.storage.from(BUCKET).upload(ruta, file)
  if (errorSubida) throw errorSubida

  const { data, error: errorInsert } = await supabase
    .from('adjuntos')
    .insert({ paciente_id: pacienteId, nombre_archivo: file.name, url: ruta })
    .select()
    .single()
  if (errorInsert) throw errorInsert

  return data
}

export async function urlFirmadaAdjunto(ruta) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 60 * 10) // 10 minutos
  if (error) throw error
  return data.signedUrl
}

export async function eliminarAdjunto({ id, ruta }) {
  await supabase.storage.from(BUCKET).remove([ruta])
  await supabase.from('adjuntos').delete().eq('id', id)
}
