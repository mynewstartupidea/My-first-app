import { ImageResponse } from 'next/og'

export const size        = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background:     'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          width:          '100%',
          height:         '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          borderRadius:   7,
        }}
      >
        {/* Chat bubble shape */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          position:       'relative',
          width:          22,
          height:         22,
        }}>
          {/* Bubble body */}
          <div style={{
            width:        20,
            height:       17,
            background:   'white',
            borderRadius: 5,
            position:     'absolute',
            top:          0,
          }} />
          {/* Bubble tail */}
          <div style={{
            width:       0,
            height:      0,
            borderLeft:  '4px solid transparent',
            borderRight: '0px solid transparent',
            borderTop:   '5px solid white',
            position:    'absolute',
            bottom:      0,
            left:        4,
          }} />
          {/* W letter */}
          <div style={{
            color:      '#25D366',
            fontSize:   11,
            fontWeight: 900,
            position:   'absolute',
            top:        2,
            fontFamily: 'Arial Black, Arial, sans-serif',
          }}>
            W
          </div>
        </div>
      </div>
    ),
    size,
  )
}
