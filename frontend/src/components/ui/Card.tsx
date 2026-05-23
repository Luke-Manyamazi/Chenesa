interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-border bg-surface p-5 ${onClick ? 'cursor-pointer hover:border-primary-500 transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
