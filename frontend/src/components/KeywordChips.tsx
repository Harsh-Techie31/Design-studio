export function KeywordChips({ keywords }: { keywords: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map((k) => (
        <span
          key={k}
          className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-wide text-bone-dim"
        >
          {k}
        </span>
      ))}
    </div>
  );
}
