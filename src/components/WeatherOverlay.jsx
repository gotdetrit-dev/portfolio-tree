import { Fragment, useMemo } from 'react'

// ─── WeatherOverlay ───────────────────────────────────────────────────────────
// Seasonal weather visualisation on the LEFT side of the tree panel,
// mirroring the cards on the right. Visuals change with `mode`:
//   rain  → falling raindrops
//   cool  → snowflakes drifting
//   hot   → pulsing sun + heat ripples
export default function WeatherOverlay({ mode }) {
  // Deterministic seeded arrays so positions stay stable between renders
  const RAIN = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    left: (i * 4.3 + 3) % 100,
    height: 18 + ((i * 7) % 28), // px
    delay: ((i * 0.17) % 1.4).toFixed(2),
    dur: (0.9 + ((i * 0.13) % 0.8)).toFixed(2),
  })), [])

  const SNOW = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: (i * 5.1 + 7) % 95,
    size: 10 + ((i * 3) % 8),
    delay: ((i * 0.21) % 3).toFixed(2),
    dur: (5 + ((i * 0.33) % 4)).toFixed(2),
  })), [])

  const RAYS = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    angle: i * 36,
    delay: ((i * 0.15) % 1.2).toFixed(2),
    len: 80 + ((i * 13) % 60),
  })), [])

  const WAVES = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    bottom: i * 28,
    delay: ((i * 0.55) % 2.5).toFixed(2),
    dur: (3 + i * 0.4).toFixed(2),
  })), [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {mode === 'rain' && RAIN.map((r, i) => (
        <span
          key={`rn${i}`}
          className="weather-drop"
          style={{ left: `${r.left}%`, height: r.height, animationDelay: `${r.delay}s`, animationDuration: `${r.dur}s` }}
        />
      ))}
      {mode === 'cool' && SNOW.map((s, i) => (
        <span
          key={`sn${i}`}
          className="weather-flake"
          style={{ left: `${s.left}%`, fontSize: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
        >
          ❄
        </span>
      ))}
      {mode === 'hot' && (
        <Fragment>
          {/* Sun anchored upper-left */}
          <div className="weather-sun" style={{ left: '8%', top: '10%', width: 120, height: 120 }} />
          {/* Sun rays */}
          {RAYS.map((r, i) => (
            <span
              key={`ry${i}`}
              className="weather-ray"
              style={{
                left: 'calc(8% + 60px)',
                top: 'calc(10% + 60px)',
                width: r.len,
                transform: `rotate(${r.angle}deg) translateX(50px)`,
                animationDelay: `${r.delay}s`,
              }}
            />
          ))}
          {/* Heat shimmer waves rising from ground */}
          {WAVES.map((w, i) => (
            <span
              key={`wv${i}`}
              className="weather-wave"
              style={{
                bottom: w.bottom + 30,
                left: '20%',
                animationDelay: `${w.delay}s`,
                animationDuration: `${w.dur}s`,
                animationIterationCount: 'infinite',
                animationTimingFunction: 'ease-out',
                animationName: 'heatWave',
              }}
            />
          ))}
          {/* Warm radial glow */}
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(40% 60% at 18% 30%, rgba(255,140,60,0.10), transparent 70%)' }}
          />
        </Fragment>
      )}
    </div>
  )
}
