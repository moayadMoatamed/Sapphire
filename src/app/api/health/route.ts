import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    status: 'healthy',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  })
}
