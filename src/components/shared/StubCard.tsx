import type { LucideIcon } from 'lucide-react'
import { Construction } from 'lucide-react'

interface StubCardProps {
  title: string
  description?: string
  icon?: LucideIcon
}

export function StubCard({ title, description, icon: Icon = Construction }: StubCardProps) {
  return (
    <div className="stub-card">
      <div className="stub-card-icon">
        <Icon size={32} />
      </div>
      <h3 className="stub-card-title">{title}</h3>
      {description && <p className="stub-card-desc">{description}</p>}
      <span className="stub-badge">Coming in next phase</span>
    </div>
  )
}
