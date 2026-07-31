import { supabase } from './supabase'

const BUCKET = 'marca'
const TAMANO_MAXIMO_MB = 5
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']

export function validarImagen(file) {
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return 'Solo se aceptan imágenes JPG, PNG o WEBP.'
  }
  if (file.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
    return `La imagen no debe superar ${TAMANO_MAXIMO_MB}MB.`
  }
  return null
}

// tipo: 'perfil' | 'portada' | 'fondo'
export async function subirImagenMarca({ file, consultorioId, tipo }) {
  const extension = file.name.split('.').pop()
  const ruta = `${consultorioId}/${tipo}.${extension}`

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, file, { upsert: true, cacheControl: '60' })
  if (errorSubida) throw errorSubida

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
  // Se agrega un parámetro de versión para que el navegador no muestre la
  // imagen vieja en caché cuando el doctor reemplaza una foto existente.
  const urlConVersion = `${data.publicUrl}?v=${Date.now()}`

  const columna = { perfil: 'logo_url', portada: 'imagen_portada', fondo: 'imagen_fondo' }[tipo]
  const { error: errorUpdate } = await supabase
    .from('consultorios')
    .update({ [columna]: urlConVersion })
    .eq('id', consultorioId)
  if (errorUpdate) throw errorUpdate

  return urlConVersion
}
