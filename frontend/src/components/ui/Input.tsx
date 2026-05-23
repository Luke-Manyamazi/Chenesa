interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export default function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-slate-300">{label}</label>}
      <input
        className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors
          ${error ? 'border-red-500 focus:border-red-400' : 'border-border focus:border-primary-500'}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
