export function LibraryToolbar({
  title,
  placeholder,
  query,
  onQueryChange,
  pinnedOnly,
  onPinnedOnlyChange,
  tags,
  selectedTag,
  onSelectedTagChange
}: {
  title: string;
  placeholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  pinnedOnly: boolean;
  onPinnedOnlyChange: (value: boolean) => void;
  tags: string[];
  selectedTag: string;
  onSelectedTagChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <input
          className="w-full rounded-md border border-line px-3 py-2 text-sm sm:w-72"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          value={query}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className={buttonClass(!pinnedOnly)}
          onClick={() => onPinnedOnlyChange(false)}
          type="button"
        >
          全部
        </button>
        <button
          className={buttonClass(pinnedOnly)}
          onClick={() => onPinnedOnlyChange(true)}
          type="button"
        >
          仅置顶
        </button>
        {tags.map((tag) => (
          <button
            className={buttonClass(selectedTag === tag)}
            key={tag}
            onClick={() => onSelectedTagChange(selectedTag === tag ? "" : tag)}
            type="button"
          >
            {tag}
          </button>
        ))}
        {selectedTag ? (
          <button
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm text-slate-600"
            onClick={() => onSelectedTagChange("")}
            type="button"
          >
            清除筛选
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function uniqueTags(groups: string[][]) {
  const counts = new Map<string, { count: number; firstSeen: number }>();
  groups.flat().forEach((rawTag) => {
    const tag = rawTag.trim();
    if (!tag) return;
    const existing = counts.get(tag);
    counts.set(tag, {
      count: (existing?.count || 0) + 1,
      firstSeen: existing?.firstSeen ?? counts.size
    });
  });

  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b.count - a.count || a.firstSeen - b.firstSeen)
    .slice(0, 8)
    .map(([tag]) => tag);
}

function buttonClass(active: boolean) {
  return active
    ? "rounded-md bg-action px-3 py-1.5 text-sm text-white"
    : "rounded-md border border-line bg-white px-3 py-1.5 text-sm text-slate-600";
}
