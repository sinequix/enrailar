/** Iconografía de línea, 1.75px, esquinas redondeadas. Ver docs/brand/manual.md. */
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function MapIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" />
      <path d="M9 4v13.5M15 6.5V20" />
      <circle cx="12" cy="11" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M15.5 14.5a4.5 4.5 0 0 1 5 4.5" />
    </svg>
  );
}

export function DroneIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M3 6h5M16 6h5M5.5 6v3M18.5 6v3" />
      <rect x="7" y="9" width="10" height="5" rx="1.5" />
      <path d="M4 20h16M6 17h12M9 14v3M15 14v3" />
    </svg>
  );
}
