import { useSignedUrl } from '../../hooks/useSignedUrl'
import { getPublicUrl, BUCKETS } from '../../lib/storage'

const COLORS = [
  '#1a6b3c', '#1e40af', '#7c3aed', '#b45309',
  '#c53030', '#065f46', '#9a3412',
]

function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

const SIZE_MAP = {
  xs: { box: 24, font: 9  },
  sm: { box: 32, font: 11 },
  md: { box: 40, font: 14 },
  lg: { box: 64, font: 22 },
  xl: { box: 96, font: 32 },
}

interface AvatarProps {
  /** Raw storage path OR full URL (legacy). NOT a supabase signed URL. */
  photoPath?: string | null
  bucket?: 'staff-photos' | 'student-photos'
  name: string
  size?: keyof typeof SIZE_MAP
  style?: React.CSSProperties
}

export function Avatar({
  photoPath,
  bucket = 'staff-photos',
  name,
  size = 'md',
  style,
}: AvatarProps) {
  const isPrivate = bucket === BUCKETS.STUDENT_PHOTOS
  const signedUrl = useSignedUrl(isPrivate ? bucket : null, isPrivate ? photoPath : null)
  const publicUrl = !isPrivate ? getPublicUrl(bucket, photoPath) : null
  const src       = isPrivate ? signedUrl : publicUrl

  const { box, font } = SIZE_MAP[size]
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
  const bg = hashColor(name)

  const base: React.CSSProperties = {
    width: box, height: box, borderRadius: '50%',
    flexShrink: 0, overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    ...style,
  }

  if (src) {
    return (
      <div style={base}>
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }

  return (
    <div style={{ ...base, background: bg }}>
      <span style={{ fontSize: font, fontWeight: 700, color: '#fff', fontFamily: 'var(--font2)', userSelect: 'none', lineHeight: 1 }}>
        {initials}
      </span>
    </div>
  )
}
