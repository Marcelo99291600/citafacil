import crypto from 'crypto'

export function generarSal() {
  return crypto.randomBytes(16).toString('hex')
}

export function hashearPin(pin, sal) {
  return crypto.scryptSync(String(pin), sal, 64).toString('hex')
}

export function pinValido(pin) {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin)
}

export function compararHashes(a, b) {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}
