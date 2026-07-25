import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Crumb {
  label: string;
  to?: string;
}

interface NavBarProps {
  crumbs?: Crumb[];
  action?: ReactNode;
}

export function NavBar({ crumbs = [], action }: NavBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-ink/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-sm">
          <Link
            to="/"
            className="font-display text-lg tracking-wide text-bone transition-colors hover:text-brass"
          >
            Design Studio
          </Link>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="text-line">/</span>
              {c.to ? (
                <Link to={c.to} className="text-bone-dim transition-colors hover:text-brass">
                  {c.label}
                </Link>
              ) : (
                <span className="text-bone">{c.label}</span>
              )}
            </span>
          ))}
        </div>
        {action}
      </div>
    </header>
  );
}
