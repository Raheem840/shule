const COLORS = [
  '#1a6b3c','#1e40af','#7c3aed','#b45309',
  '#c53030','#065f46','#9a3412',
]

function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

const SIZE_MAP = {
  xs:  { box: 24, font: 9  },
  sm:  { box: 28, font: 10 },
  md:  { box: 36, font: 13 },
  lg:  { box: 48, font: 16 },
  xl:  { box: 64, font: 22 },
}

export function InitialsAvatar({
  name,
  size = 'md',
  photoUrl,
}: {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  photoUrl?: string | null
}) {
  const { box, font } = SIZE_MAP[size]
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
  const bg = hashColor(name)

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{
          width: box, height: box, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
        }}
      />
    )
  }

  return (
    <div style={{
      width: box, height: box, borderRadius: '50%',
      background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: font, fontWeight: 700, color: '#fff',
      fontFamily: 'var(--font2)',
    }}>
      {initials}
    </div>
  )
}
