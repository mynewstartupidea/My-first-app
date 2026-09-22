import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          width: 512, height: 512,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 96,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 300, height: 265 }}>
          <div style={{
            width: 280, height: 210,
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 56,
            position: 'absolute', top: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ color: '#128C7E', fontSize: 148, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1 }}>W</div>
          </div>
          <div style={{
            width: 0, height: 0,
            borderLeft: '40px solid rgba(255,255,255,0.95)',
            borderRight: '0px solid transparent',
            borderTop: '40px solid transparent',
            position: 'absolute', bottom: 0, left: 56,
          }} />
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
