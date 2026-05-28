// Decorative animated background for the landing hero.
// Layered, dependency-free CSS in the apothecary palette:
//   1. faint "lab notebook" dot grid
//   2. four heavily blurred saffron + petrol blobs that drift on slow,
//      offset cubic-bezier loops
//   3. linear mask so the wash fades cleanly into the next section
// Inspiration: the Vercel / Stripe / Linear / Resend aurora idiom.
// Tracks the active theme via CSS variables (--primary, --chart-2, --chart-4)
// and inverts its blend mode (multiply → plus-lighter) between light and dark.
// All styling and keyframes live in app/globals.css under "Hero aurora".

export function HeroAurora() {
  return (
    <div
      aria-hidden="true"
      className="hero-aurora pointer-events-none absolute inset-0 select-none overflow-hidden"
    >
      <div className="hero-aurora__grid absolute inset-0" />
      <div className="hero-aurora__blobs absolute inset-0">
        <div className="hero-aurora__blob hero-aurora__blob--a" />
        <div className="hero-aurora__blob hero-aurora__blob--b" />
        <div className="hero-aurora__blob hero-aurora__blob--c" />
        <div className="hero-aurora__blob hero-aurora__blob--d" />
      </div>
    </div>
  );
}
