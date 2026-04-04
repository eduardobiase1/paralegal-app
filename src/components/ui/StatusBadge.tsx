import { StatusCor } from '@/types'
import { statusCorLabel } from '@/lib/utils'

interface StatusBadgeProps {
  status: StatusCor
  diasParaVencer?: number | null
}

export default function StatusBadge({ status, diasParaVencer }: StatusBadgeProps) {
  const label = diasParaVencer !== undefined && diasParaVencer !== null
    ? diasParaVencer < 0
      ? `Vencido há ${Math.abs(diasParaVencer)}d`
      : `${diasParaVencer}d`
    : statusCorLabel(status)

  return (
    <span className={`badge-${status}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor(status)}`} />
      {label}
    </span>
  )
}

function dotColor(status: StatusCor): string {
  switch (status) {
    case 'ok':      return 'bg-green-500'
    case 'alerta':  return 'bg-blue-500'
    case 'atencao': return 'bg-yellow-500'
    case 'critico': return 'bg-orange-500'
    case 'vencido': return 'bg-red-500'
    default:        return 'bg-gray-400'
  }
}
