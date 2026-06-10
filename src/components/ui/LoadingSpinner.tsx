const SIZE_MAP: Record<string, number> = { sm: 16, md: 24, lg: 36 }

type Props = {
  size?: number | 'sm' | 'md' | 'lg'
  color?: string
}

export function LoadingSpinner({ size = 'md', color = 'var(--brand)' }: Props) {
  const px = typeof size === 'number' ? size : (SIZE_MAP[size] ?? 24)
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: 'shule-spin 0.7s linear infinite', flexShrink: 0 }}
      aria-label="Loading"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
