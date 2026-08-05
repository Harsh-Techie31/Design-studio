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
    <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
        <div className="flex items-center gap-3 text-sm">
          <Link
            to="/"
            className="font-mono text-xs font-medium uppercase tracking-widest text-bone transition-colors hover:text-vermillion"
          >
            DS
          </Link>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className="text-muted">/</span>
              {c.to ? (
                <Link
                  to={c.to}
                  className="font-mono text-xs uppercase tracking-wider text-bone-dim transition-colors hover:text-vermillion"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="font-mono text-xs uppercase tracking-wider text-bone">
                  {c.label}
                </span>
              )}
            </span>
          ))}
        </div>
        {action}
      </div>
    </header>
  );
}
