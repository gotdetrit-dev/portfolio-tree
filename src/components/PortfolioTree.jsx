// ─────────────────────────────────────────────────────────────────────────────
// PortfolioTree — the embedded reference tree image.
// The source PNG has a pure-black background; `.tree-img`'s
// mix-blend-mode: lighten dissolves it into the page.
// ─────────────────────────────────────────────────────────────────────────────

export default function PortfolioTree() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <img
        src="/assets/tree.png"
        alt="Portfolio tree"
        className="block tree-img"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
    </div>
  )
}
