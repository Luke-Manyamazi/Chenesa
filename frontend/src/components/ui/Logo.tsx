/** Chenesa logo mark — envelope + lightning bolt on purple gradient */
export default function Logo({ size = 32 }: { size?: number }) {
  const id = `chenesa-grad-${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-label="Chenesa">

      {/* Background */}
      <rect width="32" height="32" rx="8" fill={`url(#${id})`}/>

      {/* Envelope body */}
      <rect x="5" y="12" width="22" height="14" rx="2" fill="white" opacity="0.95"/>

      {/* Fold chevron */}
      <path d="M5 12 L16 20 L27 12"
        stroke="#6366f1" strokeWidth="1.6"
        strokeLinejoin="round" fill="none"/>

      {/* Lightning bolt — AI / speed */}
      <path d="M23 4 L20.5 9 H23 L20.5 14"
        stroke="white" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"/>

      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32"
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#6366f1"/>
          <stop offset="100%" stopColor="#7c3aed"/>
        </linearGradient>
      </defs>
    </svg>
  )
}
