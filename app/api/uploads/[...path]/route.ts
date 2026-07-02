import { NextResponse, NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params
  const filePath = path.join(process.cwd(), 'public', 'uploads', ...segments)
  try {
    const buffer = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp' }
    return new NextResponse(buffer, { headers: { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000' } })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
