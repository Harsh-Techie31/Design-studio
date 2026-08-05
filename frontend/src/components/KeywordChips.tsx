export function KeywordChips({ keywords }: { keywords: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {keywords.map((k) => (
        <span
          key={k}
          className="border border-line px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-bone-dim"
        >
          {k}
        </span>
      ))}
    </div>
  );
}
