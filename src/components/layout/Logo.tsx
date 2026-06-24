export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 48" className={className} role="img" aria-label="ANTOSC">
      <g fill="currentColor">
        <path d="M24 6 L18 42 L21 42 L22.5 36 L29.5 36 L31 42 L34 42 L28 6 Z M23.3 32 L24.5 22 L27.5 22 L28.7 32 Z" />
        <circle cx="26" cy="10" r="2" />
        <path d="M14 14 q12 -8 24 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10 18 q16 -12 32 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </g>
      <text x="48" y="33" fontFamily="DM Sans, sans-serif" fontWeight="800" fontSize="26" letterSpacing="2" fill="currentColor">
        ANTOSC
      </text>
    </svg>
  );
}
