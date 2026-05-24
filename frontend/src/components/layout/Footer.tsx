export default function Footer() {
  return (
    <footer className="border-t border-border py-8 text-center space-y-1">
      <p className="text-xs text-slate-600">
        A <span className="text-slate-500 font-medium">Camluk Technologies</span> AI Solutions product
      </p>
      <p className="text-sm text-slate-500">
        © {new Date().getFullYear()} Chenesa. Built with AI. Your emails, your privacy.
      </p>
    </footer>
  )
}
