export function HelpHint({ label, description }: { label: string; description: string }) {
  return (
    <button
      aria-label={`${label}说明`}
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] text-muted hover:border-action hover:text-action focus:outline-none focus:ring-2 focus:ring-action/30"
      title={description}
      type="button"
    >
      ?
    </button>
  );
}
