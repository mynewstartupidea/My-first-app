import crypto from 'crypto'

// AES-256-GCM encryption for secrets that must be stored (not just hashed) —
// currently only the Shopify custom-app client secret and access token.
// Everything else in this codebase (Shopify OAuth token, WhatsApp API key)
// is stored in plaintext; this is deliberately scoped to the new columns
// only, not a retrofit of existing storage.
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH  = 12 // recommended for GCM

function getKey(): Buffer {
  const raw = process.env.SHOPIFY_CREDENTIALS_ENCRYPTION_KEY
  if (!raw) throw new Error('SHOPIFY_CREDENTIALS_ENCRYPTION_KEY is not configured')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('SHOPIFY_CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes')
  return key
}

// Returns "iv.authTag.ciphertext", each segment base64 — dot-delimited so it
// stays a plain TEXT column value with no ambiguity about where one segment ends.
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join('.')
}

export function decrypt(packed: string): string {
  const [ivB64, authTagB64, ciphertextB64] = packed.split('.')
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error('Malformed encrypted value')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
