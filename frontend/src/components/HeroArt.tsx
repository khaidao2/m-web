/* Vector supermarket shelf in Masan colours — stands in for store photography. */
export default function HeroArt() {
  const bottles = [18, 46, 74, 102, 130, 158, 186, 214, 242, 270, 298, 326]
  return (
    <svg viewBox="0 0 360 170" preserveAspectRatio="xMidYMid slice" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="hero-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a0d12" />
          <stop offset="1" stopColor="#8f1119" />
        </linearGradient>
        <linearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.25" stopColor="#5a0c12" stopOpacity="0" />
          <stop offset="1" stopColor="#5a0c12" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect width="360" height="170" fill="url(#hero-bg)" />
      {[52, 112].map((y) => (
        <g key={y}>
          {bottles.map((x, i) => (
            <g key={x} opacity={0.55 + ((i * 7) % 5) / 12}>
              {i % 3 === 0 ? (
                <path d={`M${x + 7} ${y - 40}h6v8c5 2 7 6 7 11v21h-20v-21c0-5 2-9 7-11z`} fill={i % 2 ? '#ffb000' : '#e8392f'} />
              ) : i % 3 === 1 ? (
                <rect x={x} y={y - 30} width="22" height="30" rx="4" fill={i % 2 ? '#f5d9a8' : '#d71920'} />
              ) : (
                <path d={`M${x + 8} ${y - 46}h5v12c4 3 6 7 6 12v22h-16v-22c0-5 2-9 5-12z`} fill="#c9791d" />
              )}
            </g>
          ))}
          <rect x="0" y={y} width="360" height="6" fill="#2a0a0d" opacity="0.7" />
        </g>
      ))}
      <rect width="360" height="170" fill="url(#hero-fade)" />
    </svg>
  )
}
