// Pointer position inside the element as --mx / --my (px), for effects that follow the mouse
// (.fx-tile spotlights in styles/global.css). Use as onPointerMove={trackPointer}.
export function trackPointer(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  el.style.setProperty('--my', `${e.clientY - rect.top}px`);
}
