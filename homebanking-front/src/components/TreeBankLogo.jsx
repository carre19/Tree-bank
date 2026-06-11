// Logo Tree Bank — versión refinada con gradiente
export default function TreeBankLogo({ size = 48, showText = true, vertical = true }) {
  const mark = (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tb-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="tb-grad-2" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      {/* Árbol izquierdo */}
      <polygon points="18,72 30,40 42,72" fill="url(#tb-grad-2)" />
      <polygon points="20,60 30,30 40,60" fill="url(#tb-grad-2)" />
      <rect x="27" y="72" width="6" height="10" rx="2" fill="url(#tb-grad-2)" />
      {/* Árbol central (más grande) */}
      <polygon points="35,75 50,32 65,75" fill="url(#tb-grad)" />
      <polygon points="37,62 50,22 63,62" fill="url(#tb-grad)" />
      <rect x="46" y="75" width="8" height="12" rx="2" fill="url(#tb-grad)" />
      {/* Árbol derecho */}
      <polygon points="58,72 70,40 82,72" fill="url(#tb-grad-2)" />
      <polygon points="60,60 70,30 80,60" fill="url(#tb-grad-2)" />
      <rect x="67" y="72" width="6" height="10" rx="2" fill="url(#tb-grad-2)" />
      {/* Base */}
      <rect x="12" y="84" width="76" height="4" rx="2" fill="url(#tb-grad)" />
    </svg>
  );

  if (!showText) return mark;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: 'center',
        gap: vertical ? '6px' : '10px',
      }}
    >
      {mark}
      <span
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 800,
          fontSize: Math.max(size * 0.28, 14),
          letterSpacing: '0.06em',
          background: 'linear-gradient(110deg, #0e2a43 20%, #059669)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        TREE BANK
      </span>
    </div>
  );
}
