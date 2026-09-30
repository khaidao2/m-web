/* Vector supermarket shelves in Masan colours — a repeating tile, so it keeps natural
   scale from the phone header to a full-height desktop panel. */
export default function HeroArt() {
  const slots = [18, 46, 74, 102, 130, 158, 186, 214, 242, 270, 298, 326]
  return (
    <svg aria-hidden width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id="hero-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a0d12" />
          <stop offset="1" stopColor="#8f1119" />
        </linearGradient>
        <linearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.3" stopColor="#5a0c12" stopOpacity="0" />
          <stop offset="1" stopColor="#5a0c12" stopOpacity="0.92" />
        </linearGradient>
        <pattern id="hero-shelf" width="360" height="60" patternUnits="userSpaceOnUse" y="-8">
          {slots.map((x, i) => (
            <g key={x} opacity={0.55 + ((i * 7) % 5) / 12}>
              {i % 3 === 0 ? (
                <path d={`M${x + 7} 12h6v8c5 2 7 6 7 11v21h-20v-21c0-5 2-9 7-11z`} fill={i % 2 ? '#ffb000' : '#e8392f'} />
              ) : i % 3 === 1 ? (
                <rect x={x} y="22" width="22" height="30" rx="4" fill={i % 2 ? '#f5d9a8' : '#d71920'} />
              ) : (
                <path d={`M${x + 8} 6h5v12c4 3 6 7 6 12v22h-16v-22c0-5 2-9 5-12z`} fill="#c9791d" />
              )}
            </g>
          ))}
          <rect x="0" y="52" width="360" height="6" fill="#2a0a0d" opacity="0.7" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hero-bg)" />
      <rect width="100%" height="100%" fill="url(#hero-shelf)" />
      <rect width="100%" height="100%" fill="url(#hero-fade)" />
    </svg>
  )
}
