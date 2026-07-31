import { supabase } from './supabase'

const BUCKET = 'marca'
const TAMANO_MAXIMO_MB = 5
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
const MAXIMO_IMAGENES_POR_SERVICIO = 6

export function validarImagenServicio(file) {
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return 'Solo se aceptan imágenes JPG, PNG o WEBP.'
  }
  if (file.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
    return `La imagen no debe superar ${TAMANO_MAXIMO_MB}MB.`
  }
  return null
}

export async function subirImagenServicio({ file, consultorioId, servicioId, imagenesActuales }) {
  if ((imagenesActuales || []).length >= MAXIMO_IMAGENES_POR_SERVICIO) {
    throw new Error(`Máximo ${MAXIMO_IMAGENES_POR_SERVICIO} fotos por servicio.`)
  }

  const nombreLimpio = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const ruta = `${consultorioId}/servicios/${servicioId}/${Date.now()}-${nombreLimpio}`

  const { error: errorSubida } = await supabase.storage.from(BUCKET).upload(ruta, file)
  if (errorSubida) throw errorSubida

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
  const nuevasImagenes = [...(imagenesActuales || []), data.publicUrl]

  const { error: errorUpdate } = await supabase
    .from('servicios')
    .update({ imagenes: nuevasImagenes })
    .eq('id', servicioId)
  if (errorUpdate) throw errorUpdate

  return nuevasImagenes
}

export async function quitarImagenServicio({ servicioId, imagenesActuales, url }) {
  const nuevasImagenes = (imagenesActuales || []).filter((u) => u !== url)
  const { error } = await supabase.from('servicios').update({ imagenes: nuevasImagenes }).eq('id', servicioId)
  if (error) throw error
  return nuevasImagenes
}
