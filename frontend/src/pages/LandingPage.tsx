import { Link } from "react-router-dom";
import { PlaceholderTile } from "../components/PlaceholderTile";

const FEATURES = [
  {
    number: "01",
    title: "Seasons",
    body: "Import a 12-image moodboard to set the mood, palette, and direction for a collection.",
  },
  {
    number: "02",
    title: "Garments",
    body: "Create as many garments as a season needs, each living inside that collection's mood.",
  },
  {
    number: "03",
    title: "Pipeline",
    body: "Take every garment from sketch to photoshoot through a 7-stage guided design pipeline.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-ink text-bone">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-bone">
          Design Studio
        </span>
        <Link
          to="/seasons"
          className="border border-line px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-bone-dim transition-colors hover:border-accent hover:text-accent"
        >
          Enter Studio
        </Link>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid grid-cols-6 gap-px opacity-20">
          {Array.from({ length: 18 }).map((_, i) => (
            <PlaceholderTile key={i} seed={13} index={i} className="aspect-square" />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-ink/80 to-ink" />

        <div className="relative mx-auto flex min-h-[calc(100svh-60px)] max-w-7xl flex-col justify-center px-8">
          <div className="max-w-3xl">
            <span className="mb-8 inline-block border border-accent/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
              AI Fashion Studio
            </span>
            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-bone sm:text-7xl lg:text-8xl">
              Every collection
              <br />
              starts with
              <br />
              a mood.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-bone-dim">
              Build a season from a moodboard, then design each garment inside it —
              sketch, fabric, render, and shoot, all inspired by the same visual world.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <Link
                to="/seasons"
                className="bg-accent px-7 py-3.5 font-mono text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-accent-soft"
              >
                Enter the Studio
              </Link>
              <a
                href="#how-it-works"
                className="border border-line px-7 py-3.5 font-mono text-xs uppercase tracking-wider text-bone-dim transition-colors hover:border-accent hover:text-accent"
              >
                How it works
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-8 py-24">
        <div className="grid gap-0 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="border-l border-line bg-surface p-8 first:border-l-0">
              <span className="font-mono text-[11px] font-medium text-accent">{f.number}</span>
              <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-bone">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-bone-dim">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line px-8 py-8 text-center font-mono text-[11px] uppercase tracking-wider text-muted">
        Design Studio — an AI-assisted fashion design tool.
      </footer>
    </div>
  );
}
