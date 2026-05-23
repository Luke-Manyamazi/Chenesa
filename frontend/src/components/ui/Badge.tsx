const styles: Record<string, string> = {
  free:      'bg-slate-500/20 text-slate-400',
  basic:     'bg-blue-500/20 text-blue-400',
  pro:       'bg-primary-500/20 text-primary-400',
  SPAM:      'bg-red-500/20 text-red-400',
  MARKETING: 'bg-orange-500/20 text-orange-400',
  SOCIAL:    'bg-blue-500/20 text-blue-400',
  OLD_READ:  'bg-slate-500/20 text-slate-400',
  KEEP:      'bg-green-500/20 text-green-400',
  completed: 'bg-green-500/20 text-green-400',
  running:   'bg-yellow-500/20 text-yellow-400',
  failed:    'bg-red-500/20 text-red-400',
}

export default function Badge({ label }: { label: string }) {
  const style = styles[label] ?? 'bg-slate-500/20 text-slate-400'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  )
}
