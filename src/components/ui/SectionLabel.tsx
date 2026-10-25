interface SectionLabelProps {
  children: React.ReactNode
  className?: string
}

export function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <p className={`section-label mb-3 ${className}`}>{children}</p>
  )
}
