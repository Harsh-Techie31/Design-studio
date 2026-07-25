import { Link } from "react-router-dom";
import { PlaceholderTile } from "../components/PlaceholderTile";

const FEATURES = [
  {
    title: "Seasons",
    body: "Import a 12-image moodboard to set the mood, palette, and direction for a collection.",
  },
  {
    title: "Garments",
    body: "Create as many garments as a season needs, each living inside that collection's mood.",
  },
  {
    title: "Pipeline",
    body: "Take every garment from sketch to photoshoot through a 7-stage guided design pipeline.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-ink text-bone">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg tracking-wide text-bone">Design Studio</span>
        <Link
          to="/seasons"
          className="rounded-full border border-line px-4 py-2 text-sm text-bone-dim transition-colors hover:border-brass/60 hover:text-brass"
        >
          Enter Studio
        </Link>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid grid-cols-6 gap-px opacity-40">
          {Array.from({ length: 18 }).map((_, i) => (
            <PlaceholderTile key={i} seed={13} index={i} className="aspect-square" />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/85 to-ink" />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-36 text-center">
          <span className="mb-6 rounded-full border border-brass/40 px-4 py-1 text-xs uppercase tracking-[0.2em] text-brass">
            AI Fashion Studio
          </span>
          <h1 className="font-display text-6xl leading-[1.05] text-bone sm:text-7xl">
            Every collection
            <br />
            starts with a mood.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-bone-dim">
            Build a season from a moodboard, then design each garment inside it —
            sketch, fabric, render, and shoot, all inspired by the same visual world.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <Link
              to="/seasons"
              className="rounded-full bg-brass px-7 py-3 text-sm font-medium text-ink transition-colors hover:bg-brass-soft"
            >
              Enter the Studio
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-line px-7 py-3 text-sm text-bone-dim transition-colors hover:border-brass/60 hover:text-brass"
            >
              How it works
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-8 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="rounded-xl border border-line bg-surface p-7">
              <span className="font-display text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 font-display text-2xl text-bone">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-bone-dim">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line-soft px-6 py-8 text-center text-xs text-muted">
        Design Studio — an AI-assisted fashion design tool.
      </footer>
    </div>
  );
}
