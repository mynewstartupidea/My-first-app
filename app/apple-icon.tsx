import { ImageResponse } from 'next/og'

export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background:     'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          width:          '100%',
          height:         '100%',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            6,
        }}
      >
        {/* Chat bubble */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          position:       'relative',
          width:          100,
          height:         90,
        }}>
          <div style={{
            width:        100,
            height:       78,
            background:   'rgba(255,255,255,0.95)',
            borderRadius: 22,
            position:     'absolute',
            top:          0,
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
          }}>
            <div style={{
              color:      '#128C7E',
              fontSize:   56,
              fontWeight: 900,
              fontFamily: 'Arial Black, Arial, sans-serif',
              lineHeight: 1,
            }}>
              W
            </div>
          </div>
          {/* Tail */}
          <div style={{
            width:       0,
            height:      0,
            borderLeft:  '16px solid rgba(255,255,255,0.95)',
            borderRight: '0px solid transparent',
            borderTop:   '16px solid transparent',
            position:    'absolute',
            bottom:      0,
            left:        20,
          }} />
        </div>
        {/* Wordmark */}
        <div style={{
          color:        'white',
          fontSize:     28,
          fontWeight:   900,
          fontFamily:   'Arial Black, Arial, sans-serif',
          letterSpacing: -1,
          marginTop:    4,
        }}>
          Wapaci
        </div>
      </div>
    ),
    size,
  )
}
