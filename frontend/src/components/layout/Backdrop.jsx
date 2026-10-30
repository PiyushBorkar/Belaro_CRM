// Decorative background behind the whole app: drifting aurora glows, twinkling sparkles and an
// occasional shooting star. Styles and colors are in styles/global.css (.fx-*, --glow-*, --sparkle).
// Purely visual: hidden from screen readers, ignores the mouse, stops with reduced motion.

// Small deterministic generator, so sparkles keep the same places on every page and reload
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SPARKLES = (() => {
  const rand = seeded(20261022);
  return Array.from({ length: 54 }, (_, i) => {
    const star = i % 7 === 0; // every 7th is a 4-point star
    const size = star ? 7 + rand() * 6 : 1.5 + rand() * 2;
    return {
      star,
      style: {
        left: `${rand() * 100}%`,
        top: `${rand() * 100}%`,
        width: size,
        height: size,
        '--dur': `${4 + rand() * 5}s`,
        '--delay': `${-rand() * 9}s`, // negative: already mid-twinkle on first paint
        '--peak': (star ? 0.75 : 0.45 + rand() * 0.45).toFixed(2),
      },
    };
  });
})();

export function Backdrop() {
  return (
    <div className="fx-backdrop" aria-hidden>
      <div className="fx-glow fx-glow-1" />
      <div className="fx-glow fx-glow-2" />
      <div className="fx-glow fx-glow-3" />
      {SPARKLES.map((s, i) => (
        <span key={i} className={s.star ? 'fx-sparkle fx-star' : 'fx-sparkle'} style={s.style} />
      ))}
      <span className="fx-shooting-star" />
    </div>
  );
}
