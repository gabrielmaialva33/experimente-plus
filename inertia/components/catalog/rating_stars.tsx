import { cn } from '~/lib/utils'

const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'

/** "4,5" — one decimal, Brazilian comma; whole numbers without the ",0". */
export function formatRating(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/**
 * Stars that draw the average as it is — a 4,5 shows four and a half, never
 * five (the app's A8). The picture is decorative; the label carries the value.
 */
export function RatingStars({
  value,
  size = 16,
  className,
}: {
  value: number
  size?: number
  className?: string
}) {
  const halves = Math.round(Math.min(5, Math.max(0, value)) * 2)

  return (
    <span
      role="img"
      aria-label={`${formatRating(value)} de 5`}
      className={cn('inline-flex items-center gap-0.5 text-warning-accent', className)}
    >
      {[0, 1, 2, 3, 4].map((index) => {
        const fill =
          halves >= (index + 1) * 2 ? 'full' : halves === index * 2 + 1 ? 'half' : 'empty'
        return (
          <svg key={index} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <path
              d={STAR}
              fill={fill === 'full' ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={fill === 'full' ? 0 : 1.6}
            />
            {fill === 'half' ? (
              <path d="M12 3v14l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" />
            ) : null}
          </svg>
        )
      })}
    </span>
  )
}
