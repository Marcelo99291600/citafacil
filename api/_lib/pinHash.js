const crypto = require('crypto')

function generarSal() {
  return crypto.randomBytes(16).toString('hex')
}

function hashearPin(pin, sal) {
  return crypto.scryptSync(String(pin), sal, 64).toString('hex')
}

function pinValido(pin) {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin)
}

function compararHashes(a, b) {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

module.exports = { generarSal, hashearPin, pinValido, compararHashes }
