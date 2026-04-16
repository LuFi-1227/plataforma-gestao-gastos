const crypto = require('crypto')

// HKDF
function hkdf(mediaKey, length) {
  const salt = Buffer.alloc(32, 0)
  const info = Buffer.from('WhatsApp Audio Keys')

  let prk = crypto.createHmac('sha256', salt)
    .update(mediaKey)
    .digest()

  let prev = Buffer.alloc(0)
  let output = Buffer.alloc(0)
  let i = 0

  while (output.length < length) {
    i++
    prev = crypto.createHmac('sha256', prk)
      .update(Buffer.concat([prev, info, Buffer.from([i])]))
      .digest()
    output = Buffer.concat([output, prev])
  }

  return output.slice(0, length)
}

function decryptWhatsAppAudio(encBuffer, mediaKeyBase64) {
  const mediaKey = Buffer.from(mediaKeyBase64, 'base64')
  const expandedKey = hkdf(mediaKey, 112)

  const iv = expandedKey.slice(0, 16)
  const cipherKey = expandedKey.slice(16, 48)

  const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv)

  return Buffer.concat([
    decipher.update(encBuffer),
    decipher.final()
  ])
}

module.exports = { decryptWhatsAppAudio }