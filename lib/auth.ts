import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'glamour-secret')

export async function signToken(payload: object) {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch { return null }
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('glamour_token')?.value
  if (!token) return null
  return verifyToken(token)
}
